const fs = require('fs');

function runPostInstall() {
  // react native SDK package.json path
  const reactNativePackageJsonFile = `${__dirname}/../../../customerio-reactnative/package.json`;
  const expoPackageJsonFile = `${__dirname}/../../package.json`;
  try {
    // if react native SDK is installed
    if (fs.existsSync(reactNativePackageJsonFile)) {
      const reactNativePackageJson = fs.readFileSync(reactNativePackageJsonFile, 'utf8');
      const expoPackageJson = require(expoPackageJsonFile);

      const reactNativePackage = JSON.parse(reactNativePackageJson);
      reactNativePackage.expoVersion = expoPackageJson.version;

      fs.writeFileSync(reactNativePackageJsonFile, JSON.stringify(reactNativePackage, null, 2));
    }
  } catch (error) {}
}

exports.runPostInstall = runPostInstall;