import type { ConfigPlugin } from '@expo/config-plugins';
import { withInfoPlist } from '@expo/config-plugins';

/**
 * Sets `NSSupportsLiveActivities` to `true` in the host app's Info.plist so iOS
 * allows the app to start Live Activities. Applied only when Live Activities are
 * enabled via `ios.liveActivity.enabled`.
 */
export const withLiveActivityInfoPlist: ConfigPlugin = (config) => {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true;
    return cfg;
  });
};
