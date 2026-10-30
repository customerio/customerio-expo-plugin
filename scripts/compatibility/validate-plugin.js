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
const {
  readGradleProperty,
  removeKotlinAndroidPlugin,
  setGradleProperties,
} = require("../utils/android-gradle");

const APP_PATH = getArgValue("--app-path", { required: true });
const EXPO_VERSION = getArgValue("--expo-version", { default: 53 })
const PLATFORMS = getArgValue("--platforms", { default: "android,ios" }).split(",");
const IOS_PUSH_PROVIDERS = parseArrayArg("--ios-push-providers", { default: ["apn", "fcm"] });
const TESTS_DIRECTORY_PATH = getArgValue("--tests-dir-path", {
  default: path.join(__dirname, "../../__tests__"),
});
const CLEAN_FLAG = isFlagEnabled("--clean", { default: true });
const ANDROID_AGP9_DEFAULTS = isFlagEnabled("--android-agp9-defaults");

// Optional build narrowing for faster PR validation. Both default to the full
// set, so release and compatibility runs keep building every architecture.
const BUILD_LIST_PATTERN = /^[A-Za-z0-9_,-]+$/;
function getBuildListArg(flag) {
  const value = getArgValue(flag, { default: "" });
  if (value && !BUILD_LIST_PATTERN.test(value)) {
    console.error(`❌ Invalid value for ${flag}: ${value}`);
    process.exit(1);
  }
  return value;
}
const IOS_ARCHS = getBuildListArg("--ios-archs"); // e.g. arm64
const ANDROID_ABIS = getBuildListArg("--android-abis"); // e.g. arm64-v8a

// Expo SDK 58's template opts out of AGP 9's built-in Kotlin and new DSL in
// gradle.properties. `--android-agp9-defaults` migrates the generated app to
// AGP 9's defaults right after prebuild, the way a host dropping that opt-out
// would, to check the app still builds.
const AGP9_DEFAULT_GRADLE_PROPERTIES = {
  "android.builtInKotlin": "true",
  "android.newDsl": "true",
};

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

function androidGradlePropertiesPath() {
  return path.join(APP_PATH, "android", "gradle.properties");
}

// Turns on AGP 9's built-in Kotlin and new DSL in the generated app: sets both
// properties to true and drops the app module's explicit Kotlin Android plugin,
// which built-in Kotlin replaces. Reads both files back to confirm Gradle will
// see the change.
function enableAndroidAgp9Defaults() {
  const gradlePropertiesPath = androidGradlePropertiesPath();
  const appBuildGradlePath = path.join(APP_PATH, "android", "app", "build.gradle");
  fs.writeFileSync(
    gradlePropertiesPath,
    setGradleProperties(fs.readFileSync(gradlePropertiesPath, "utf8"), AGP9_DEFAULT_GRADLE_PROPERTIES),
  );
  fs.writeFileSync(
    appBuildGradlePath,
    removeKotlinAndroidPlugin(fs.readFileSync(appBuildGradlePath, "utf8")),
  );

  const properties = fs.readFileSync(gradlePropertiesPath, "utf8");
  for (const [key, value] of Object.entries(AGP9_DEFAULT_GRADLE_PROPERTIES)) {
    if (readGradleProperty(properties, key) !== value) {
      throw new Error(`gradle.properties: expected ${key}=${value} after the override`);
    }
  }
  const appBuildGradle = fs.readFileSync(appBuildGradlePath, "utf8");
  if (removeKotlinAndroidPlugin(appBuildGradle) !== appBuildGradle) {
    throw new Error("app/build.gradle: the Kotlin Android plugin is still applied");
  }
}

// Logs the AGP 9 opt-out properties the build will use, so each run records which mode it built.
function logAndroidGradleProperties(keys) {
  const contents = fs.readFileSync(androidGradlePropertiesPath(), "utf8");
  for (const key of keys) {
    logMessage(`🔧 gradle.properties: ${key}=${readGradleProperty(contents, key) ?? "(unset)"}`);
  }
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage("🚀 Starting test and build validation for Expo plugin...\n");

  if (PLATFORMS.includes("android")) {
    logMessage("⚙️ Running expo prebuild before Android...");
    runCommand(`${PREBUILD_CMD} --platform=android`);

    if (ANDROID_AGP9_DEFAULTS) {
      logMessage("⚙️ Enabling AGP 9 built-in Kotlin and new DSL...");
      enableAndroidAgp9Defaults();
    }
    logAndroidGradleProperties(Object.keys(AGP9_DEFAULT_GRADLE_PROPERTIES));

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
      const abiArg = ANDROID_ABIS ? ` -PreactNativeArchitectures=${ANDROID_ABIS}` : "";
      runCommand(`cd ${APP_PATH}/android && ./gradlew assembleRelease${abiArg}`);
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
        const archsArg = IOS_ARCHS ? `ARCHS=${IOS_ARCHS}` : "";
        runCommand(`cd ${APP_PATH}/ios && xcodebuild \
          -workspace ${workspaceName}.xcworkspace \
          -scheme ${workspaceName} \
          -sdk iphonesimulator \
          -configuration Release ${archsArg} build`);
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
