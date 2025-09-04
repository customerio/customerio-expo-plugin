import { CustomerIO, InAppMessageEventType } from 'customerio-reactnative';

export function registerInAppMessagingEventListener() {
  const logInAppEvent = (name, params) => {
    console.log(`[ExpoInAppEventListener] onEventReceived: ${name}, params: `, params);
  };

  const onInAppEventReceived = (eventName, eventParams) => {
    logInAppEvent(eventName, eventParams);

    const { deliveryId, messageId, actionValue, actionName } = eventParams;
    const data = {
      'event-name': eventName,
      'delivery-id': deliveryId ?? 'NULL',
      'message-id': messageId ?? 'NULL'
    };
    if (actionName) {
      data['action-name'] = actionName;
    }
    if (actionValue) {
      data['action-value'] = actionValue;
    }

    CustomerIO.track('ExpoInAppEventListener', data);
  };

  const inAppMessagingSDK = CustomerIO.inAppMessaging;
  const inAppEventListener = inAppMessagingSDK.registerEventsListener((event) => {
    switch (event.eventType) {
      case InAppMessageEventType.messageShown:
        onInAppEventReceived('messageShown', event);
        break;

      case InAppMessageEventType.messageDismissed:
        onInAppEventReceived('messageDismissed', event);
        break;

      case InAppMessageEventType.errorWithMessage:
        onInAppEventReceived('errorWithMessage', event);
        break;

      case InAppMessageEventType.messageActionTaken:
        onInAppEventReceived('messageActionTaken', event);
        // Dismiss in app message if the action is 'dismiss' or 'close'
        if (event.actionValue === 'dismiss' || event.actionValue === 'close') {
          inAppMessagingSDK.dismissMessage();
        }
        break;

      default:
        onInAppEventReceived('unsupported event', event);
    }
  });

  // Remove listener once unmounted
  return () => {
    inAppEventListener.remove();
  };
}
