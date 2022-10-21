import { FileManagement } from '../helpers/utils/fileManagement';


export const injectAnalytics = async () => {
  const filename = `node_modules/customerio-reactnative/package.json`;
  const podfile = await FileManagement.read(filename);
  const lines = podfile.split('\n');
  const match = podfile.match(/"expoVersion": ""/);
  if (match) {
    const index = lines.findIndex((line) =>
      /"expoVersion": ""/.test(line)
    );

    const content = [
      ...lines.slice(0, index - 1),
      `  "expoVersion": "1234",`,
      ...lines.slice(index + 1),
    ];

    FileManagement.write(filename, content.join('\n'));
  }

};
