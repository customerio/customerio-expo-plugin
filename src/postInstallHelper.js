const fs = require('fs');

function runPostInstall() {
  // react native SDK package.json path
  const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;
  const expoPjsonFile = `${__dirname}/../package.json`;


      const rnPJson = fs.readFileSync(rnPjsonFile, 'utf8');

      const rnPackage = JSON.parse(rnPJson);
      rnPackage.expoVersion = expoPjsonFile.version;

      fs.writeFileSync(rnPjsonFile, JSON.stringify(rnPackage, null, 2));
}

exports.runPostInstall = runPostInstall;