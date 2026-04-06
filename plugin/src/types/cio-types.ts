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
  /**
   * Controls whether to disable Android 16 support by downgrading androidx dependencies.
   *
   * When true (default for Expo SDK 53), forces older androidx versions compatible with
   * Android API 35 and AGP 8.8.2, preventing Android 16 incompatibility errors.
   *
   * When false (default for Expo SDK 54+), allows newer androidx versions that support Android 16
   * but require Android API 36 and AGP 8.9.1+.
   *
   * If not specified, the plugin auto-detects based on Expo SDK version:
   * - Expo SDK ≤53: true (disables Android 16)
   * - Expo SDK ≥54: false (enables Android 16)
   */
  disableAndroid16Support?: boolean;
};

/**
 * Location tracking mode for the Customer.io SDK location module.
 * Location is off by default. Only used when location is enabled (plugin option location.enabled: true).
 * @public
 */
export type LocationTrackingMode = 'OFF' | 'MANUAL' | 'ON_APP_START';

/**
 * SDK configuration options for auto initialization
 * @public
 */
export type NativeSDKConfig = {
  cdpApiKey: string; // Required
  region?: 'US' | 'EU'; // Default: 'US'. The workspace region set for your workspace on the Customer.io dashboard
  autoTrackDeviceAttributes?: boolean; // Default: true
  trackApplicationLifecycleEvents?: boolean; // Default: true
  screenViewUse?: 'all' | 'inapp'; // Default: 'all'. 'all': sent to server + in-app messages, 'inapp': in-app messages only
  logLevel?: 'none' | 'error' | 'info' | 'debug'; // Default: 'debug'. Controls SDK logging verbosity
  siteId?: string; // Optional, if only siteId defined, migrationSiteId = siteId
  migrationSiteId?: string; // Optional, if only migrationSiteId defined, siteId should be null
  /**
   * Location module config. Location is off by default; only applied when plugin option location.enabled is true.
   * trackingMode: 'MANUAL' (host app controls when location is captured, default),
   * 'ON_APP_START' (SDK captures once per launch when app becomes active), or 'OFF'.
   */
  location?: {
    trackingMode?: LocationTrackingMode;
  };
};

/**
 * Location is off by default. When true, enables the Customer.io SDK location native module (iOS Podfile location subspec,
 * Android gradle.properties flag). Permissions and privacy keys (Info.plist, AndroidManifest)
 * remain the host app's responsibility.
 * @public
 */
export type CustomerIOPluginLocationOptions = {
  enabled?: boolean;
};

/**
 * Combined plugin options for both iOS and Android platforms
 * @public
 */
export type CustomerIOPluginOptions = {
  config?: NativeSDKConfig; // If defined, enables auto initialization of native SDK
  android: CustomerIOPluginOptionsAndroid;
  ios: CustomerIOPluginOptionsIOS;
  /**
   * Location is off by default. When location.enabled is true, the plugin adds SDK build-time setup (Podfile location subspec,
   * gradle.properties). Host apps must add their own location permissions and privacy usage strings.
   */
  location?: CustomerIOPluginLocationOptions;
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

  /**
   * iOS App Group identifier shared between the host app and the Notification Service Extension.
   * When set, `.appGroupId(...)` is injected into the MessagingPushConfigBuilder, the identifier
   * is added to the host app entitlements, and an NSE entitlements file is written.
   * When omitted, the native SDK handles group discovery on its own and no entitlements are added.
   */
  appGroupId?: string;
};
