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
  useFrameworks?: 'static' | 'dynamic';
  pushNotification?: {
    useRichPush: boolean;
  };
};

export type CustomerIOPluginOptionsAndroid = {
  androidPath: string;
  googleServicesFile?: string;
};

export type CustomerIOPluginOptions = {
  android: CustomerIOPluginOptionsAndroid;
  ios: CustomerIOPluginOptionsIOS;
};
