/**
 * Properties set by the user in their app config file (e.g: app.json or app.plugin.js)
 * @public
 */
export type CustomerIOPluginProperties = {
  // (iOS only) Environment name and bundle identifier
  devTeam: string;
  iosDeploymentTarget: string;
};

/**
 * Plugin options for iOS platform configuration
 * @public
 */
export type CustomerIOPluginOptionsIOS = {
  iosPath: string;
  devTeam?: string;
  bundleVersion?: string;
  bundleShortVersion?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
  appleTeamId?: string;
  appName?: string;

  useFrameworks?: 'static' | 'dynamic';

  pushNotification?: CustomerIOPluginPushNotificationOptions;

  /**
   * @deprecated No longer has any effect. Use autoTrackPushEvents to control if push metrics should be automatically tracked by SDK.
   */
  handleNotificationClick?: boolean;

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

/**
 * Plugin options for Android platform configuration
 * @public
 */
export type CustomerIOPluginOptionsAndroid = {
  androidPath: string;
  googleServicesFile?: string;
  setHighPriorityPushHandler?: boolean;
  pushNotification?: {
    channel?: {
      id?: string;
      name?: string;
      importance?: number;
    };
  };
};

/**
 * SDK configuration options for auto initialization
 * @public
 */
export type NativeSDKConfig = {
  cdpApiKey: string; // Required
  region?: 'US' | 'EU'; // Default: 'US'
  autoTrackDeviceAttributes?: boolean; // Default: true
  trackApplicationLifecycleEvents?: boolean; // Default: true
  screenViewUse?: 'all' | 'inapp'; // Default: 'all', transforms to ScreenView.All/ScreenView.InApp
  logLevel?: 'none' | 'error' | 'info' | 'debug'; // Default: 'debug', transforms to CioLogLevel.NONE/ERROR/INFO/DEBUG
  siteId?: string; // Optional, if only siteId defined, migrationSiteId = siteId
  migrationSiteId?: string; // Optional, if only migrationSiteId defined, siteId should be null
};

/**
 * Combined plugin options for both iOS and Android platforms
 * @public
 */
export type CustomerIOPluginOptions = {
  config?: NativeSDKConfig; // If defined, enables auto initialization of native SDK
  android: CustomerIOPluginOptionsAndroid;
  ios: CustomerIOPluginOptionsIOS;
};

/**
 * Rich push configuration used to initialize Notification Service Extension (NSE) on the native side
 * @public
 */
export type RichPushConfig = {
  cdpApiKey: string;
  region?: string;
};

/**
 * Push notification configuration options
 * @public
 */
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
   * Rich push config should match the values used to initialize SDK in the app.
   * Optional if `config` is provided at the top level.
   */
  env?: RichPushConfig;
};
