declare module 'expo-linking' {
  export function addEventListener(
    event: 'url',
    listener: (event: { url: string }) => void
  ): { remove(): void };
  export function getInitialURL(): Promise<string | null>;
}

declare module 'expo-notifications' {
  export const DEFAULT_ACTION_IDENTIFIER: string;

  export type Notification = {
    request: {
      identifier: string;
      content: { data?: Record<string, unknown> };
      trigger: unknown;
    };
  };

  export type NotificationResponse = {
    notification: Notification;
    actionIdentifier: string;
  };

  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void
  ): { remove(): void };
  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void
  ): { remove(): void };
  export function getLastNotificationResponseAsync(): Promise<NotificationResponse | null>;
}

declare module 'expo-modules-core' {
  export function requireNativeModule<T>(name: string): T;
}

declare module 'react-native' {
  export type AppStateStatus =
    | 'active'
    | 'background'
    | 'inactive'
    | 'unknown'
    | 'extension';

  export const AppState: {
    currentState: AppStateStatus | null;
    addEventListener(
      event: 'change',
      listener: (state: AppStateStatus) => void
    ): { remove(): void };
  };
}
