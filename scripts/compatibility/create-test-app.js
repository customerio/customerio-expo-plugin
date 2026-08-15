const fs = require("fs");
const path = require("path");
const semver = require("semver");
const { execSync } = require("child_process");
const { getArgValue, isFlagEnabled, logMessage, runCommand, runScript } = require("../utils/cli");
const {
  chooseStableExpoVersion,
  describeTemplateResolutionFailure,
  expoRegistrySources,
  fetchTaggedTemplateVersion,
  fetchTemplateCandidates,
  selectTemplateVersion,
  templatePackageExists,
  templatePackageName,
} = require("../utils/expo-template");

const INSTALL_ATTEMPTS = 3;
const INSTALL_RETRY_DELAY_SECONDS = 10;

// `expo-template-default`'s npm `latest` dist-tag lags Expo SDK releases by
// weeks (e.g. SDK 55 has been out for a while but `default` still resolves
// to the SDK 54 template), so `--template default` silently downgrades the
// generated app a major version. Resolve `--expo-version=latest` to the
// current Expo SDK major from the `latest` dist-tag instead.
//
// Read once and reused for the stable-release lookup below: two separate reads
// of the same dist-tag can straddle a release and disagree about the major.
const EXPO_REGISTRY = expoRegistrySources();
const EXPO_LATEST_VERSION = EXPO_REGISTRY.latest();

function resolveExpoVersion(input) {
  if (input !== "latest") return input;

  if (!EXPO_LATEST_VERSION) {
    exitUpstreamInconsistent(["The `expo` package has no `latest` dist-tag."]);
  }

  return String(EXPO_LATEST_VERSION).split(".")[0];
}

const EXPO_VERSION = resolveExpoVersion(getArgValue("--expo-version", { required: true }));
const EXPO_TEMPLATE = getArgValue("--expo-template", {
  // Determine default template based on Expo version
  // Default template is only available for Expo SDK 51 and above
  default: isNaN(parseFloat(EXPO_VERSION)) || parseFloat(EXPO_VERSION) > 50 ? "default" : "blank",
});
const APP_NAME = getArgValue("--app-name", {
  default: `TestApp_Expo${EXPO_VERSION}_${EXPO_TEMPLATE}`.replace(/\./g, ""),
});
const DIRECTORY_NAME = getArgValue("--dir-name", { default: "ci-test-apps" });
const CLEAN_FLAG = isFlagEnabled("--clean");

// Fails the job with an explicit "this is upstream, not us" verdict. The
// 2026-08-14 incident cost ~58 minutes of red CI across every open Expo PR
// before anyone established that nothing in this repo had changed, so the
// distinction is worth spelling out at the point of failure.
function exitUpstreamInconsistent(lines) {
  logMessage(
    [
      "",
      "❌ Upstream registry inconsistent — this is not a plugin regression.",
      ...lines.map((line) => `   ${line}`),
      "",
      "   Nothing in this repository needs to change. Re-run once the registry",
      "   settles, or pass --expo-version=<major> to target a published SDK.",
      "",
    ].join("\n"),
    "error",
  );
  process.exit(1);
}

// Resolves which template to generate from and which `expo` release the app
// should end up on.
//
// The template is chosen against the stable `expo` release rather than taken
// from `sdk-<major>`, because that tag tracks `next` — on 2026-08-14 it pointed
// at a template pinning an `expo` requiring an unpublished expo-file-system.
// The curated tag still wins whenever it is usable; we only walk back when it
// is not.
//
// Choosing the template is necessary but not sufficient: templates pin `expo`
// with a `~` range, and npm resolves a range to the highest *published* version
// regardless of dist-tag. `~57.0.12` still installs 57.0.13 when that release
// exists on `next` only, so the caller writes the exact stable version into the
// generated app before installing.
function resolveTemplateSpec() {
  const coerced = semver.coerce(EXPO_VERSION);
  if (!coerced) {
    console.error(`❌ Could not read an Expo SDK major from --expo-version=${EXPO_VERSION}`);
    process.exit(1);
  }

  const major = coerced.major;
  const templatePackage = templatePackageName(EXPO_TEMPLATE);

  // A `--expo-template` typo also produces "nothing published", so rule that
  // out before blaming the registry for our own bad argument.
  if (!templatePackageExists(templatePackage)) {
    console.error(
      `❌ No npm package named \`${templatePackage}\` (from --expo-template=${EXPO_TEMPLATE}).\n` +
        `   Expected a create-expo-app template such as \`default\` or \`blank\`.`,
    );
    process.exit(1);
  }

  const stableExpoVersion = chooseStableExpoVersion(major, {
    ...EXPO_REGISTRY,
    latest: () => EXPO_LATEST_VERSION,
  });

  const candidates = stableExpoVersion ? fetchTemplateCandidates(templatePackage, major) : [];
  const taggedVersion = stableExpoVersion ? fetchTaggedTemplateVersion(templatePackage, major) : null;
  const selected = selectTemplateVersion(candidates, stableExpoVersion, taggedVersion);

  if (!selected) {
    exitUpstreamInconsistent(
      describeTemplateResolutionFailure({ major, templatePackage, stableExpoVersion, candidates }),
    );
  }

  const viaTag = selected.version === taggedVersion ? ` (sdk-${major})` : " (walked back from sdk tag)";
  logMessage(`🔹 Stable Expo Release: ${stableExpoVersion}`);
  logMessage(`🔹 Template: ${templatePackage}@${selected.version}${viaTag}, pins expo ${selected.expoRange}`);

  return { template: `${templatePackage}@${selected.version}`, expoVersion: stableExpoVersion };
}

