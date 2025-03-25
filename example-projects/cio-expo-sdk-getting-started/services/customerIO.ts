import { CioConfig, CioPushPermissionStatus, CioRegion, CustomerIO } from "customerio-reactnative";

let initialized = false;

export async function initialize(): Promise<void> {
  if (initialized) return;

  const config: CioConfig = {
    cdpApiKey: process.env.EXPO_PUBLIC_CDP_API_KEY as string, // Replace with your CDP API key
    region: CioRegion.US,
    inApp: {
      siteId: process.env.EXPO_PUBLIC_SITE_ID as string, // Replace with your site ID
    },
  };

  try {
    await CustomerIO.initialize(config);
    initialized = true;
    console.log('CustomerIO SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize CustomerIO SDK:', error);
    throw error;
  }
}

export async function identifyUser(userId: string, traits: Record<string, any>): Promise<void> {
  try {
    await CustomerIO.identify({ userId, traits });
  } catch (error) {
    console.error('Failed to identify user:', error);
    throw error;
  }
}

export async function trackEvent(eventName: string, attributes: Record<string, any>): Promise<void> {
  try {
    await CustomerIO.track(eventName, attributes);
  } catch (error) {
    console.error('Failed to track event:', error);
    throw error;
  }
}

export async function clearUser(): Promise<void> {
  try {
    await CustomerIO.clearIdentify();
  } catch (error) {
    console.error('Failed to clear user:', error);
    throw error;
  }
}

export async function requestPushPermission(): Promise<void> {
  const options = { ios: { sound: true, badge: true } };
  try {
    const status = await CustomerIO.pushMessaging.showPromptForPushNotifications(options);
    switch (status) {
      case CioPushPermissionStatus.Granted:
        console.log('Push notifications are now enabled on this device');
        break;
      case CioPushPermissionStatus.Denied:
      case CioPushPermissionStatus.NotDetermined:
        console.log('Push notifications are denied on this device. Please allow notification permission from settings to receive push on this device');
        break;
    }
  } catch (error) {
    console.error('Unable to request permission. Check console for error', error);
    throw error;
  }
}
