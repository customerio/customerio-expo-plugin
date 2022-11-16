const fs = require('fs');
const pJsonFile = require('../package.json')

const expoVersionSnippet = `"expoVersion": "${pJsonFile.version}"`;
const versionRegEx = new RegExp(expoVersionSnippet);
const filename = `node_modules/customerio-reactnative/package.json`;
if (fs.existsSync(filename)) {
  const pJsonFile = fs.readFileSync(filename, 'utf8');
  const lines = pJsonFile.split('\n');
  const missingMmatch = pJsonFile.match(versionRegEx);
  const expoVersionRegex = /"expoVersion": ".*"/;
  const existatch = pJsonFile.match(expoVersionRegex);

  if (existatch && !missingMmatch) {
    const index = lines.findIndex((line) => expoVersionRegex.test(line));

    const content = [
      ...lines.slice(0, index),
      `  ${expoVersionSnippet},`,
      ...lines.slice(index + 1),
    ];

    fs.writeFileSync(filename, content.join('\n'), 'utf8');
  }
}
