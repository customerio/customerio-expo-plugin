import { CustomerIO, InAppMessageEventType } from 'customerio-reactnative';

export function registerInAppMessagingEventListener() {
  CustomerIO.inAppMessaging.registerEventsListener((event) => {
    switch (event.eventType) {
      case InAppMessageEventType.messageShown:
        console.log('EXPO-TEST: In App message shown');
        break;
      case InAppMessageEventType.messageDismissed:
        console.log('EXPO-TEST: In App message dismissed');
        break;
      case InAppMessageEventType.errorWithMessage:
        console.log('EXPO-TEST: In App error showing message');
        break;
      case InAppMessageEventType.messageActionTaken:
        console.log(
          'EXPO-TEST: Message action taken'
        );
        break;
    }
  });
}
