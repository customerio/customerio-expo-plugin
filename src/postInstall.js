const fs = require('fs');

// react native SDK package.json path
const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;

try {
  // if react native SDK is installed
  if (fs.existsSync(rnPjsonFile)) {
    const rnPJson = fs.readFileSync(rnPJsonFile, 'utf8');

    const rnPackage = JSON.parse(rnPJson);
    rnPackage.expoVersion = expoVersion.LIB_VERSION;

    fs.writeFileSync(rnPJsonFile, JSON.stringify(rnPackage, null, 2));
  }
} catch (error) {}
