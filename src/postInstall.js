const fs = require('fs');

// react native SDK package.json path
const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;

try {
  // if react native SDK is installed
  if (fs.existsSync(rnPjsonFile)) {
    const rnPJson = fs.readFileSync(rnPjsonFile, 'utf8');
    const pJsonFile = require(`${__dirname}/../package.json`)

    const rnPackage = JSON.parse(rnPJson);
    rnPackage.expoVersion = pJsonFile.version;

    fs.writeFileSync(rnPjsonFile, JSON.stringify(rnPackage, null, 2));
  }
} catch (error) {}
