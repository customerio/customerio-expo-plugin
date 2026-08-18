const { execFileSync } = require("child_process");
const semver = require("semver");

const TEMPLATE_PACKAGE_PREFIX = "expo-template-";

// ---------------------------------------------------------------------------
// Selection logic (pure — no registry access, covered by unit tests)
// ---------------------------------------------------------------------------

// `create-expo-app --template` accepts shorthand (`default`, `blank`), but the
// registry queries below need the real package name.
function templatePackageName(template) {
  return template.startsWith(TEMPLATE_PACKAGE_PREFIX) ? template : `${TEMPLATE_PACKAGE_PREFIX}${template}`;
}

// `npm view <range> version dependencies.expo --json` returns an array for a
// multi-version match but collapses to a bare object for a single match, and
// omits `dependencies.expo` entirely for versions that don't declare it.
function parseTemplateCandidates(raw) {
  if (!raw) return [];

  return (Array.isArray(raw) ? raw : [raw]).map((entry) => ({
    version: entry.version,
    expoRange: entry["dependencies.expo"],
  }));
}

// An exact version, or null for anything with range semantics. A `~`/`^` range
// is resolved by npm to the highest *published* version regardless of dist-tag,
// so only an exact version keeps an unblessed release out of the install.
function pinnedExactVersion(dependencyRange) {
  return dependencyRange && semver.valid(dependencyRange) ? dependencyRange : null;
}

// Candidates the selector can actually reason about: real stable versions that
// declare a parseable `expo` pin.
function evaluableCandidates(candidates) {
  return candidates.filter(
    (candidate) =>
      semver.valid(candidate.version) &&
      !semver.prerelease(candidate.version) &&
      candidate.expoRange &&
      semver.validRange(candidate.expoRange),
  );
}

function newestFirst(candidates) {
  return [...candidates].sort((a, b) => semver.rcompare(a.version, b.version));
}

// Prefers the curated `sdk-<major>` template, and only walks back when that one
// pins an `expo` release that isn't out yet. Templates ship ahead of the `expo`
// releases they pin, so the tagged one is regularly unusable for a day or two;
// deviating only in that window keeps every unaffected run on the blessed
// template rather than trusting whatever was published most recently.
function selectTemplateVersion(candidates, stableExpoVersion, taggedVersion) {
  const usable = newestFirst(evaluableCandidates(candidates));
  const satisfied = (candidate) => semver.satisfies(stableExpoVersion, candidate.expoRange);

  const tagged = taggedVersion && usable.find((candidate) => candidate.version === taggedVersion);
  if (tagged && satisfied(tagged)) return tagged;

  return usable.find(satisfied) || null;
}

function isStableRelease(version, expectedMajor) {
  return Boolean(version) && semver.valid(version) && !semver.prerelease(version) && semver.major(version) === expectedMajor;
}

// Resolves the stable `expo` release for a major from dist-tags, in priority
// order. `sources` holds lazy lookups so only the needed queries run.
//
// The current major MUST come from the `latest` dist-tag and nothing else.
// During the 2026-08-14 outage `expo@next` was 57.0.13 — a plain, non-prerelease
// version — while `latest` was still 57.0.12. Falling back to "newest published
// version in the major" would have picked 57.0.13, accepted the template that
// pins it, and reproduced the breakage. What made that release unusable was its
// channel, not its version string.
function chooseStableExpoVersion(requestedMajor, sources) {
  const latest = sources.latest();
  if (isStableRelease(latest, requestedMajor)) return latest;

  // Superseded majors live on `sdk-<major>`, which never carries a prerelease
  // (canaries get their own `canary-sdk-<major>` tag).
  const sdkTag = sources.sdkTag(requestedMajor);
  if (isStableRelease(sdkTag, requestedMajor)) return sdkTag;

  // `expo` prunes old channel tags — sdk-52 is currently the oldest that still
  // exists — so anything older has to come from the published version list.
  // Safe only for a *superseded* major: `next` and `canary` never point back at
  // one. For a major at or ahead of `latest` the list is the wrong source, since
  // that is exactly where an unblessed release sits as ordinary semver.
  const supersededMajor = semver.valid(latest) && requestedMajor < semver.major(latest);
  if (!supersededMajor) return null;

  const newestStable = sources.newestStableInMajor(requestedMajor);
  if (isStableRelease(newestStable, requestedMajor)) return newestStable;

  return null;
}

