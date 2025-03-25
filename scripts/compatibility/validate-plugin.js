const fs = require("fs");
const path = require("path");
const {
  getArgValue,
  isFlagEnabled,
  logMessage,
  parseArrayArg,
  runCommand,
  runScript,
} = require("../utils/cli");

const APP_PATH = getArgValue("--app-path", { required: true });
const PLATFORMS = getArgValue("--platforms", { default: "android,ios" }).split(",");
const IOS_PUSH_PROVIDERS = parseArrayArg("--ios-push-providers", { default: "apn,fcm" });
const TESTS_DIRECTORY_PATH = getArgValue("--tests-dir-path", {
  default: path.join(__dirname, "../../__tests__"),
});
const CLEAN_FLAG = isFlagEnabled("--clean", { default: true });
const RUN_CONTRACT_TESTS = isFlagEnabled("--contract-tests", { default: true });

let PREBUILD_CMD = `cd ${APP_PATH} && CI=1 npx expo prebuild`;
if (CLEAN_FLAG) PREBUILD_CMD += " --clean";

/**
 * Gets the Expo SDK version from package.json
 * @returns {string} Expo SDK version
 */
function getExpoVersion() {
  try {
    const packageJsonPath = path.join(APP_PATH, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.dependencies.expo.replace('^', '').replace('~', '');
  } catch (error) {
    logMessage(`⚠️ Warning: Failed to determine Expo version - ${error.message}`, "warning");
    return "unknown";
  }
}

/**
 * Retrieves the name of the iOS workspace from the app.json or fallback to scanning
 * the /ios directory for .xcworkspace files.
 * @returns {string} - The name of the workspace.
 */
function getIosWorkspaceName(fallback = "App") {
  // Scan the /ios directory for .xcworkspace files
  const iosPath = path.join(APP_PATH, "ios");
  if (fs.existsSync(iosPath)) {
    const workspaces = fs.readdirSync(iosPath).filter((file) => file.endsWith(".xcworkspace"));
    if (workspaces.length > 0) {
      return path.basename(workspaces[0], ".xcworkspace");
    }
  }

  // Try to get workspace name from app.json
  const appJsonPath = path.join(APP_PATH, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      if (appJson.expo?.name) {
        return appJson.expo.name;
      }
    } catch (error) {
      logMessage(`⚠️ Warning: Failed to read app.json - ${error.message}`, "warning");
    }
  }

  // Default fallback
  return fallback;
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  const expoVersion = getExpoVersion();
  const appName = getIosWorkspaceName();
  
  logMessage(`🚀 Starting test and build validation for Expo plugin (Expo SDK ${expoVersion})...\n`);
  logMessage(`📱 App name: ${appName}`);

  if (PLATFORMS.includes("android")) {
    logMessage("⚙️ Running expo prebuild before Android...");
    runCommand(PREBUILD_CMD);

    logMessage("🧪 Running Android tests...");
    runCommand(`TEST_APP_PATH=${APP_PATH} TEST_APP_NAME=${appName} TEST_EXPO_VERSION=${expoVersion} npm test -- ${TESTS_DIRECTORY_PATH}/android`);

    // Run contract tests for Android if enabled
    if (RUN_CONTRACT_TESTS) {
      logMessage("📝 Running Android contract tests...");
      runCommand(`TEST_APP_PATH=${APP_PATH} TEST_APP_NAME=${appName} TEST_EXPO_VERSION=${expoVersion} npm test -- ${TESTS_DIRECTORY_PATH}/contracts.test.js`);
    }

    logMessage("🤖 Building Android project...");
    try {
      runCommand(`cd ${APP_PATH}/android && ./gradlew assembleRelease`);
      logMessage("✅ Android build succeeded!", "success");
    } catch (error) {
      logMessage("❌ Android build failed: " + error.message, "error");
      process.exit(1);
    }
  }

  if (PLATFORMS.includes("ios")) {
    for (const provider of IOS_PUSH_PROVIDERS) {
      logMessage(`🔄 Switching push provider to: ${provider}`);
      runCommand(`npm run compatibility:configure-plugin -- --app-path=${APP_PATH} --ios-push-provider=${provider}`);

      logMessage(
        `⚙️ Running expo prebuild after modifying app.json for ios push provider: ${provider}`,
      );
      runCommand(PREBUILD_CMD);

      const JEST_TEST_ENV_VALUES = `TEST_APP_PATH=${APP_PATH} TEST_APP_NAME=${appName} TEST_EXPO_VERSION=${expoVersion}`;
      logMessage(`🧪 Running iOS tests for provider: ${provider}`);
      runCommand(`${JEST_TEST_ENV_VALUES} npm test -- ${TESTS_DIRECTORY_PATH}/ios/common ${TESTS_DIRECTORY_PATH}/ios/${provider}`);

      // Run contract tests for current iOS provider if enabled
      if (RUN_CONTRACT_TESTS) {
        logMessage(`📝 Running iOS contract tests for provider: ${provider}...`);
        runCommand(`${JEST_TEST_ENV_VALUES} IOS_PUSH_PROVIDER=${provider} npm test -- ${TESTS_DIRECTORY_PATH}/contracts.test.js`);
      }

      logMessage(`📱 Building iOS project for provider: ${provider}`);
      try {
        runCommand(`cd ${APP_PATH}/ios && xcodebuild -workspace ${appName}.xcworkspace -scheme ${appName} -sdk iphonesimulator -configuration Release build`);
        logMessage(`✅ iOS build succeeded for provider: ${provider}`, "success");
      } catch (error) {
        logMessage(`❌ iOS build failed for provider: ${provider}: ${error.message}`, "error");
        process.exit(1);
      }
    }
  }

  logMessage("\n✅ Test and build validation completed!", "success");
}

runScript(execute);
