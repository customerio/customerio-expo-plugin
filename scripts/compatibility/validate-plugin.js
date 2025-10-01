const fs = require("fs");
const path = require("path");
const {
  runScriptWithArgs,
  getArgValue,
  isFlagEnabled,
  logMessage,
  parseArrayArg,
  runCommand,
  runScript,
} = require("../utils/cli");

const APP_PATH = getArgValue("--app-path", { required: true });
const EXPO_VERSION = getArgValue("--expo-version", { default: 53 })
const PLATFORMS = getArgValue("--platforms", { default: "android,ios" }).split(",");
const IOS_PUSH_PROVIDERS = parseArrayArg("--ios-push-providers", { default: ["apn", "fcm"] });
const TESTS_DIRECTORY_PATH = getArgValue("--tests-dir-path", {
  default: path.join(__dirname, "../../__tests__"),
});
const CLEAN_FLAG = isFlagEnabled("--clean", { default: true });

let PREBUILD_CMD = `cd ${APP_PATH} && CI=1 npx expo prebuild`;
if (CLEAN_FLAG) PREBUILD_CMD += " --clean";

// Read Android package name from app.json
function getAndroidPackageFromAppJson() {
  const appJsonPath = path.join(APP_PATH, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      return appJson.expo?.android?.package;
    } catch (error) {
      logMessage(`⚠️ Warning: Failed to read app.json - ${error.message}`, "warning");
    }
  }
  return null;
}

// Returns iOS workspace name by checking /ios for .xcworkspace files or falling back to app.json name
function getIosWorkspaceName(fallback = "App") {
  // Scan the /ios directory for .xcworkspace files
  const iosPath = path.join(APP_PATH, "ios");
  if (fs.existsSync(iosPath)) {
    const workspaces = fs.readdirSync(iosPath).filter((file) => file.endsWith(".xcworkspace"));
    if (workspaces.length > 0) {
      return path.basename(workspaces[0], ".xcworkspace");
    }
  }

  // Fallback to reading the app.json
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

  // Fallback to default name
  return fallback;
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage("🚀 Starting test and build validation for Expo plugin...\n");

  if (PLATFORMS.includes("android")) {
    logMessage("⚙️ Running expo prebuild before Android...");
    runCommand(`${PREBUILD_CMD} --platform=android`);

    logMessage("🧪 Running Android tests...");
    const androidEnvVars = [
      `TEST_APP_PATH=${APP_PATH}`,
      `EXPO_VERSION=${EXPO_VERSION}`,
    ];
    const androidPackageName = getAndroidPackageFromAppJson();
    if (androidPackageName) {
      androidEnvVars.push(`ANDROID_PACKAGE_NAME=${androidPackageName}`);
    }
    const androidTestEnv = androidEnvVars.join(' ');
    runCommand(`${androidTestEnv} npm test -- ${TESTS_DIRECTORY_PATH}/android`);

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
      runScriptWithArgs("compatibility:configure-plugin", {
        args: {
          "app-path": APP_PATH,
          "ios-push-provider": provider,
        },
      });

      logMessage(`⚙️ Running expo prebuild after modifying app.json for ios push provider: ${provider}`);
      runCommand(`${PREBUILD_CMD} --platform=ios`);

      const JEST_TEST_ENV_VALUES = `TEST_APP_PATH=${APP_PATH} TEST_APP_NAME=${getIosWorkspaceName()} EXPO_VERSION=${EXPO_VERSION}`;
      logMessage(`🧪 Running iOS tests for provider: ${provider}`);
      runCommand(`${JEST_TEST_ENV_VALUES} npm test -- ${TESTS_DIRECTORY_PATH}/ios/common ${TESTS_DIRECTORY_PATH}/ios/${provider}`);

      logMessage(`📱 Building iOS project for provider: ${provider}`);
      try {
        // Get correct workspace name for iOS build
        const workspaceName = getIosWorkspaceName();
        runCommand(`cd ${APP_PATH}/ios && xcodebuild \
          -workspace ${workspaceName}.xcworkspace \
          -scheme ${workspaceName} \
          -sdk iphonesimulator \
          -configuration Release build`);
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