// Explains why no template could be selected, naming the versions that
// disagree. Misreading an upstream registry state as a plugin regression is
// what made the 2026-08-14 incident expensive, so the diagnosis has to be
// specific enough to close that question immediately.
function describeTemplateResolutionFailure({ major, templatePackage, stableExpoVersion, candidates }) {
  if (!stableExpoVersion) {
    return [
      `No stable \`expo\` release published for SDK ${major}.`,
      `Checked the \`latest\` and \`sdk-${major}\` dist-tags and the published version list.`,
    ];
  }

  // Only the candidates the selector could evaluate are worth reporting on —
  // counting entries it silently skipped would overstate what was checked, and
  // naming one of them prints an `undefined` pin.
  const evaluable = newestFirst(evaluableCandidates(candidates));

  if (evaluable.length === 0) {
    return [
      `No usable \`${templatePackage}\` version published for SDK ${major}.`,
      `Stable \`expo\` for SDK ${major}: ${stableExpoVersion}`,
      candidates.length > 0
        ? `${candidates.length} version(s) exist but none declare a parseable \`expo\` pin.`
        : "The registry returned no stable versions in this major.",
    ];
  }

  const newest = evaluable[0];

  return [
    `Stable \`expo\` for SDK ${major}: ${stableExpoVersion}`,
    `Newest \`${templatePackage}\`: ${newest.version}, pins expo ${newest.expoRange} — unsatisfied`,
    `Checked ${evaluable.length} template version(s); none pin an expo range that ${stableExpoVersion} satisfies.`,
    "The template channel is ahead of the stable expo release.",
  ];
}

// ---------------------------------------------------------------------------
// Registry access
// ---------------------------------------------------------------------------

// `npm view` exits 1 with E404 when a dist-tag or range matches nothing. That's
// a legitimate "not published" answer, not a failure, so it maps to null.
function npmViewJson(spec, fields) {
  try {
    const output = execFileSync("npm", ["view", spec, ...fields, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    return output ? JSON.parse(output) : null;
  } catch (error) {
    const details = `${error.stdout || ""}${error.stderr || ""}`;
    if (details.includes("E404")) return null;
    throw error;
  }
}

function majorRange(major) {
  return `>=${major}.0.0 <${major + 1}.0.0`;
}

// One round trip for every stable template version in the major. The semver
// range excludes template canaries on its own.
function fetchTemplateCandidates(templatePackage, major) {
  return parseTemplateCandidates(
    npmViewJson(`${templatePackage}@${majorRange(major)}`, ["version", "dependencies.expo"]),
  );
}

// The curated template for an SDK, or null when the tag doesn't exist.
function fetchTaggedTemplateVersion(templatePackage, major) {
  return npmViewJson(`${templatePackage}@sdk-${major}`, ["version"]);
}

// Distinguishes "this package isn't published at all" (a bad `--expo-template`
// argument — our problem) from "published, but nothing usable in this major"
// (upstream). Conflating the two sends the reader upstream to chase a typo.
function templatePackageExists(templatePackage) {
  return npmViewJson(templatePackage, ["name"]) !== null;
}

function expoRegistrySources() {
  return {
    latest: () => npmViewJson("expo@latest", ["version"]),
    sdkTag: (major) => npmViewJson(`expo@sdk-${major}`, ["version"]),
    newestStableInMajor: (major) => {
      const versions = npmViewJson(`expo@${majorRange(major)}`, ["version"]);
      const list = Array.isArray(versions) ? versions : [versions].filter(Boolean);
      return list.length ? semver.rsort([...list])[0] : null;
    },
  };
}

module.exports = {
  templatePackageName,
  parseTemplateCandidates,
  selectTemplateVersion,
  chooseStableExpoVersion,
  describeTemplateResolutionFailure,
  pinnedExactVersion,
  fetchTemplateCandidates,
  fetchTaggedTemplateVersion,
  templatePackageExists,
  expoRegistrySources,
};
