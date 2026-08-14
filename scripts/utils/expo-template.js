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

// Picks the newest template whose pinned `expo` range accepts the stable `expo`
// release. Templates ship ahead of the `expo` releases they pin, so the newest
// one is regularly unusable for a day or two; walking back to the newest usable
// one keeps the job on the latest template without pinning it to a version.
function selectTemplateVersion(candidates, stableExpoVersion) {
  const usable = candidates.filter(
    (candidate) =>
      semver.valid(candidate.version) &&
      !semver.prerelease(candidate.version) &&
      candidate.expoRange &&
      semver.validRange(candidate.expoRange),
  );

  const newestFirst = [...usable].sort((a, b) => semver.rcompare(a.version, b.version));

  return newestFirst.find((candidate) => semver.satisfies(stableExpoVersion, candidate.expoRange)) || null;
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
  // Safe there: `next` and `canary` never point at a superseded major.
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

  if (candidates.length === 0) {
    return [
      `No stable \`${templatePackage}\` version published for SDK ${major}.`,
      `Stable \`expo\` for SDK ${major}: ${stableExpoVersion}`,
    ];
  }

  const newest = [...candidates].sort((a, b) => semver.rcompare(a.version, b.version))[0];

  return [
    `Stable \`expo\` for SDK ${major}: ${stableExpoVersion}`,
    `Newest \`${templatePackage}\`: ${newest.version}, pins expo ${newest.expoRange} — unsatisfied`,
    `Checked ${candidates.length} template version(s); none pin an expo range that ${stableExpoVersion} satisfies.`,
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
  fetchTemplateCandidates,
  expoRegistrySources,
};
