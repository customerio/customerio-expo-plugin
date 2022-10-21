import { LIB_VERSION } from './../version';
import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';


export const withAnalytics: ConfigPlugin<CustomerIOPluginOptionsIOS> = (config) => {
  return withXcodeProject(config, async (props) => {
    const expoVersionSnippet = `"expoVersion": "${LIB_VERSION}"`;
    let versionRegEx = new RegExp(expoVersionSnippet);
    const filename = `node_modules/customerio-reactnative/package.json`;
    if (FileManagement.exists(filename)) {
      const pJsonFile = await FileManagement.read(filename);
      const lines = pJsonFile.split('\n');
      const match = pJsonFile.match(versionRegEx);

      if (!match) {
        const index = lines.findIndex((line) =>
          /"expoVersion": ".*"/.test(line)
        );

        const content = [
          ...lines.slice(0, index),
          `  ${expoVersionSnippet},`,
          ...lines.slice(index + 1),
        ];

        FileManagement.write(filename, content.join('\n'));
      }
    }

    return props;
  });
  };
