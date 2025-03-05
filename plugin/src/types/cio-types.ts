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
  disableNotificationRegistration?: boolean;
  /**
   * @deprecated No longer has any effect. Use autoTrackPushEvents to control if push metrics should be automatically tracked by SDK.
   */
  handleNotificationClick?: boolean;
  showPushAppInForeground?: boolean;
  autoTrackPushEvents?: boolean;
  handleDeeplinkInKilledState?: boolean;
  useFrameworks?: 'static' | 'dynamic';
  pushNotification?: {
    provider?: 'apn' | 'fcm';
    googleServicesFile?: string;
    useRichPush: boolean;
    env: {
      cdpApiKey: string;
      region: string;
    };
  };
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
