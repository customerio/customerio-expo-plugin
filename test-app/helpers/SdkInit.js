import {
  CioLogLevel,
  CioRegion,
  CustomerIO,
  PushClickBehaviorAndroid,
} from "customerio-reactnative";
import Constants from "expo-constants";

export function initializeCioSdk() {
  const cdpApiKey = Constants.expoConfig.extra.cdpApiKey;
  const siteId = Constants.expoConfig.extra.siteId;

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
