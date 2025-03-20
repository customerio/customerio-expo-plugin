const fs = require("fs");
const path = require("path");
const { getArgValue, isFlagEnabled, logMessage, runCommand, runScript } = require("../utils/cli");

const EXPO_VERSION = getArgValue("--expo-version", { required: true });
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
  const RESOLVED_EXPO_TEMPLATE =
    EXPO_VERSION === "latest" ? EXPO_TEMPLATE : `${EXPO_TEMPLATE}@sdk-${EXPO_VERSION}`;
  runCommand(
    `cd ${APP_DIRECTORY_PATH} && npx create-expo-app '${APP_NAME}' --template ${RESOLVED_EXPO_TEMPLATE}`,
  );
  logMessage("✅ Expo app created successfully!", "success");
}

runScript(execute);
