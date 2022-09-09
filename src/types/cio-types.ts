// properties set by the user in their app config file (e.g: app.json or app.plugin.js)
export type CustomerIOPluginProperties = {
  // (iOS only) Environment name and bundle identifier
  mode: Mode;
  devTeam: string;
  iosDeploymentTarget: string;
};

// Plugin options for pre-build
export type CustomerIOPluginOptionsIOS = {
  iosPath: string;
  mode: Mode;
  devTeam?: string;
  bundleVersion?: string;
  bundleShortVersion?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
};

export type CustomerIOPluginOptionsAndroid = {
  androidPath: string;
  googleServicesFilePath?: string;
};

export enum Mode {
  Dev = 'development',
  Prod = 'production',
}
