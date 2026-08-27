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

## Scene deep links with native auto-initialization

When using Expo's scene lifecycle with Customer.io native auto-initialization, register your React Native `Linking` URL listener and then call `CustomerIO.setDeepLinkRoutingReady()`. This lets the plugin deliver URLs buffered during cold launch without requiring a second SDK initialization from JavaScript.

Customer.io notification deep links are delivered to that listener as `url` events after readiness; they are not returned by `Linking.getInitialURL()`. If readiness is not signaled within ten seconds, Customer.io falls back to opening the destination through the system.

Expo SDK 58 and later deliver cold-start URLs through `SceneDelegate`, so `handleDeeplinkInKilledState` is not injected for those versions. The scene router replaces that legacy AppDelegate launch-options workaround.

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

# Local development

[Here is a quick start guide to start with local development.](/local-development-readme.md)

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

# License

[MIT](LICENSE)
