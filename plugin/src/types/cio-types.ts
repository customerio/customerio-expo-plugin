// properties set by the user in their app config file (e.g: app.json or app.plugin.js)
export type CustomerIOPluginProperties = {
  // (iOS only) Environment name and bundle identifier
  devTeam: string;
  iosDeploymentTarget: string;
};

// Plugin options for pre-build
export type CustomerIOPluginOptionsIOS = {
  iosPath: string;
  devTeam?: string;
  bundleVersion?: string;
  bundleShortVersion?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
  appleTeamId?: string;
  appName?: string;

  /**
   * @deprecated No longer has any effect. Use autoTrackPushEvents to control if push metrics should be automatically tracked by SDK.
   */
  handleNotificationClick?: boolean;

  useFrameworks?: 'static' | 'dynamic';

  env: {
    cdpApiKey: string;
    region: string;
  };

  pushNotification?: CustomerIOPluginPushNotificationOptions;

  /**
   * @deprecated Property will be removed in the future. Use ios.pushNotification.autoFetchDeviceToken instead
   */
  autoFetchDeviceToken?: boolean;

  /**
   * @deprecated Property will be removed in the future. Use ios.pushNotification.showPushAppInForeground instead
   */
  showPushAppInForeground?: boolean;

  /**
   * @deprecated Property will be removed in the future. Use ios.pushNotification.autoTrackPushEvents instead
   */
  autoTrackPushEvents?: boolean;

  /**
   * @deprecated Property will be removed in the future. Use ios.pushNotification.handleDeeplinkInKilledState instead
   */
  handleDeeplinkInKilledState?: boolean;

  /**
   * @deprecated Property will be removed in the future. Use ios.pushNotification.disableNotificationRegistration instead
   */
  disableNotificationRegistration?: boolean;
};

export type CustomerIOPluginOptionsAndroid = {
  androidPath: string;
  googleServicesFile?: string;
  setHighPriorityPushHandler?: boolean;
};

export type CustomerIOPluginOptions = {
  android: CustomerIOPluginOptionsAndroid;
  ios: CustomerIOPluginOptionsIOS;
};

export type CustomerIOPluginPushNotificationOptions = {
  provider?: 'apn' | 'fcm';
  googleServicesFile?: string;
  useRichPush?: boolean;
  autoFetchDeviceToken?: boolean;
  autoTrackPushEvents?: boolean;
  showPushAppInForeground?: boolean;
  disableNotificationRegistration?: boolean;
  handleDeeplinkInKilledState?: boolean;

  /**
   * @deprecated Property will be removed in the future. Use ios.env instead of ios.pushNotification.env.
   */
  env?: {
    cdpApiKey: string;
    region: string;
  };
};
