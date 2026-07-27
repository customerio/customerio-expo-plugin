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
  /**
   * Live Notifications config. Its presence enables the feature; there is no
   * separate `enabled` flag to set when you use auto initialization.
   */
  liveNotifications?: LiveNotificationsSDKConfig;
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
  /**
   * Live Notifications build-time setup. Only needed for apps that initialize the SDK from
   * JavaScript — with auto initialization, `config.liveNotifications` turns the feature on by
   * itself.
   */
  liveNotifications?: CustomerIOPluginLiveNotificationsOptions;
};

/**
 * Live Notifications build-time setup, off by default. When enabled the plugin sets
 * `NSSupportsLiveActivities` in the host Info.plist, adds the `liveactivities` pod subspec to the
 * host app, and injects a WidgetKit app-extension target that renders the SDK's built-in Live
 * Activity templates. Requires iOS 16.2+. Android needs no build-time setup.
 *
 * A custom (app-defined) template is rendered by that same generated target: name it with
 * {@link LiveNotificationsSDKConfig.customType} and hand the plugin your SwiftUI file with
 * {@link CustomerIOPluginLiveNotificationsOptions.customWidget}. You don't need a widget target of
 * your own.
 * @public
 */
export type CustomerIOPluginLiveNotificationsOptions = {
  /**
   * Turn on Live Notifications build-time setup (iOS widget extension, the
   * `NSSupportsLiveActivities` Info.plist key, and the Podfile subspec).
   *
   * Only needed when you initialize the SDK from JavaScript. With auto
   * initialization, `config.liveNotifications` implies this and you can omit it.
   */
  enabled?: boolean;
  /**
   * The SwiftUI that renders your custom activity type on iOS.
   *
   * Lives here rather than under `config.liveNotifications` because it is purely build-time —
   * a source file to compile into the generated widget extension and a struct to instantiate in
   * its `WidgetBundle`. It has no runtime meaning, and keeping it here is what makes it usable
   * whether you initialize the SDK automatically or from JavaScript.
   *
   * The activity's identifier is separate and belongs to SDK config: set
   * `config.liveNotifications.customType` for automatic initialization, or pass it to
   * `CustomerIO.initialize` when you initialize from JavaScript.
   */
  customWidget?: LiveNotificationCustomWidget;
};

/**
 * Reverse-DNS identifiers for the built-in Live Notification activity types.
 *
 * These are the same strings both native SDKs and the backend use, so a type
 * listed here matches what Customer.io sends as `notificationType`.
 * @public
 */
export const LIVE_NOTIFICATION_TYPES = {
  segments: 'io.customer.livenotifications.segments',
  countdownTimer: 'io.customer.livenotifications.countdowntimer',
} as const;

/**
 * Branding applied to every Live Notification template.
 *
 * The `logo` and colors are baked into the generated iOS widget at prebuild and
 * passed to the Android SDK at initialization, so one block covers both
 * platforms. Android renders `accentColorHex`; iOS renders all three colors.
 * @public
 */
export type LiveNotificationBranding = {
  /** Brand name. Reserved for future templates; not rendered today. */
  companyName?: string;
  /**
   * Logo image: either a path relative to your project root
   * (e.g. `./assets/brand-logo.png`) or an `http(s)` URL.
   *
   * A local path is copied into the Android drawables and the iOS widget's
   * asset catalog. A URL is downloaded at render time on Android and is **not
   * supported on iOS**, where the widget is compiled ahead of time.
   */
  logo?: string;
  /** Lock-screen background color as `#RRGGBB`. iOS only. */
  backgroundColorHex?: string;
  /** Primary text color as `#RRGGBB`. iOS only. */
  textColorHex?: string;
  /** Accent color as `#RRGGBB`. Android notification tint; iOS progress fill. */
  accentColorHex?: string;
};

/**
 * The SwiftUI that renders your custom Live Activity, compiled into the widget extension the
 * plugin generates. Required alongside {@link LiveNotificationsSDKConfig.customType} — without it
 * the widget has nothing to draw for that type.
 *
 * Write a plain WidgetKit widget over the SDK's `CIOCustomAttributes` (shipped by the native iOS
 * SDK, so there is no extra pod to add and no attributes type for you to define):
 *
 * ```swift
 * import CioLiveActivities_Attributes
 * import SwiftUI
 * import WidgetKit
 *
 * struct RideshareLiveActivity: Widget {
 *     var body: some WidgetConfiguration {
 *         ActivityConfiguration(for: CIOCustomAttributes.self) { context in
 *             Text(context.state.data["status"] ?? "")
 *         } dynamicIsland: { _ in DynamicIsland { } }
 *     }
 * }
 * ```
 *
 * Both a path and a name are needed because the plugin never parses Swift: it copies the file into
 * the widget target and instantiates `structName` in the generated `WidgetBundle`.
 * @public
 */
export type LiveNotificationCustomWidget = {
  /**
   * Path to your SwiftUI file, relative to the project root (e.g.
   * `'./ios-widgets/RideshareLiveActivity.swift'`), or absolute.
   *
   * Pass an array when the widget spans several files; all of them are compiled into the widget
   * extension. They are copied into one directory, so their file names must be unique and must not
   * collide with the files the plugin generates there.
   */
  sourceFile: string | string[];
  /**
   * Name of the `Widget` struct to instantiate in the generated `WidgetBundle`, e.g.
   * `'RideshareLiveActivity'`.
   */
  structName: string;
};

/**
 * Live Notifications (Android) / Live Activities (iOS) configuration applied at
 * SDK initialization. Its presence enables the feature — you don't also need
 * `liveNotifications.enabled`.
 * @public
 */
export type LiveNotificationsSDKConfig = {
  /**
   * Built-in activity types to enable, as reverse-DNS identifiers (see
   * {@link LIVE_NOTIFICATION_TYPES}). Each one is registered for push-to-start
   * and rendered by the generated iOS widget.
   *
   * Unrecognized identifiers are ignored with a warning, so a template added in
   * a newer SDK can't break a build on an older plugin.
   */
  types?: string[];
  /** Branding shared by every built-in template. Your `customWidget` styles itself. */
  branding?: LiveNotificationBranding;
  /**
   * Your own reverse-DNS identifier for a custom activity type, e.g. `'com.myapp.rideshare'`.
   * Setting it enables the custom template on both platforms: iOS registers the SDK's
   * `CIOCustomAttributes` under this name — which is what gives a custom activity push-to-start
   * and metrics — and Android allowlists it for its render callback.
   *
   * Singular by design: iOS resolves an activity's type from its Swift attributes type, and every
   * custom activity shares one. A second identifier could not be told apart, so one identifier is
   * the limit rather than a silent mis-attribution.
   *
   * On iOS, pair it with the top-level `liveNotifications.customWidget`; that SwiftUI is what
   * renders the activity.
   */
  customType?: string;
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
