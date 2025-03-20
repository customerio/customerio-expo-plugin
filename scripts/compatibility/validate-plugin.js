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
const PUSH_PROVIDERS = parseArrayArg("--push-providers", { default: "apn,fcm" });
const TESTS_DIRECTORY_PATH = getArgValue("--tests-dir-path", {
  default: path.join(__dirname, "../../__tests__"),
});
const CLEAN_FLAG = isFlagEnabled("--clean", true);

let PREBUILD_CMD = `cd ${APP_PATH} && CI=1 npx expo prebuild`;
if (CLEAN_FLAG) PREBUILD_CMD += " --clean";

/**
 * Retrieves the name of the iOS workspace from the app.json or fallback to scanning
 * the /ios directory for .xcworkspace files.
 * @returns {string} - The name of the workspace.
 */
function getIosWorkspaceName(fallback = "App") {
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

  // Scan the /ios directory for .xcworkspace files
  const iosPath = path.join(APP_PATH, "ios");
  if (fs.existsSync(iosPath)) {
    const workspaces = fs.readdirSync(iosPath).filter((file) => file.endsWith(".xcworkspace"));
    if (workspaces.length > 0) {
      return path.basename(workspaces[0], ".xcworkspace");
    }
  }

  // Default fallback
  return fallback;
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage("🚀 Starting test and build validation for Expo plugin...\n");

  if (PLATFORMS.includes("android")) {
    logMessage("⚙️ Running expo prebuild before Android...");
    runCommand(PREBUILD_CMD);

    logMessage("🧪 Running Android tests...");
    runCommand(`npm test -- ${TESTS_DIRECTORY_PATH}/android`);

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
    for (const provider of PUSH_PROVIDERS) {
      logMessage(`🔄 Switching push provider to: ${provider}`);
      runCommand(`npm run compatibility:configure-plugin -- --app-path=${APP_PATH} --ios-push-provider=${provider}`);

      logMessage(
        `⚙️ Running expo prebuild after modifying app.json for ios push provider: ${provider}`,
      );
      runCommand(PREBUILD_CMD);

      logMessage(`🧪 Running iOS tests for provider: ${provider}`);
      runCommand(`npm test -- ${TESTS_DIRECTORY_PATH}/ios/common ${TESTS_DIRECTORY_PATH}/ios/${provider}`);

      logMessage(`📱 Building iOS project for provider: ${provider}`);
      try {
        // Get correct workspace name for iOS build
        const workspaceName = getIosWorkspaceName();
        runCommand(`cd ${APP_PATH}/ios && xcodebuild -workspace ${workspaceName}.xcworkspace -scheme ${workspaceName} -sdk iphonesimulator -configuration Release build`);
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
