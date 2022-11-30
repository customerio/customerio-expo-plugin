const fs = require('fs');

function runPostInstall() {
  // react native SDK package.json path
  const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;

    // if react native SDK is installed
    if (fs.existsSync(rnPjsonFile)) {
      const rnPJson = fs.readFileSync(rnPjsonFile, 'utf8');

      const rnPackage = JSON.parse(rnPJson);
      rnPackage.expoVersion = expoVersion.LIB_VERSION;

      fs.writeFileSync(rnPjsonFile, JSON.stringify(rnPackage, null, 2));
    }
}

exports.runPostInstall = runPostInstall;