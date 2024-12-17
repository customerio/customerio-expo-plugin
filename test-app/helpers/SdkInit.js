import {
  CioLogLevel,
  CioRegion,
  CustomerIO,
} from "customerio-reactnative";
import Constants from "expo-constants";

export function initializeCioSdk() {
  console.log("Expo config: " + Constants.expoConfig);
  const cdpApiKey = Constants.expoConfig?.extra?.cdpApiKey || "Failed to load!";
  const siteId = Constants.expoConfig?.extra?.siteId || "Failed to load!";

  const config = {
    cdpApiKey: cdpApiKey,
    region: CioRegion.US,
    logLevel: CioLogLevel.Debug,
    migrationSiteId: siteId,
    inApp: {
      siteId: siteId,
    },
  };

  CustomerIO.initialize(config);
}
