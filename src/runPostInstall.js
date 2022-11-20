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
      // read react native SDK package.json
      const rnPJson = fs.readFileSync(rnPjsonFile, 'utf8');

      // split react native SDK package.json lines into array
      const lines = rnPJson.split('\n');
      const missingMmatch = rnPJson.match(versionRegEx);
      const expoVersionRegex = /"expoVersion": ".*"/;
      const existatch = rnPJson.match(expoVersionRegex);

      // check if expoVersion key exists in current package and it has not been set already
      if (existatch && !missingMmatch) {
        const index = lines.findIndex((line) => expoVersionRegex.test(line));

        // set react native SDK expoVersion to current version in expo plugin package
        const content = [
          ...lines.slice(0, index),
          `  ${expoVersionSnippet},`,
          ...lines.slice(index + 1),
        ];

        // save react native SDK package.json file
        fs.writeFileSync(rnPjsonFile, content.join('\n'), 'utf8');
      }
    } catch (error) {}
  }
}


exports.runPostInstall = runPostInstall;