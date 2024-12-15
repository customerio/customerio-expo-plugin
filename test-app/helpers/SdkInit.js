import {
  CioLogLevel,
  CioRegion,
  CustomerIO,
  PushClickBehaviorAndroid,
} from "customerio-reactnative";
import Constants from "expo-constants";

export function initializeCioSdk() {
  console.log("Extras config: " + Constants.expoConfig);
  const cdpApiKey = Constants.expoConfig?.extra?.cdpApiKey || "Failed to load!";
  const siteId = Constants.expoConfig?.extra?.siteId || "Failed to load!";

  const config = {
    cdpApiKey: cdpApiKey,
    region: CioRegion.US,
    logLevel: CioLogLevel.Debug,
    trackApplicationLifecycleEvents: true,
    inApp: {
      siteId: siteId,
    },
    push: {
      android: {
        pushClickBehavior: PushClickBehaviorAndroid.ResetTaskStack,
      },
    },
  };

  CustomerIO.initialize(config);
}
