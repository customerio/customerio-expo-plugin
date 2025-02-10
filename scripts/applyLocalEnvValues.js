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
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated ${packageJsonPath} with local.env values!`);
