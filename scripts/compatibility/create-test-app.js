const fs = require("fs");
const path = require("path");
const semver = require("semver");
const { execSync } = require("child_process");
const { getArgValue, isFlagEnabled, logMessage, runCommand, runScript } = require("../utils/cli");
const {
  chooseStableExpoVersion,
  describeTemplateResolutionFailure,
  expoRegistrySources,
  fetchTemplateCandidates,
  selectTemplateVersion,
  templatePackageName,
} = require("../utils/expo-template");

const INSTALL_ATTEMPTS = 3;
const INSTALL_RETRY_DELAY_SECONDS = 10;

// `expo-template-default`'s npm `latest` dist-tag lags Expo SDK releases by
// weeks (e.g. SDK 55 has been out for a while but `default` still resolves
// to the SDK 54 template), so `--template default` silently downgrades the
// generated app a major version. Resolve `--expo-version=latest` to the
// current Expo SDK major from `npm view expo version` instead.
function resolveExpoVersion(input) {
  if (input !== "latest") return input;
  const full = execSync("npm view expo version", { encoding: "utf8" }).trim();
  return full.split(".")[0];
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

// Resolves the exact `expo-template-<name>` version to generate from, rather
// than trusting the `sdk-<major>` dist-tag. That tag tracks `next`, so it can
// point at a template pinning an `expo` release that isn't on `latest` yet —
// which on 2026-08-14 meant a template requiring an unpublished
// expo-file-system. Gating on the stable `expo` release keeps the major
// floating and the template as new as possible while excluding that channel.
function resolveTemplateSpec() {
  const coerced = semver.coerce(EXPO_VERSION);
  if (!coerced) {
    console.error(`❌ Could not read an Expo SDK major from --expo-version=${EXPO_VERSION}`);
    process.exit(1);
  }

  const major = coerced.major;
  const templatePackage = templatePackageName(EXPO_TEMPLATE);

  const stableExpoVersion = chooseStableExpoVersion(major, expoRegistrySources());
  const candidates = stableExpoVersion ? fetchTemplateCandidates(templatePackage, major) : [];
  const selected = stableExpoVersion ? selectTemplateVersion(candidates, stableExpoVersion) : null;

  if (!selected) {
    exitUpstreamInconsistent(
      describeTemplateResolutionFailure({ major, templatePackage, stableExpoVersion, candidates }),
    );
  }

  logMessage(`🔹 Stable Expo Release: ${stableExpoVersion}`);
  logMessage(`🔹 Template: ${templatePackage}@${selected.version} (pins expo ${selected.expoRange})`);

  return `${EXPO_TEMPLATE}@${selected.version}`;
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
  const RESOLVED_EXPO_TEMPLATE = resolveTemplateSpec();
  runCommand(
    `cd ${APP_DIRECTORY_PATH} && npx create-expo-app '${APP_NAME}' --template ${RESOLVED_EXPO_TEMPLATE} --no-install`,
  );

  // Step 4: Install dependencies (skipped above via --no-install)
  logMessage("\n📦 Installing app dependencies...");
  installAppDependencies(APP_PATH);

  logMessage("✅ Expo app created successfully!", "success");
}

runScript(execute);
