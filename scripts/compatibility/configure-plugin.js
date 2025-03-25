const fs = require("fs");
const path = require("path");
const {
  getArgValue,
  isFlagEnabled,
  logMessage,
  parseArgsAsObject,
  runScript,
  setNestedProperty,
} = require("../utils/cli");
const { CUSTOMER_IO_EXPO_PLUGIN_NAME, EXPO_BUILD_PROPERTIES_PLUGIN } = require("../utils/constants");

const APP_PATH = getArgValue("--app-path", { required: true });
const ANDROID_GOOGLE_SERVICES_FILE_PATH = getArgValue("--android-google-services", {
  default: "./cio-artifacts/google-services.json",
});
const IOS_GOOGLE_SERVICES_FILE_PATH = getArgValue("--ios-google-services", {
  default: "./cio-artifacts/GoogleService-Info.plist",
});
const IOS_PUSH_PROVIDER = getArgValue("--ios-push-provider");
const ADD_DEFAULT_CONFIG = isFlagEnabled("--add-default-config");
const IOS_USE_FRAMEWORKS = getArgValue("--ios-use-frameworks", {
  default: IOS_PUSH_PROVIDER === "fcm" ? "static" : undefined,
});
const APP_JSON_FILE_PATH = path.join(APP_PATH, "app.json");

const PLUGIN_ABBREVIATIONS = {
  [CUSTOMER_IO_EXPO_PLUGIN_NAME]: "cio-plugin",
  [EXPO_BUILD_PROPERTIES_PLUGIN]: "expo-build-props",
};

// Parse additional configurations for plugin using special prefix to avoid conflicts with other Expo plugins
// e.g. --cio-plugin.android.setHighPriorityPushHandler=true --expo-build-props.ios.deploymentTarget=15.1
function getPluginConfigFromCliPrefix(pluginName) {
  const prefix = PLUGIN_ABBREVIATIONS[pluginName];
  if (!prefix) {
    logMessage(`❌ Missing CLI prefix for plugin: ${pluginName}`, "error");
    process.exit(1);
  }

  const fullPrefix = `${prefix}.`; // e.g. "cio." or "bp."
  const keyValues = parseArgsAsObject();

  const configEntries = Object.entries(keyValues)
    .filter(([key]) => key.startsWith(fullPrefix))
    .map(([key, value]) => [key.replace(fullPrefix, ""), value]);

  return Object.fromEntries(configEntries);
}

// Finds or adds a plugin to the plugins array.
function findOrAddPlugin(plugins, pluginName, defaultConfig = {}) {
  const index = plugins.findIndex(
    (plugin) => (Array.isArray(plugin) && plugin[0] === pluginName) || plugin === pluginName,
  );

  if (index !== -1) {
    // If found as a string, replace it with an array format
    if (typeof plugins[index] === "string") {
      plugins[index] = [pluginName, defaultConfig];
    }
    return index;
  }

  // Otherwise, add the plugin in the correct array format
  plugins.push([pluginName, defaultConfig]);
  return plugins.length - 1;
}

// Checks if an object is empty or contains only nested empty objects.
function isObjectEmpty(obj) {
  return (
    Object.keys(obj).length === 0 ||
    Object.values(obj).every((value) => typeof value === "object" && isObjectEmpty(value))
  );
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage(`🚀 Configuring ${CUSTOMER_IO_EXPO_PLUGIN_NAME} plugin...\n`);

  // Step 1: Read and parse app.json
  logMessage("🔄 Reading and parsing app.json...");
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_FILE_PATH, "utf8"));
  if (!appJson.expo?.plugins) {
    throw new Error("❌ Missing `expo.plugins` in app.json.");
  }

  // Step 2: Find or add Customer.io plugin
  logMessage("🔍 Finding or adding Customer.io plugin...");
  const cioPluginIndex = findOrAddPlugin(appJson.expo.plugins, CUSTOMER_IO_EXPO_PLUGIN_NAME, {});
  const cioPluginConfig = appJson.expo.plugins[cioPluginIndex][1];

  // Step 3: Add default configurations if flag is set
  if (ADD_DEFAULT_CONFIG) {
    logMessage("🔧 Adding default configurations...", "debug");
    Object.assign(cioPluginConfig, {
      android: {
        googleServicesFile: ANDROID_GOOGLE_SERVICES_FILE_PATH,
        setHighPriorityPushHandler: true,
      },
      ios: {
        pushNotification: {
          useRichPush: true,
          env: {
            cdpApiKey: "dummy-cdp-api-key",
            region: "us",
          },
        },
      },
    });
  }

  // Step 4: Handle iOS push provider and frameworks
  if (IOS_PUSH_PROVIDER !== "fcm") {
    delete cioPluginConfig.ios?.pushNotification?.googleServicesFile;
  }

  if (IOS_PUSH_PROVIDER) {
    setNestedProperty(cioPluginConfig, "ios.pushNotification.provider", IOS_PUSH_PROVIDER);
    if (IOS_PUSH_PROVIDER === "fcm") {
      setNestedProperty(cioPluginConfig, "ios.pushNotification.googleServicesFile", IOS_GOOGLE_SERVICES_FILE_PATH);
    }
  } else {
    delete cioPluginConfig.ios?.pushNotification?.provider;
  }

  // Step 5: Manage expo-build-properties
  logMessage(`🔧 Managing ${EXPO_BUILD_PROPERTIES_PLUGIN}...`);
  const buildPropsIndex = findOrAddPlugin(appJson.expo.plugins, EXPO_BUILD_PROPERTIES_PLUGIN, {});
  const buildPropsConfig = appJson.expo.plugins[buildPropsIndex][1];

  if (IOS_USE_FRAMEWORKS) {
    setNestedProperty(cioPluginConfig, "ios.useFrameworks", IOS_USE_FRAMEWORKS);
    setNestedProperty(buildPropsConfig, "ios.useFrameworks", IOS_USE_FRAMEWORKS);
  } else {
    delete cioPluginConfig.ios?.useFrameworks;
    delete buildPropsConfig.ios?.useFrameworks;
  }

  // Step 6: Apply additional plugin-specific configurations
  logMessage("🔧 Applying additional configurations...");
  const cioAdditionalConfig = getPluginConfigFromCliPrefix(CUSTOMER_IO_EXPO_PLUGIN_NAME);
  Object.entries(cioAdditionalConfig).forEach(([key, value]) => {
    setNestedProperty(cioConfig, key, value);
  });
  const buildPropsAdditionalConfig = getPluginConfigFromCliPrefix(EXPO_BUILD_PROPERTIES_PLUGIN);
  Object.entries(buildPropsAdditionalConfig).forEach(([key, value]) => {
    setNestedProperty(buildPropsConfig, key, value);
  });

  // If buildPropsConfig is empty after updates, revert it to a string entry
  if (isObjectEmpty(buildPropsConfig)) {
    logMessage(
      `🗑️ Reverting ${EXPO_BUILD_PROPERTIES_PLUGIN} plugin to a string entry as configuration is empty.`,
      "warning",
    );
    appJson.expo.plugins[buildPropsIndex] = EXPO_BUILD_PROPERTIES_PLUGIN; // Convert back to a string
  }

  // Step 7: Write updated app.json back to file
  fs.writeFileSync(APP_JSON_FILE_PATH, JSON.stringify(appJson, null, 2) + "\n");
  logMessage("✅ Successfully updated app.json", "success");
}

runScript(execute);
