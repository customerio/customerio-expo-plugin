import Constants from "expo-constants";
import { CustomerIO } from "customerio-reactnative";

// Customer.io silent pushes. A silent push shows nothing: it wakes the app and hands this handler
// the data set on the message. Build with BACKGROUND_PUSH=true (see app.config.js) so the plugin
// wires the native side. BACKGROUND_PUSH=app sets no handler here, like an app that handles silent
// pushes with React Native Firebase.
//
// Imported for its side effect from index.js rather than set in a component, because when a silent
// push starts the app in the background, React Native runs the entry file without mounting the app.
//
// customerio-reactnative releases before silent push don't have setBackgroundPushHandler, so this
// is a no-op there.
const pushMessaging = CustomerIO.pushMessaging;
const handler = Constants.expoConfig?.extra?.backgroundPushHandler;
if (handler === "customerio" && typeof pushMessaging.setBackgroundPushHandler === "function") {
  pushMessaging.setBackgroundPushHandler(async ({ deliveryId, data }) => {
    console.log(`[CIO] Silent push ${deliveryId}`, data);
    // An event in the workspace's activity log shows QA the handler ran, including when the push
    // started the app in the background.
    CustomerIO.track("Silent push received", { deliveryId, ...data });
  });
}
