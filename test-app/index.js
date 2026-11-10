import { CustomerIO } from "customerio-reactnative";
import "expo-router/entry";

// Set here rather than in a component: a silent push can start the app without mounting it. The
// tracked event shows QA in the workspace that the handler ran.
CustomerIO.pushMessaging.setBackgroundPushHandler(async ({ deliveryId, data }) => {
  console.log(`[CIO] Silent push ${deliveryId}`, data);
  CustomerIO.track("Silent push received", { deliveryId, ...data });
});