// create-expo-app swallows install failures — it prints "Something went wrong
// installing JavaScript dependencies... Continuing" and then "Your project is
// ready!", so a broken dependency graph only surfaces several steps later as
// an unrelated-looking prebuild or Gradle error. Running the install here makes
// it fail where it happened, and gives transient registry errors a retry.
function installAppDependencies(appPath) {
  for (let attempt = 1; attempt <= INSTALL_ATTEMPTS; attempt++) {
    try {
      runCommand(`cd ${appPath} && npm install`);
      return;
    } catch (error) {
      if (attempt === INSTALL_ATTEMPTS) {
        logMessage(`❌ Dependency installation failed after ${INSTALL_ATTEMPTS} attempts.`, "error");
        // Leave no half-built app behind: the directory exists but has no
        // node_modules, so the next run would refuse to start with a confusing
        // "directory already exists" instead of retrying the install.
        logMessage(`🧹 Removing incomplete app: ${appPath}`, "warning");
        runCommand(`rm -rf ${appPath}`);
        throw error;
      }

      logMessage(
        `⚠️  Dependency installation failed (attempt ${attempt}/${INSTALL_ATTEMPTS}), retrying in ${INSTALL_RETRY_DELAY_SECONDS}s...`,
        "warning",
      );
      execSync(`sleep ${INSTALL_RETRY_DELAY_SECONDS}`);
    }
  }
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage("🚀 Starting Expo test app creation...\n");

  // App directory path relative from script to root directory
  const APP_DIRECTORY_PATH = path.resolve(__dirname, "../../", DIRECTORY_NAME);
  const APP_PATH = path.join(APP_DIRECTORY_PATH, APP_NAME);

  logMessage(`🔹 Expo Version: ${EXPO_VERSION}`);
  logMessage(`🔹 App Path: ${APP_PATH}`);

  // Step 1: Create app directory if it doesn't exist
  logMessage(`\n📁 Ensuring app directory exists: ${APP_DIRECTORY_PATH}`);
  runCommand(`mkdir -p ${APP_DIRECTORY_PATH}`);

  // Step 2: Handle existing app directory
  if (fs.existsSync(APP_PATH)) {
    if (CLEAN_FLAG) {
      logMessage(`🧹 Removing existing directory: ${APP_PATH}`, "warning");
      runCommand(`rm -rf ${APP_PATH}`);
    } else {
      console.error(`❌ Directory ${APP_PATH} already exists. Use --clean to remove it.`);
      process.exit(1);
    }
  }

  // Step 3: Create a new Expo app
  logMessage(`\n🔧 Creating new Expo app: ${APP_NAME} (Expo ${EXPO_VERSION})`);
  const { template, expoVersion } = resolveTemplateSpec();
  runCommand(
    `cd ${APP_DIRECTORY_PATH} && npx create-expo-app '${APP_NAME}' --template ${template} --no-install`,
  );

  // Step 4: Hold the app to the stable `expo` release. The template's `~` range
  // would otherwise resolve to the highest published version, dist-tag ignored,
  // which is how a `next`-only release gets in. Resolved fresh every run, so a
  // new stable release is still picked up the day it ships.
  logMessage(`\n📌 Setting expo to the stable release: ${expoVersion}`);
  runCommand(`cd ${APP_PATH} && npm pkg set dependencies.expo=${expoVersion}`);

  // Step 5: Install dependencies (skipped above via --no-install)
  logMessage("\n📦 Installing app dependencies...");
  installAppDependencies(APP_PATH);

  logMessage("✅ Expo app created successfully!", "success");
}

runScript(execute);
