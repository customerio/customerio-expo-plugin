import { FileManagement } from '../helpers/utils/fileManagement';


export const injectAnalytics = async () => {
  const filename = `node_modules/customerio-reactnative/package.json`;
  const podfile = await FileManagement.read(filename);
  const lines = podfile.split('\n');
  const match = podfile.match(/"version": "1.0.0-beta.2"/);
  if (match) {
    const index = lines.findIndex((line) =>
      /"version": "1.0.0-beta.2"/.test(line)
    );

    const content = [
      ...lines.slice(0, index),
      `  "version": "1234",`,
      ...lines.slice(index),
    ];

    FileManagement.write(filename, content.join('\n'));
  }

};
