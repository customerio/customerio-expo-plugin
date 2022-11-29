import { LIB_VERSION } from './../version';
import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptions } from '../types/cio-types';


export const withAnalytics: ConfigPlugin<CustomerIOPluginOptions> = (config) => {
  return withXcodeProject(config, async (props) => {
    const expoVersionSnippet = `"expoVersion": "${LIB_VERSION}"`;
    let versionRegEx = new RegExp(expoVersionSnippet);
    const filename = `node_modules/customerio-reactnative/package.json`;
    if (FileManagement.exists(filename)) {
      const pJsonFile = await FileManagement.read(filename);
      const lines = pJsonFile.split('\n');
      const missingMmatch = pJsonFile.match(versionRegEx);
      const expoVersionRegex = /"expoVersion": ".*"/;
      const existatch = pJsonFile.match(expoVersionRegex);

      if (existatch && !missingMmatch) {
        const index = lines.findIndex((line) =>
          expoVersionRegex.test(line)
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