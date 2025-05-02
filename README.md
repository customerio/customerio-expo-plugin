<p>
  <a href="https://customer.io">
    <img src="https://avatars.githubusercontent.com/u/1152079?s=200&v=4" height="60">
  </a>
</p>

[![npm version](https://img.shields.io/npm/v/customerio-expo-plugin.svg)](https://www.npmjs.com/package/customerio-expo-plugin)
[![npm downloads](https://img.shields.io/npm/dm/customerio-expo-plugin)](https://www.npmjs.com/package/customerio-expo-plugin)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)

# Customer.io Expo Plugin

This is the official Customer.io Expo plugin, supporting mobile apps.

The Expo plugin takes advantage of our [React Native SDK](https://github.com/customerio/customerio-reactnative), and requires very little setup. It extends the Expo config to let you customize the pre-build phase of managed workflow builds where you do not make changes to the native codebase, which means you don't need to eject to a bare workflow where you have to make changes to the native codebase.

# Getting started

You'll find our [complete SDK documentation at https://customer.io/docs/sdk/expo](https://customer.io/docs/sdk/expo/), but here's a quick start guide to get you up and running. You can also find an example project [here](/example-projects/cio-expo-sdk-getting-started).

### Table of Contents
1. [Base Setup](#base-setup)
2. [Identify and Track](#identify-and-track)
3. [Push Notifications](#push-notifications)
4. [In-App](#in-app)

### Base Setup

1. Install the Customer.io SDK and Expo plugin and run the expo prebuild command to generate the native files:

```bash
npx expo install customerio-reactnative customerio-expo-plugin
```
You currently must also add the push notification options to your `app.json` file to build the native files, even if you don't use push notifications in your app. See [Push Notifications](#push-notifications) for more information.
```bash
npx expo prebuild
```

2. Add the CDP API key and site ID to your `.env` file. Login into your [Customer.io Dashboard](https://fly.customer.io/), to get your CDP API key and site ID.

```
EXPO_PUBLIC_CDP_API_KEY=<CDP API KEY>
EXPO_PUBLIC_SITE_ID=<SITE ID>
```

3. Ensure the SDK is initialized in your app. You can call the `initialize` method from your components or services. We recommend initializing the SDK in the `useEffect` hook of your main component or layout file.
```typescript
import { CioConfig, CustomerIO } from "customerio-reactnative";

useEffect(() => {
  const initializeCustomerIO = async () => {
    const config: CioConfig = {
      cdpApiKey: process.env.EXPO_PUBLIC_CDP_API_KEY ?? '',
      // Optionally, you can enable in-app messaging by adding the site ID
      inApp: {
        siteId: process.env.EXPO_PUBLIC_SITE_ID ?? '',
      }
    };
    await CustomerIO.initialize(config);
  };
  initializeCustomerIO();
}, []);
```

4. To run your application you will need to run the native app with `npx expo run:ios` or `npx expo run:android` instead of using the dev server via `npx expo start`. This is because the plugin needs to build the native files to be able to send push notifications and in-app messages.


### Identify and Track

1. Identify a user in your app using the `CustomerIO.identify` method:

```typescript
import { CustomerIO } from "customerio-reactnative";

const identifyUserExample = async () => {
  await CustomerIO.identify({
    userId: 'expo-test-user@example.com',
    traits: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'expo-test-user@example.com',
      subscriptionStatus: 'active',
    },
  });
  console.log('User identified successfully');
};
```

2. Track a custom event using the `CustomerIO.track` method:

```typescript
import { CustomerIO } from "customerio-reactnative";

const trackCustomEventExample = async () => {
  await CustomerIO.track('purchased_item', {
    product: 'Premium Subscription',
    price: 99.99,
    currency: 'USD'
  });
  console.log('Custom event tracked successfully');
};
```

### Push Notifications

1. Configure push notifications for iOS and Android. Update your `app.json` file with the following configuration:

```json
{
  "expo": {
    ...Other options
    "plugins": [
      [
        "customerio-expo-plugin",
        {
          "android": {
            "googleServicesFile": "./files/google-services.json"
          },
          "ios": {
            "pushNotification": {
              "provider": "apn",
              "useRichPush": true,
              "env": {
                "cdpApiKey": "<CDP API KEY>",
                "region": "us" // us or eu
              }
            }
          }
        }
      ]
    ]
  }
}
```

2. Upload your push upload the needed information in the [Customer.io Dashboard](https://fly.customer.io/) in your workspace settings, under push notifications.
    * iOS - Your Apple Push Notification certificates if using Apple's Push Notification service.
    * Android - Your server key json file if using Firebase Cloud Messaging.

### In-App

1. To enable in-app messaging, all you need to do is add the site ID, if you didn't in the base setup. You can find the site ID under your workspace settings, under advanced, under API and web credentials.

2. Ensure the SDK is initialized with the site ID in your app. You can call the `initialize` method from your components or services:

```typescript
import { CioConfig, CustomerIO } from "customerio-reactnative";
import { useEffect } from "react";

useEffect(() => {
  const initializeCustomerIO = async () => {
    const config: CioConfig = {
      cdpApiKey: process.env.EXPO_PUBLIC_CDP_API_KEY,
      inApp: {
        siteId: process.env.EXPO_PUBLIC_SITE_ID,
      }
    };

    await CustomerIO.initialize(config);
  };
  initializeCustomerIO();
}, []);
```

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

## Code of conduct

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

## Local development

[Here is a quick start guide to start with local development.](/local-development-readme.md)

# License

[MIT](LICENSE)
