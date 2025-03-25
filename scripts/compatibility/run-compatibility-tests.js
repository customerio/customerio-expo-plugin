const path = require("path");
const { getArgValue, logMessage, runCommand, runScriptWithArgs } = require("../utils/cli");

const EXPO_VERSION = getArgValue("--expo-version", { default: "latest" });
const APP_NAME = getArgValue("--app-name", {
  default: `ExpoTest_V${EXPO_VERSION}`.replace(/\./g, ""),
});
const APP_DIR = getArgValue("--dir-name", { default: "ci-test-apps" });
const APP_PATH = path.resolve(__dirname, "../..", APP_DIR, APP_NAME);

logMessage(`🚀 Starting local validation for Expo plugin (Expo ${EXPO_VERSION})...`);
const EXCLUDED_FORWARD_ARGS = ["expo-version", "app-name", "dir-name", "app-path"];

// Step 1: Create Test App
logMessage(`\n🔹 Creating Test App: ${APP_NAME} (Expo ${EXPO_VERSION})...`);
runScriptWithArgs("compatibility:create-test-app", {
  args: {
    "expo-version": EXPO_VERSION,
    "app-name": APP_NAME,
    "dir-name": APP_DIR,
  },
  exclude: EXCLUDED_FORWARD_ARGS,
});

// Step 2: Set Up Test App
logMessage("\n🔹 Setting up Test App...");
runScriptWithArgs("compatibility:setup-test-app", {
  args: {
    "app-path": APP_PATH,
  },
  exclude: EXCLUDED_FORWARD_ARGS,
});

// Step 3: Configure Plugin
logMessage("\n🔹 Configuring Plugin...");
runScriptWithArgs("compatibility:configure-plugin", {
  args: {
    "app-path": APP_PATH,
    "add-default-config": true,
    "ios-use-frameworks": "static",
  },
  exclude: EXCLUDED_FORWARD_ARGS,
});

// Step 4: Validate Plugin
logMessage("\n🔹 Validating Plugin...");
runScriptWithArgs("compatibility:validate-plugin", {
  args: {
    "app-path": APP_PATH,
  },
  exclude: EXCLUDED_FORWARD_ARGS,
});

logMessage(`\n🎉 Expo plugin validation completed successfully! (Expo ${EXPO_VERSION})\n`, "success");
