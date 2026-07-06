import type { ConfigPlugin } from '@expo/config-plugins';
import { withDangerousMod } from '@expo/config-plugins';
import path from 'path';

import { FileManagement } from '../helpers/utils/fileManagement';
import { injectPrereleasePodfileOverride } from '../helpers/utils/prereleaseNativeSdk';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

/**
 * TEMP (pre-release native SDKs). Repoints the CustomerIO iOS SDK at the branch configured in
 * prereleaseNativeSdk.ts. Runs after the CustomerIO Podfile block is written, so it only appends
 * the override. Revert together with the Android counterpart and the customerio-reactnative
 * git dependency once the native SDK ships.
 */
export const withPrereleaseNativeSdkPodfile: ConfigPlugin<
  CustomerIOPluginOptionsIOS | undefined
> = (config, props) =>
  withDangerousMod(config, [
    'ios',
    async (dangerousConfig) => {
      const podfilePath = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'Podfile'
      );
      const podfile = await FileManagement.read(podfilePath);
      const next = injectPrereleasePodfileOverride(
        podfile,
        isFcmPushProvider(props)
      );
      if (next !== podfile) {
        await FileManagement.write(podfilePath, next);
      }
      return dangerousConfig;
    },
  ]);
