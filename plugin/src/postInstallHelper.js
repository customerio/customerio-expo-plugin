const fs = require('fs');
const path = require('path');
const findPackageJson = require('find-package-json');

// Get required SDK version from peer dependencies
function getRequiredSDKVersion() {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = require(packageJsonPath);
    return packageJson.peerDependencies['customerio-reactnative'];
  } catch (error) {
    console.warn('Could not determine required SDK version:', error);
    return null;
  }
}

// Get the required version
const REQUIRED_SDK_VERSION = getRequiredSDKVersion();

function runPostInstall() {
  // Find the app's root package.json
  const f = findPackageJson(process.cwd());
  const appPackageJson = f.next().value;
  
  if (!appPackageJson) {
    console.warn('Could not locate application package.json');
    return;
  }
  
  // Check if customerio-reactnative is installed and has correct version
  const dependencies = {
    ...appPackageJson.dependencies,
    ...appPackageJson.devDependencies
  };
  
  // If not installed or wrong version, warn the user with specific messaging
  if (!dependencies['customerio-reactnative']) {
    console.warn('\x1b[33m%s\x1b[0m', 
      `Warning: customerio-reactnative is not installed. Please install version ${REQUIRED_SDK_VERSION || 'specified in peer dependencies'} with: npm install customerio-reactnative${REQUIRED_SDK_VERSION ? `@${REQUIRED_SDK_VERSION}` : ''}`
    );
  } else if (REQUIRED_SDK_VERSION) {
    const version = dependencies['customerio-reactnative'].replace(/[\^~]/, '');
    if (version !== REQUIRED_SDK_VERSION) {
      console.warn('\x1b[33m%s\x1b[0m', 
        `Warning: customerio-expo-plugin requires customerio-reactnative ${REQUIRED_SDK_VERSION}, but found ${version}. Please update it.`
      );
    }
  }
  
  // Update expoVersion in the SDK package.json
  try {
    // Use the original path resolution to maintain compatibility
    const reactNativePackageJsonFile = `${__dirname}/../../../customerio-reactnative/package.json`;
    const expoPackageJsonFile = `${__dirname}/../../package.json`;
    
    // Fallback to node_modules path if the original path doesn't exist
    const fallbackPath = path.resolve(process.cwd(), 'node_modules/customerio-reactnative/package.json');
    
    // Determine which path to use
    let packageJsonPath = fs.existsSync(reactNativePackageJsonFile) 
      ? reactNativePackageJsonFile 
      : (fs.existsSync(fallbackPath) ? fallbackPath : null);
    
    if (packageJsonPath) {
      const reactNativePackageJson = fs.readFileSync(packageJsonPath, 'utf8');
      const expoPackageJson = require(expoPackageJsonFile);

      const reactNativePackage = JSON.parse(reactNativePackageJson);
      reactNativePackage.expoVersion = expoPackageJson.version;

      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(reactNativePackage, null, 2)
      );
      
      console.log('Successfully updated customerio-reactnative package with expo plugin version');
      
      // If we've made it this far, do one final version check
      if (REQUIRED_SDK_VERSION && reactNativePackage.version !== REQUIRED_SDK_VERSION) {
        console.warn('\x1b[33m%s\x1b[0m', 
          `Warning: customerio-expo-plugin requires customerio-reactnative ${REQUIRED_SDK_VERSION}, but the installed version is ${reactNativePackage.version}.`
        );
      }
    } else {
      console.warn('Could not locate customerio-reactnative package.json file.');
    }
  } catch (error) {
    console.warn(
      'Unable to find customerio-reactnative package.json file. Please make sure you have installed the customerio-reactnative package.',
      error
    );
  }
}

exports.runPostInstall = runPostInstall;