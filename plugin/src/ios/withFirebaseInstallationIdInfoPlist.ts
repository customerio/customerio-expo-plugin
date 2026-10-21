import type { ConfigPlugin, InfoPlist } from '@expo/config-plugins';
import { withInfoPlist } from '@expo/config-plugins';

import type {
  CustomerIOPluginFirebaseInstallationIdOptions,
  CustomerIOPluginOptionsIOS,
} from '../types/cio-types';
import { logger } from '../utils/logger';

export const FIREBASE_INSTALLATION_ID_PLIST_KEY =
  'FirebaseMessagingInstallationIdEnabled';

export const applyFirebaseInstallationIdInfoPlist = (
  plist: InfoPlist,
  enabled: boolean
): InfoPlist => {
  if (enabled) {
    plist[FIREBASE_INSTALLATION_ID_PLIST_KEY] = true;
  } else {
    delete plist[FIREBASE_INSTALLATION_ID_PLIST_KEY];
  }
  return plist;
};

/**
 * Sets the Firebase Installation ID opt-in key in the host Info.plist when enabled with the FCM provider.
 * An explicit `enabled: false` removes the key; a missing option leaves the Info.plist untouched.
 */
export const withFirebaseInstallationIdInfoPlist: ConfigPlugin<{
  firebaseInstallationId?: CustomerIOPluginFirebaseInstallationIdOptions;
  iosOptions?: CustomerIOPluginOptionsIOS;
}> = (config, { firebaseInstallationId, iosOptions }) => {
  const enabled = firebaseInstallationId?.enabled;
  if (enabled === undefined) {
    return config;
  }

  if (enabled && iosOptions?.pushNotification?.provider !== 'fcm') {
    logger.warn(
      "firebaseInstallationId.enabled is ignored on iOS: it requires ios.pushNotification.provider 'fcm'."
    );
    return config;
  }

  return withInfoPlist(config, (cfg) => {
    cfg.modResults = applyFirebaseInstallationIdInfoPlist(cfg.modResults, enabled);
    return cfg;
  });
};
