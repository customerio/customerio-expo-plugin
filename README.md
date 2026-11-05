<p align=center>
  <a href="https://customer.io">
    <img src="https://avatars.githubusercontent.com/u/1152079?s=200&v=4" height="60">
  </a>
</p>

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](code_of_conduct.md)

# Customer.io Expo Plugin

This is the official Customer.io Expo plugin, supporting mobile apps.

The Expo plugin takes advantage of our [React Native SDK](https://github.com/customerio/customerio-reactnative), and requires very little setup. It extends the Expo config to let you customize the pre-build phase of managed workflow builds, which means you don't need to eject to a bare workflow.

After you add the plugin to your project, you'll need to install our React Native SDK and run pre-build. The plugin automatically generates and configures the necessary native code files required to make our React Native SDK to work on your project.

# Getting started

You'll find our [complete SDK documentation at https://customer.io/docs/sdk/expo](https://customer.io/docs/sdk/expo/).

## Visual notification inbox accessibility labels

The SDK ships no text of its own in the visual notification inbox — the empty state is an icon and the loading state is a spinner — so accessibility labels are the one place a string is still needed. Apps supply their own through `inApp.notificationInboxAccessibilityLabels` when they call `CustomerIO.initialize()` from JavaScript:

```ts
CustomerIO.initialize({
  cdpApiKey: '...',
  inApp: {
    siteId: '...',
    notificationInboxAccessibilityLabels: {
      bell: t('inbox.bell'),
      bellWithUnreadCount: t('inbox.unread'), // e.g. "{count} unread notifications"
      loadingIndicator: t('inbox.loading'),
      emptyState: t('inbox.empty'),
    },
  },
});
```

`bellWithUnreadCount` is a template: `{count}` is replaced with the number of unread messages when the bell is announced. Spell it any other way and nothing is substituted, so the screen reader reads the text verbatim, braces included, and never says the count — the SDK warns in the JavaScript console when it spots that. That warning is a development-build diagnostic only — it is compiled out of release builds, so a malformed template ships silently.

**These labels require JavaScript initialization.** With native auto-initialization (a `config` block in the plugin options), the SDK is initialized before JavaScript loads, so a later `CustomerIO.initialize()` call is a no-op and the labels never reach the SDK. They are deliberately not exposed as plugin options: values in `app.json` are baked in at prebuild, which would ship a capability that only works for one locale.

No label falls back to English, but the elements do not all behave the same way when one is unset:

| Unset label | Result |
| --- | --- |
| `bell` | The bell is announced as an unnamed button. |
| `bellWithUnreadCount` | Falls back to `bell`, so the button is still named — only the count goes unannounced. The badge itself is always hidden from screen readers, so the count is only ever spoken through this label. |
| `loadingIndicator` | The spinner stops being an accessibility element: VoiceOver skips it, while TalkBack still reports Android's underlying progress role. |
| `emptyState` | The empty-state icon is hidden from assistive technologies. |

So an auto-initializing app gets no configured labels, which is not the same as every element becoming unlabeled.

## In-app message color scheme

In-app messages follow the device's light or dark appearance by default. An app with its own
appearance setting — one that can disagree with the operating system — tells the SDK which variant
to render with `inApp.colorScheme`:

```ts
import { CioColorScheme, CustomerIO } from 'customerio-reactnative';

CustomerIO.initialize({
  cdpApiKey: '...',
  inApp: {
    siteId: '...',
    colorScheme: CioColorScheme.Dark, // Auto (default) | Light | Dark
  },
});
```

Because an appearance setting can change while the app is running, the scheme can also be changed
at any time:

```ts
CustomerIO.inAppMessaging.setColorScheme(CioColorScheme.Light);
```

That takes effect immediately — messages already on screen, inline views included, are re-themed in
place, so it can be called straight from the app's own appearance toggle.

**Unlike the inbox accessibility labels above, native auto-initialization only affects the config
option, not the setter — provided the plugin config turns in-app on.** With a `config` block in the
plugin options the SDK starts before JavaScript loads, so `inApp.colorScheme` never arrives, while
`setColorScheme()` reaches the already-initialized SDK and works normally. Such an app can
therefore still pin a variant by calling it once after startup.

The plugin adds the in-app messaging module when `config.siteId` is set, or when the key is a
`pk_` public key and `config.inApp.enabled` is `true`. A `pk_` key needs no `siteId` for in-app.
Without either there is no module for either path to reach: the config option is dropped as
above, and the setter logs that in-app messaging is unavailable and leaves the scheme unchanged.

Whichever light and dark variants the message renders come from the Customer.io editor. A message
authored with a single style looks the same under every scheme.

## Scene deep links with native auto-initialization

When using Expo's scene lifecycle with Customer.io native auto-initialization, register your React Native `Linking` URL listener and then call `CustomerIO.setDeepLinkRoutingReady()`. This lets the plugin deliver URLs buffered during cold launch without requiring a second SDK initialization from JavaScript.

Customer.io notification deep links are delivered to that listener as `url` events after readiness; they are not returned by `Linking.getInitialURL()`. If readiness is not signaled within ten seconds, Customer.io falls back to opening the destination through the system.

Expo SDK 58 and later deliver cold-start URLs through `SceneDelegate`, so `handleDeeplinkInKilledState` is not injected for those versions. The scene router replaces that legacy AppDelegate launch-options workaround.

## Acknowledged deep-link handler in Expo scene apps

By default, Expo scene apps receive Customer.io deep links through React Native `Linking`. To use
`CustomerIO.setDeepLinkHandler` instead, enable acknowledged routing:

```json
{
  "ios": {
    "acknowledgedDeepLinkRouting": true
  }
}
```

Then register the handler before calling `CustomerIO.initialize`. With native auto-initialization,
register it when the app starts instead:

```ts
CustomerIO.setDeepLinkHandler(async (url) => {
  await navigateTo(url);
  return true;
});

CustomerIO.initialize(config);
```

Cold-start links wait for the handler instead of going to `Linking`, so links aren't lost when your
navigator mounts after initialization. See the
[React Native SDK README](https://github.com/customerio/customerio-reactnative#-push-notifications)
for handler return values and fallback behavior.

This option requires Expo SDK 58+ and React Native 0.88+. It has no effect on older Expo versions.

## Live Activity links in Expo scene apps

Expo Router apps using the scene lifecycle must process Live Activity URLs once in a top-level
`app/+native-intent.tsx` file:

```ts
import { CustomerIO } from 'customerio-reactnative';

export async function redirectSystemPath({ path }: { path: string }) {
  return CustomerIO.liveActivities.handleWidgetUrl(path);
}
```

The helper reports the opened event and returns the customer's destination before Expo Router
navigates. Ordinary URLs pass through unchanged, and a Customer.io tracking URL without a
destination returns `null`. Do not also call the helper from a `Linking` listener because processing
the same tracking URL twice reports two opened events.

Expo apps without Expo Router should apply the same helper exactly once in their central initial-URL
and URL-subscription pipeline. The plugin does not edit customer-owned routing files.

After disabling Live Notifications in a previously generated iOS project, run `npx expo prebuild --clean --platform ios`. An incremental prebuild stops with this instruction so it cannot leave the generated widget target or linked Live Activities code behind.

## Silent push

A Customer.io silent (background) push shows nothing. It wakes the app and hands your JavaScript
handler the key/value data set on the message. Customer.io sends it to every iOS and Android
device, and an app without a handler ignores it.

Silent push needs Expo SDK 53 or later and a `customerio-reactnative` release with
`setBackgroundPushHandler`. Turn it on in the plugin options:

```json
{
  "backgroundPush": { "enabled": true },
  "config": { "cdpApiKey": "..." },
  "android": { "setHighPriorityPushHandler": true },
  "ios": { "pushNotification": { "provider": "apn" } }
}
```

- `config` (native auto-initialization) is what lets a silent push start an Android app that isn't
  running. Without it, Android apps get silent pushes only while React Native is running, and
  prebuild warns about it. iOS doesn't depend on it.
- iOS needs `ios.pushNotification`. Without it the option does nothing on iOS and prebuild warns.

Then set the handler in your entry file, before the app mounts. When a silent push starts the app
in the background, React Native runs the entry file without rendering anything, so a handler set
in a component never runs. With Expo Router, add an `index.js` and point `main` in `package.json`
at it:

```js
// index.js
import 'expo-router/entry';
import { CustomerIO } from 'customerio-reactnative';

CustomerIO.pushMessaging.setBackgroundPushHandler(async ({ deliveryId, data }) => {
  await refreshInbox(data);
});
```

The SDK waits up to 25 seconds for the returned promise, so keep the work short. The same push can
arrive more than once, so key your work on `deliveryId`. With `autoTrackPushEvents` on (the
default), the SDK tracks Delivered for you. iOS doesn't wake an app the person force-quit.

What the plugin generates:

- **iOS:** adds `remote-notification` to `UIBackgroundModes`, and an
  `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` override in `AppDelegate`
  that hands the push to the Customer.io SDK first. For a Customer.io silent push the SDK runs your
  handler and calls the completion handler once. Every other push goes to `super`, so
  expo-notifications and other libraries receive it as before. If your `AppDelegate` already
  implements the method, the plugin adds the Customer.io check as its first statement.
- **Android:** registers the React Native SDK's silent push callback on the push module in the
  generated `CustomerIOSDKInitializer.kt`. The handler runs in a WorkManager job, so there's no
  service to declare in the manifest.

Turning the option off removes the generated code on the next prebuild. `remote-notification` stays
in `UIBackgroundModes`, because expo-notifications and React Native Firebase use it too.

### Silent push with React Native Firebase

Apps that also use `@react-native-firebase/messaging` pick one of two setups. React Native Firebase
receives Customer.io silent pushes like any other data message, so an app that handles them in both
places runs each push twice.

On Android, each FCM message goes to one `FirebaseMessagingService`: the one whose
`com.google.firebase.MESSAGING_EVENT` intent filter has the highest priority. React Native Firebase
declares its service with the default priority (0). The Customer.io SDK declares its own at -1, and
`android.setHighPriorityPushHandler` overrides that:

| `setHighPriorityPushHandler` | Customer.io service priority | Gets FCM messages |
| --- | --- | --- |
| `true` | default (0), declared in your app's manifest | Customer.io |
| `false` | -10 | React Native Firebase |
| not set | -1, from the SDK | React Native Firebase |

React Native Firebase also reads every FCM message in its own broadcast receiver and passes it to
`messaging().onMessage` or `messaging().setBackgroundMessageHandler`, whichever service wins.

**Customer.io handler.** Turn on `backgroundPush`, set `setHighPriorityPushHandler` to `true` and
set your handler with `setBackgroundPushHandler` as above. Customer.io's service receives the silent
push, tracks Delivered and runs your handler. React Native Firebase's handlers still receive the
same message with its `CIO-Background-*` keys (on Android always, on iOS with the `fcm` provider),
so skip messages that have `CIO-Background-Version` there.

**React Native Firebase handler.** Leave `backgroundPush` off and list `remote-notification` in
`ios.infoPlist.UIBackgroundModes` yourself. Leave `setHighPriorityPushHandler` unset or `false`, keep
forwarding messages to Customer.io, and read your keys from `remoteMessage.data`:

```js
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // Shows nothing for a silent push and tracks Delivered on Android.
  await CustomerIO.pushMessaging.onBackgroundMessageReceived(remoteMessage);
  if (remoteMessage.data?.['CIO-Background-Version']) {
    await refreshInbox(remoteMessage.data);
  }
});
```

React Native Firebase starts `setBackgroundMessageHandler` with a service, which Android allows from
the background only for high-priority messages. Customer.io sends Android silent pushes at normal
priority unless you choose high on the message, so choose high if you rely on this handler.

On iOS, Firebase's app delegate proxy hands each remote notification to React Native Firebase and
to the `AppDelegate` override the plugin generates, then calls the completion handler once after
all of them finish.

# Local development

[Here is a quick start guide to start with local development.](/local-development-readme.md)

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

# License

[MIT](LICENSE)
