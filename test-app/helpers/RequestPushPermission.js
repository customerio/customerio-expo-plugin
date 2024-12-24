import { CustomerIO, CioPushPermissionStatus } from "customerio-reactnative";

export function requestPermissionForPush() {
  let options = { ios: { sound: true, badge: true } };
  CustomerIO.pushMessaging
    .showPromptForPushNotifications(options)
    .then((status) => {
      switch (status) {
        case CioPushPermissionStatus.Granted:
          alert(`Push notifications are now enabled on this device`);
          break;

        case CioPushPermissionStatus.Denied:
        case CioPushPermissionStatus.NotDetermined:
          alert(
            `Push notifications are denied on this device. Please allow notification permission from settings to receive push on this device`
          );
          break;
      }
    })
    .catch((error) => {
      alert(`Unable to request permission. Check console for error`);
      console.error(error);
    });
}
