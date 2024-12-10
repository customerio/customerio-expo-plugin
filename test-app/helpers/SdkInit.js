import {
  CioLogLevel,
  CioRegion,
  CustomerIO,
  PushClickBehaviorAndroid,
} from "customerio-reactnative";

export function initializeCioSdk() {
  const config = {
    cdpApiKey: "YourApiKey",
    region: CioRegion.US,
    logLevel: CioLogLevel.Debug,
    trackApplicationLifecycleEvents: true,
    inApp: {
      siteId: "YourSiteId",
    },
    push: {
      android: {
        pushClickBehavior: PushClickBehaviorAndroid.ResetTaskStack,
      },
    },
  };

  CustomerIO.initialize(config);
}
