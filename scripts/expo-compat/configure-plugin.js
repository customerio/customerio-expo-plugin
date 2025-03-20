const fs = require("fs");
const path = require("path");
const {
  getArgValue,
  isFlagEnabled,
  logMessage,
  parseKeyValueArgs,
  runScript,
} = require("../utils/cli");
const { CUSTOMER_IO_EXPO_PLUGIN_NAME } = require("../utils/constants");

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

// Parse additional configurations for plugin using special prefix to avoid conflicts with other Expo plugins
// e.g. --cio-config.android.setHighPriorityPushHandler=true --cio-config.ios.pushNotification.env.cdpApiKey=123
const EXPO_PLUGIN_PREFIX = "cio-config.";
const EXPO_PLUGIN_CONFIGS = Object.fromEntries(
  Object.entries(parseKeyValueArgs(process.argv.slice(2)))
    .filter(([key]) => key.startsWith(EXPO_PLUGIN_PREFIX))
    .map(([key, value]) => [key.replace(EXPO_PLUGIN_PREFIX, ""), value]),
);

/**
 * Updates nested properties in an object.
 * @param {Object} obj - The object to update.
 * @param {Array} keys - The keys representing the nested property.
 * @param {any} value - The value to set.
 */
function updateNestedProperty(obj, keys, value) {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {}; // Ensure structure exists
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Finds or adds a plugin to the plugins array.
 * @param {Array} plugins - The plugins array.
 * @param {string} pluginName - The name of the plugin.
 * @param {Object} defaultConfig - The default configuration for the plugin.
 * @returns {number} - The index of the plugin in the array.
 */
function findOrAddPlugin(plugins, pluginName, defaultConfig = {}) {
  const index = plugins.findIndex((plugin) => Array.isArray(plugin) && plugin[0] === pluginName);
  if (index !== -1) return index;
  plugins.push([pluginName, defaultConfig]);
  return plugins.length - 1;
}

/**
 * Main entry point for the script to handle the execution logic.
 */
function execute() {
  logMessage(`🚀 Starting configuration for ${CUSTOMER_IO_EXPO_PLUGIN_NAME} plugin...\n`);

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
    delete cioPluginConfig.ios?.googleServicesFile;
  }

  if (IOS_PUSH_PROVIDER) {
    cioPluginConfig.ios.pushNotification.provider = IOS_PUSH_PROVIDER;
    if (IOS_PUSH_PROVIDER === "fcm") {
      cioPluginConfig.ios.pushNotification.googleServicesFile = IOS_GOOGLE_SERVICES_FILE_PATH;
    }
  } else {
    delete cioPluginConfig.ios.pushNotification.provider;
  }

  // Step 5: Manage expo-build-properties
  const expoBuildPropsDependency = "expo-build-properties";
  logMessage(`🔧 Managing ${expoBuildPropsDependency}...`);
  const buildPropsIndex = appJson.expo.plugins.findIndex(
    (plugin) => Array.isArray(plugin) && plugin[0] === expoBuildPropsDependency,
  );

  if (IOS_USE_FRAMEWORKS) {
    cioPluginConfig.ios.useFrameworks = IOS_USE_FRAMEWORKS;
    if (buildPropsIndex === -1) {
      appJson.expo.plugins.push([
        expoBuildPropsDependency,
        { ios: { useFrameworks: IOS_USE_FRAMEWORKS } },
      ]);
    } else {
      appJson.expo.plugins[buildPropsIndex][1].ios.useFrameworks = IOS_USE_FRAMEWORKS;
    }
  } else if (buildPropsIndex !== -1) {
    delete cioPluginConfig.ios?.useFrameworks;
    delete appJson.expo.plugins[buildPropsIndex][1]?.ios?.useFrameworks;
    if (Object.keys(appJson.expo.plugins[buildPropsIndex][1].ios).length === 0) {
      appJson.expo.plugins.splice(buildPropsIndex, 1);
    }
  }

  // Step 6: Apply additional key-value arguments
  logMessage("🔧 Applying additional configurations...");
  Object.entries(EXPO_PLUGIN_CONFIGS).forEach(([key, value]) => {
    updateNestedProperty(cioPluginConfig, key.split("."), value);
  });

  // Step 7: Write updated app.json back to file
  fs.writeFileSync(APP_JSON_FILE_PATH, JSON.stringify(appJson, null, 2) + "\n");
  logMessage("✅ Successfully updated app.json", "success");
}

runScript(execute);
