const fs = require("fs");
const path = require("path");
const { getArgValue, logMessage, parseArrayArg, runCommand, runScript, setNestedProperty } = require("../utils/cli");
const {
  CUSTOMER_IO_EXPO_PLUGIN_NAME,
  CUSTOMER_IO_REACT_NATIVE_SDK_NAME,
  EXPO_BUILD_PROPERTIES_PLUGIN,
} = require("../utils/constants");

const APP_PATH = getArgValue("--app-path", { required: true });

const APP_NAME = path.basename(APP_PATH);
const DEFAULT_APPLICATION_ID = `com.test.${APP_NAME.toLowerCase().replace(/[-_]/g, "")}`;
// Use consistent package for testing to ensure snapshot tests pass
const TEST_APP_PACKAGE_NAME = 'io.customer.testbed.expo';

const ANDROID_PACKAGE_NAME = getArgValue("--android-package", { default: TEST_APP_PACKAGE_NAME });
const IOS_BUNDLE_IDENTIFIER = getArgValue("--ios-bundle-id", { default: DEFAULT_APPLICATION_ID });
const GOOGLE_SERVICES_SOURCE_PATH = getArgValue("--google-services");
const APP_JSON_FILE_PATH = path.join(APP_PATH, "app.json");

const APP_ARTIFACTS_DIR_NAME = getArgValue("--artifacts-dir-name", { default: "cio-artifacts" });
const APP_ARTIFACTS_DIR_PATH = path.join(APP_PATH, APP_ARTIFACTS_DIR_NAME);

// Get additional dependencies to install
const ADDITIONAL_DEPENDENCIES = parseArrayArg("--dependencies");

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage("🚀 Starting Expo test app setup...\n");

  // Step 1: Ensure the artifacts directory exists
  logMessage(`📂 Ensuring artifacts directory exists: ${APP_ARTIFACTS_DIR_PATH}`);
  if (!fs.existsSync(APP_ARTIFACTS_DIR_PATH)) {
    fs.mkdirSync(APP_ARTIFACTS_DIR_PATH, { recursive: true });
  }

  // Step 2: Generate and copy the latest plugin tarball to the artifacts directory
  const PLUGIN_TGZ_DEPENDENCY_NAME = `${CUSTOMER_IO_EXPO_PLUGIN_NAME}-latest.tgz`;
  const PLUGIN_TGZ_DEPENDENCY_PATH = path.join(APP_ARTIFACTS_DIR_NAME, PLUGIN_TGZ_DEPENDENCY_NAME);
  const PLUGIN_TGZ_DEPENDENCY = `${CUSTOMER_IO_EXPO_PLUGIN_NAME}@file:${PLUGIN_TGZ_DEPENDENCY_PATH}`;

  logMessage(`📦 Generating latest plugin tarball: ${PLUGIN_TGZ_DEPENDENCY_NAME}`);
  runCommand(`./scripts/create-plugin-tarball.sh .`);

  logMessage(`📦 Copying plugin package: ${PLUGIN_TGZ_DEPENDENCY_NAME} to ${APP_ARTIFACTS_DIR_PATH}`);
  runCommand(`cp ${PLUGIN_TGZ_DEPENDENCY_NAME} ${APP_ARTIFACTS_DIR_PATH}`);

  // Define dependencies including the local plugin package
  const DEFAULT_DEPENDENCIES = [EXPO_BUILD_PROPERTIES_PLUGIN, PLUGIN_TGZ_DEPENDENCY, CUSTOMER_IO_REACT_NATIVE_SDK_NAME];

  // Step 3: Install required dependencies
  logMessage("📦 Installing default dependencies...");
  try {
    // Install default dependencies and any additional dependencies
    const dependencies = [...DEFAULT_DEPENDENCIES, ...ADDITIONAL_DEPENDENCIES];
    runCommand(`cd ${APP_PATH} && npm install ${dependencies.join(" ")}`);
  } catch (error) {
    logMessage(`❌ Error installing default dependencies: ${error.message}`, "error");
    process.exit(1);
  }

  // Step 4: Update app.json with correct package names
  logMessage("🔄 Updating app.json with correct package names...");
  try {
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_FILE_PATH, "utf8"));

    setNestedProperty(appJson, "expo.android.package", ANDROID_PACKAGE_NAME);
    setNestedProperty(appJson, "expo.ios.bundleIdentifier", IOS_BUNDLE_IDENTIFIER);
    setNestedProperty(appJson, "expo.ios.entitlements", { "aps-environment": "development" });

    fs.writeFileSync(APP_JSON_FILE_PATH, JSON.stringify(appJson, null, 2) + "\n");
  } catch (error) {
    logMessage(`❌ Error updating ${APP_JSON_FILE_PATH}: ${error.message}`, "error");
  }

  // Step 5: Handle Google services configuration
  logMessage("📂 Setting up Google service files...");

  if (GOOGLE_SERVICES_SOURCE_PATH) {
    logMessage("📂 Copying provided Google services file...");
    fs.copyFileSync(
      GOOGLE_SERVICES_SOURCE_PATH,
      path.join(APP_ARTIFACTS_DIR_PATH, path.basename(GOOGLE_SERVICES_SOURCE_PATH)),
    );
  } else {
    logMessage("📂 Creating default Google services files...");
    fs.writeFileSync(
      path.join(APP_ARTIFACTS_DIR_PATH, "google-services.json"),
      `{
    "project_info": {
      "project_number": "1234567890",
      "project_id": "test-project",
      "storage_bucket": "test-project.appspot.com",
      "firebase_url": "https://test-project.firebaseio.com"
    },
    "client": [{
      "client_info": {
        "mobilesdk_app_id": "1:1234567890:android:abcdef123456",
        "android_client_info": {
          "package_name": "${ANDROID_PACKAGE_NAME}"
        }
      },
      "api_key": [{ "current_key": "test-api-key" }]
    }]
  }`,
    );

    fs.writeFileSync(
      path.join(APP_ARTIFACTS_DIR_PATH, "GoogleService-Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>BUNDLE_ID</key>
      <string>${IOS_BUNDLE_IDENTIFIER}</string>
      <key>GOOGLE_APP_ID</key>
      <string>1:1234567890:ios:abcdef123456</string>
      <key>GCM_SENDER_ID</key>
      <string>1234567890</string>
      <key>API_KEY</key>
      <string>test-api-key</string>
      <key>CLIENT_ID</key>
      <string>1234567890-abcdefg.apps.googleusercontent.com</string>
    </dict>
  </plist>`,
    );
  }

  // Step 6: Run npx expo install
  logMessage("🚀 Running npx expo install...");
  try {
    runCommand(`cd ${APP_PATH} && npx expo install --fix`);
  } catch (error) {
    logMessage(`❌ Error running npx expo install: ${error.message}`, "error");
    process.exit(1);
  }

  logMessage("✅ App setup and dependency installation completed successfully!", "success");
}

runScript(execute);
