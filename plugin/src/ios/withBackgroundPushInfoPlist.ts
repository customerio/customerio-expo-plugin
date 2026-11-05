import type { ConfigPlugin, InfoPlist } from '@expo/config-plugins';
import { withInfoPlist } from '@expo/config-plugins';

export const REMOTE_NOTIFICATION_BACKGROUND_MODE = 'remote-notification';

/**
 * Adds `remote-notification` to `UIBackgroundModes`, keeping the modes the app already lists.
 *
 * iOS only wakes an app for a silent push (`content-available: 1`) when this mode is listed.
 * Nothing removes it: expo-notifications and React Native Firebase add the same mode, so the plugin
 * can't tell whether it is the only thing that needs it.
 */
export const applyBackgroundPushInfoPlist = (plist: InfoPlist): InfoPlist => {
  const existing = Array.isArray(plist.UIBackgroundModes)
    ? (plist.UIBackgroundModes as string[])
    : [];
  if (!existing.includes(REMOTE_NOTIFICATION_BACKGROUND_MODE)) {
    plist.UIBackgroundModes = [...existing, REMOTE_NOTIFICATION_BACKGROUND_MODE];
  }
  return plist;
};

export const withBackgroundPushInfoPlist: ConfigPlugin = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults = applyBackgroundPushInfoPlist(cfg.modResults);
    return cfg;
  });
