const fs = require('fs');

// import current package.json
const pJsonFile = require(`${__dirname}/../package.json`)

// regex for current expoVersion
const expoVersionSnippet = `"expoVersion": "${pJsonFile.version}"`;
const versionRegEx = new RegExp(expoVersionSnippet);

// react native SDK package.json path
const rnPjsonFile = `${__dirname}/../../customerio-reactnative/package.json`;

// if react native SDK is installed
if (fs.existsSync(rnPjsonFile)) {
  try {
    // read react native SDK package.json
    const rnPJson = readFileSync(rnPjsonFile, 'utf8');

    const rnPackage = JSON.parse(rnPJson);
    rnPackage.expoVersion = pJsonFile.version;

    writeFileSync(rnPjsonFile, JSON.stringify(rnPackage, null, 2));
  } catch (error) {
    console.error(error)
  }
}
