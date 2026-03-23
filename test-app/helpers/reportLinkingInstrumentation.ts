import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

const TAG = '[report-repro]';

/** Set true so foreground pushes can show a system banner via expo-notifications (diagnostic). CIO native may still affect presentation. */
const FOREGROUND_SHOW_VIA_EXPO_HANDLER = true;

function cioLinkFromTrigger(
  trigger: Notifications.NotificationTrigger
): string | undefined {
  if (trigger === null || typeof trigger !== 'object') {
    return undefined;
  }
  if (!('payload' in trigger)) {
    return undefined;
  }
  const payload = (trigger as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const cio = (payload as { CIO?: { push?: { link?: string } } }).CIO;
  return cio?.push?.link;
}

/**
 * Mirrors the report’s JS-side investigation: Expo Linking initial URL / URL events
 * plus expo-notifications response + payload (including CIO.push.link).
 * expo-router still provides React Navigation + Expo Linking–compatible routing.
 */
function summarizeNotificationForLog(
  notification: Notifications.Notification
): Record<string, unknown> {
  const { request } = notification;
  const { content, trigger } = request;
  return {
    identifier: request.identifier,
    title: content.title,
    subtitle: content.subtitle,
    body: content.body,
    data: content.data,
    categoryIdentifier: content.categoryIdentifier,
    triggerType:
      trigger && typeof trigger === 'object' && 'type' in trigger
        ? (trigger as { type: string }).type
        : typeof trigger,
    cioPushLink: cioLinkFromTrigger(trigger),
  };
}

export function useReportLinkingInstrumentation(): void {
  useEffect(() => {
    void Notifications.getPermissionsAsync().then((status) => {
      console.log(`${TAG} notification permissions`, status);
    });

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const behavior: Notifications.NotificationBehavior = FOREGROUND_SHOW_VIA_EXPO_HANDLER
          ? {
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }
          : {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };

        console.log(`${TAG} setNotificationHandler.handleNotification (foreground)`, {
          ...summarizeNotificationForLog(notification),
          returnedBehavior: behavior,
          note: FOREGROUND_SHOW_VIA_EXPO_HANDLER
            ? 'Returning banner/list=true so expo-notifications can present in foreground. If no banner still, check native UNUserNotificationCenter delegate (CIO vs Expo).'
            : 'Returning no banner — matches default when handler absent; enable FOREGROUND_SHOW_VIA_EXPO_HANDLER to test JS presentation path.',
        });

        return behavior;
      },
      handleSuccess: (notificationId) => {
        console.log(`${TAG} setNotificationHandler.handleSuccess`, notificationId);
      },
      handleError: (notificationId, error) => {
        console.error(`${TAG} setNotificationHandler.handleError`, notificationId, error);
      },
    });

    void Linking.getInitialURL().then((url) => {
      console.log(`${TAG} Linking.getInitialURL()`, url);
    });

    const urlSub = Linking.addEventListener('url', ({ url }) => {
      console.log(`${TAG} Linking.addEventListener('url')`, url);
    });

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(`${TAG} addNotificationReceivedListener (incoming)`, {
          ...summarizeNotificationForLog(notification),
          note: 'JS received the notification. Foreground UI still depends on setNotificationHandler + native delegate.',
        });
      }
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const link = cioLinkFromTrigger(response.notification.request.trigger);
        console.log(`${TAG} addNotificationResponseReceivedListener`, {
          actionIdentifier: response.actionIdentifier,
          identifier: response.notification.request.identifier,
          cioPushLink: link,
        });
      });

    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        console.log(`${TAG} getLastNotificationResponseAsync (cold start)`, {
          actionIdentifier: last.actionIdentifier,
          cioPushLink: cioLinkFromTrigger(last.notification.request.trigger),
        });
      }
    });

    return () => {
      urlSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);
}
