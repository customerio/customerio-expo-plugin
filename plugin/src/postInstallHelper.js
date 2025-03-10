const fs = require('fs');

// Read the required version from our own package.json
const getRequiredVersion = () => {
  try {
    const expoPluginPackage = require(`${__dirname}/../../package.json`);
    return expoPluginPackage.dependencies["customerio-reactnative"];
  } catch (error) {
    console.warn("Error reading required customerio-reactnative version:", error);
    return null;
  }
};

function runPostInstall() {
  // Get the version from our package.json
  const REQUIRED_VERSION = getRequiredVersion();
  
  // react native SDK package.json paths - check both locations
  // First check if it's installed as a direct dependency of the project
  let reactNativePackageJsonFile = `${__dirname}/../../../customerio-reactnative/package.json`;
  let isCustomerInstalledVersion = false;
  
  // If not found as direct dependency, check if it's installed as our dependency
  if (!fs.existsSync(reactNativePackageJsonFile)) {
    reactNativePackageJsonFile = `${__dirname}/../../node_modules/customerio-reactnative/package.json`;
  } else {
    isCustomerInstalledVersion = true;
  }
  
  const expoPackageJsonFile = `${__dirname}/../../package.json`;
  
  try {
    // if react native SDK is found in either location
    if (fs.existsSync(reactNativePackageJsonFile)) {
      const reactNativePackageJson = fs.readFileSync(
        reactNativePackageJsonFile,
        'utf8'
      );
      const expoPackageJson = require(expoPackageJsonFile);

      const reactNativePackage = JSON.parse(reactNativePackageJson);
      
      // Check version if customer installed it directly
      if (isCustomerInstalledVersion && REQUIRED_VERSION && reactNativePackage.version !== REQUIRED_VERSION) {
        console.warn(
          `⚠️ WARNING: You have customerio-reactnative version ${reactNativePackage.version} installed directly in your project, ` +
          `but customerio-expo-plugin provides version ${REQUIRED_VERSION}. ` +
          `This may cause unexpected behavior. We recommend either:\n` +
          `  1. Remove customerio-reactnative from your direct dependencies and let the plugin provide it, or\n` +
          `  2. Make sure your version matches the one required by the plugin (${REQUIRED_VERSION}).`
        );
      }
      
      reactNativePackage.expoVersion = expoPackageJson.version;

      fs.writeFileSync(
        reactNativePackageJsonFile,
        JSON.stringify(reactNativePackage, null, 2)
      );
      
      console.log('Successfully updated customerio-reactnative package.json with expo version.');
    } else {
      console.warn(
        'Could not find customerio-reactnative package.json file. The SDK should be included as a dependency of this plugin.'
      );
    }
  } catch (error) {
    console.warn(
      'Error while updating customerio-reactnative package.json file.',
      error
    );
  }
}

exports.runPostInstall = runPostInstall;