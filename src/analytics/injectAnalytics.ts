import { FileManagement } from '../helpers/utils/fileManagement';


export const injectAnalytics = async () => {
  const filename = `node_modules/customerio-reactnative/package.json`;
  const podfile = await FileManagement.read(filename);
  const lines = podfile.split('\n');
  const match = podfile.match(/"version": "1234"/);

  if (!match) {
    console.log('matched')
    const index = lines.findIndex((line) =>
      /"version": "1.0.0-beta.2"/.test(line)
    );
    console.log(index)

    const content = [
      ...lines.slice(0, index),
      `  "version": "1234",`,
      ...lines.slice(index + 1),
    ];
    console.log(content)

    FileManagement.write(filename, content.join('\n'));
  }

};
