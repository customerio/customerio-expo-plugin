const fs = require('fs');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

function installPluginTarball() {
  try {
    console.log('Running update-dependency.sh...');
    execSync('bash ../scripts/install-plugin-tarball.sh ..', {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(
      'Error executing the install-plugin-tarball.sh script:',
      error.message
    );
    process.exit(1);
  }
}

function updateSdkVersion() {
  // Read the version from local.env
  const expoPluginVersion = process.env.sdkVersion;
  const cioExpoPackageName = 'customerio-expo-plugin';

  const packageJsonPath = `${testAppPath}/package.json`;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (expoPluginVersion) {
    if (
      packageJson.dependencies &&
      packageJson.dependencies[cioExpoPackageName]
    ) {
      packageJson.dependencies[cioExpoPackageName] = expoPluginVersion;
      console.log(
        `Updated ${cioExpoPackageName} to version ${expoPluginVersion}`
      );
    }
  } else {
    console.log(
      'No Expo plugin version found in local.env. Using local tarball...'
    );
    installPluginTarball();
  }

  // Write the updated package.json back
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n'
  );

  console.log(`Updated ${packageJsonPath} with local.env values!`);
}

function updatePushProvider() {
  const pushProvider = process.env.pushProvider;

  if (!pushProvider) {
    return;
  }

  const testAppPath = '../test-app';
  const appJsonPath = `${testAppPath}/app.json`;
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  // Find the "customerio-expo-plugin" in plugins array
  const plugins = appJson.expo.plugins || [];
  const customerioPlugin = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'customerio-expo-plugin'
  );

  if (customerioPlugin) {
    const pluginConfig = customerioPlugin[1];

    if (pluginConfig.ios && pluginConfig.ios.pushNotification) {
      if (pushProvider === 'fcm') {
        // Update the provider value to "fcm"
        pluginConfig.ios.pushNotification.provider = 'fcm';
        pluginConfig.ios.pushNotification.googleServicesFile =
          './files/google-services.json';
        console.log("Successfully updated provider to 'fcm'");
      } else {
        pluginConfig.ios.pushNotification.provider = 'apn';
        console.log("Successfully updated provider to 'apn'");
      }
    } else {
      console.error("'pushNotification' key not found in iOS config.");
    }
  } else {
    console.error(
      "'customerio-expo-plugin' not found in app.json, cannot update push provider config!"
    );
  }

  // Save the updated app.json
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log('Updated app.json successfully.');
}

const testAppPath = '../test-app';

// Load the local.env file
const envConfig = dotenv.config({ path: `${testAppPath}/local.env` });

if (envConfig.error) {
  console.log(
    'No Expo plugin version found in local.env. Using local tarball...'
  );
  installPluginTarball();
  process.exit(0); // Exit without error
}

updatePushProvider();
updateSdkVersion();
