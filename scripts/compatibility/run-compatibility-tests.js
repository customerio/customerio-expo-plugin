const path = require("path");
const { getArgValue, logMessage, runCommand } = require("../utils/cli");

const EXPO_VERSION = getArgValue("--expo-version", { default: "latest" });
const APP_NAME = getArgValue("--app-name", { default: `ExpoTest_V${EXPO_VERSION}`.replace(/\./g, "") });
const APP_DIR = getArgValue("--dir-name", { default: "ci-test-apps" });
const APP_PATH = path.resolve(__dirname, "../..", APP_DIR, APP_NAME);

logMessage(`🚀 Starting local validation for Expo plugin (Expo ${EXPO_VERSION})...`);

// Step 1: Create Test App
logMessage(`\n🔹 Creating Test App: ${APP_NAME} (Expo ${EXPO_VERSION})...`);
runCommand(`npm run compatibility:create-test-app -- \
  --expo-version=${EXPO_VERSION} \
  --app-name=${APP_NAME} \
  --dir-name=${APP_DIR}`);

// Step 2: Set Up Test App
logMessage("\n🔹 Setting up Test App...");
runCommand(`npm run compatibility:setup-test-app -- --app-path=${APP_PATH}`);

// Step 3: Configure Plugin
logMessage("\n🔹 Configuring Plugin...");
runCommand(`npm run compatibility:configure-plugin -- --app-path=${APP_PATH}`);

// Step 4: Validate Plugin
logMessage("\n🔹 Validating Plugin...");
runCommand(`npm run compatibility:validate-plugin -- --app-path=${APP_PATH}`);

logMessage(`\n🎉 Expo plugin validation completed successfully! (Expo ${EXPO_VERSION})\n`, "success");
