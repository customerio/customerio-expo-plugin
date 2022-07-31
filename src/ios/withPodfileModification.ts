import { withDangerousMod } from '@expo/config-plugins';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { CustomerIOPluginOptions } from '../types/cio-types';

// Modify Podfile in ios folder
export function withCustomerIOPod(config, props: CustomerIOPluginOptions) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const { platformProjectRoot } = cfg.modRequest;
      const podfile = resolve(platformProjectRoot, 'Podfile');
      const contents = readFileSync(podfile, 'utf-8');
      const lines = contents.split('\n');
      const index = lines.findIndex((line) =>
        /\s+use_react_native!/.test(line),
      );

      const content = [
        ...lines.slice(0, index),
        `  pod 'RCT-Folly', :podspec => '../node_modules/react-native/third-party-podspecs/RCT-Folly.podspec'`,
        `  pod 'boost', :podspec => '../node_modules/react-native/third-party-podspecs/boost.podspec'`,
        `  pod 'CustomerIOMessagingPushAPN', :podspec => 'https://raw.githubusercontent.com/customerio/customerio-ios/1.1.1/CustomerIOMessagingPushAPN.podspec'`,
        ...lines.slice(index),
      ].join('\n');

      writeFileSync(podfile, content);

      return cfg;
    },
  ]);
}
