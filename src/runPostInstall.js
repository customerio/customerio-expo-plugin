const fs = require('fs');

function runPostInstall() {
  const pJsonFile = require(`${__dirname}/../package.json`);

  // regex for current expoVersion
  const expoVersionSnippet = `"expoVersion": "${pJsonFile.version}"`;
  const versionRegEx = new RegExp(expoVersionSnippet);

  // react native SDK package.json path
  const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;

  // if react native SDK is installed
  if (fs.existsSync(rnPjsonFile)) {
    try {
      const rnPJson = fs.readFileSync(rnPJsonFile, 'utf8');

      const rnPackage = JSON.parse(rnPJson);
      rnPackage.expoVersion = expoVersion.LIB_VERSION;

      fs.writeFileSync(rnPJsonFile, JSON.stringify(rnPackage, null, 2));
    } catch (error) {}
  }
}


exports.runPostInstall = runPostInstall;