const fs = require('fs');
const dotenv = require('dotenv');

const testAppPath = '../test-app';

/**
 * Writes the push provider from local.env into the test app's app.json.
 *
 * This is the only local.env value that belongs in a checked-in config file.
 * The Customer.io plugin version is NOT applied here any more: this script used
 * to rewrite `dependencies` in test-app/package.json at install time, which is
 * exactly what made `npm ci` impossible. `scripts/setup-test-app.sh` now
 * installs the plugin as an explicit step instead.
 */
function updatePushProvider() {
  const pushProvider = process.env.pushProvider;

  if (!pushProvider) {
    return;
  }

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
          './files/GoogleService-Info.plist';
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

// Load the local.env file. A missing file is not an error: local and pull
// request builds legitimately have no local.env and fall back to the locally
// built plugin tarball.
dotenv.config({ path: `${testAppPath}/local.env` });

// `--print-sdk-version` makes this the single parser of local.env for the shell
// too: it prints the requested plugin version (empty when there is none) and
// changes nothing.
if (process.argv.includes('--print-sdk-version')) {
  process.stdout.write(`${process.env.sdkVersion || ''}\n`);
  process.exit(0);
}

updatePushProvider();
