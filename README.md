<p align="center">
  <a href="https://customer.io">
    <img src="https://user-images.githubusercontent.com/6409227/144680509-907ee093-d7ad-4a9c-b0a5-f640eeb060cd.png" height="60">
  </a>
  <p align="center">Power automated communication that people like to receive.</p>
</p>

![min swift version is 5.3](https://img.shields.io/badge/min%20Swift%20version-5.3-orange)
![min ios version is 13](https://img.shields.io/badge/min%20iOS%20version-13-blue)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](code_of_conduct.md)
[![codecov](https://codecov.io/gh/customerio/customerio-expo-plugin/branch/develop/graph/badge.svg?token=IZ9RP9XD1O)](https://codecov.io/gh/customerio/customerio-expo-plugin)

# Customer.io Expo Plugin

This is the official Customer.io Expo plugin, supporting mobile apps.

You'll find our [complete SDK documentation at https://customer.io/docs/sdk/expo](https://customer.io/docs/sdk/expo/). This readme only contains basic information to help you install the plugin and handle the pre-build.

The Expo plugin takes advantage of our [React Native SDK](https://github.com/customerio/customerio-reactnative), and requires very little setup. It extends the Expo config to let you customize the prebuild phase of managed workflow builds, which means you don't need to eject to a bare workflow.

After you add the plugin to your project, you'll need to install our React Native SDK and run prebuild. The plugin automatically generates and configures the necessary native code files required to make our React Native SDK to work on your project. We've tested with Expo SDK versions `45` and `46`, Using `eas` build with EAS managed credentials and a limited set of Android and iOS versions.

By default, the plugin expects to use Apple's Push Notification service (APNs) for iOS and Firebase Cloud Messaging (FCM) for Android. We plan to add FCM support for iOS in a future release.

# Install and configure the plugin

1. Run an installation command:
   * `expo install customerio-expo-plugin`
   * `npm install customerio-expo-plugin`
   * `yarn add customerio-expo-plugin`

1. Add `customerio-expo-plugin` plugin in your `app.json` or `app.config.js` and set configuration options. In most cases, you'll want to stick to our default options. When you configure the plugin, you can [pass options](#plugin-configuration-options). In most cases, you'll want to stick with the defaults, which enables all the SDK features. However you might want to disable rich push for `iOS`.
   ```json
   // app.json
   {
      ...
      "plugins": [
         ...
         [
         "customerio-expo-plugin",
         {
               "android": {
                  "googleServicesFile": "./files/google-services.json",
               },
               "ios": {
                  "pushNotification": {
                     "useRichPush": true
                  }
               }
            }
         ]
      ]
   }
   ```
1. Set the iOS build target. Our React Native SDK requires iOS deployment target `13`. You can install `expo-build-properties` and add the following to `app.json` or `app.plugin.js` to set your build target.

   ```json
   {
      ...
      "plugins": [
         ...
         [
         "expo-build-properties",
         {
            "ios": {
               "deploymentTarget": "13.0"
            }
         }
         ]
      ]
   }
   ```

1. Add an import statement to your project for the react native library. We haven't included it below, but you can import `CioLogLevel` to set log outputs to something other than `error`; this may help you debug your application.
   ```javascript
   import { CustomerIO, CustomerioConfig, CustomerIOEnv, Region } from ‘customerio-reactnative’;
   ```
1. In `useEffect`, initialize the package with your `CustomerioConfig` options and `CustomerIOEnv` variables. You can find your Site ID and API Key credentials—or create new ones—under *Data & Integrations* > *Integrations* > *Customer.io API*:
   ```javascript
   useEffect(() => {
      const data = new CustomerioConfig()
      data.logLevel = CioLogLevel.debug

      const env = new CustomerIOEnv()
      env.siteId = Env.siteId
      env.apiKey = Env.apiKey
      env.organizationId = Env.organizationId
      //organizationId is used to send in-app messages.
      env.region = Region.US
      //Region is optional, defaults to Region.US. Use Region.EU for EU-based workspaces.

      CustomerIO.initialize(env, data)
   }, [])
   ```
## Plugin configuration options

The `customerio-expo-plugin` supports the following configuration options. In most cases, you'll want to use the [default options shown in the installation instructions](#install-and-configure-the-plugin).

<table class="settings-table mrg-t-lg">
    <thead>
        <tr>
            <td>Option</td>
            <td>Type</td>
            <td>Default</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>android</code></td>
            <td>object</td>
            <td><code>undefined</code></td>
            <td>Required if you want to setup Android even if it is empty. Eg (<code>"android": {}</code>).</td>
        </tr>
        <tr>
            <td><code>ios</code></td>
            <td>object</td>
            <td><code>undefined</code></td>
            <td>Required if you want to setup iOS even if it is empty. Eg (<code>"ios": {}</code>).</td>
        </tr>
        <tr>
            <td><code>android.googleServicesFile</code></td>
            <td>string</td>
            <td><code>undefined</code></td>
            <td>Set the path to your <code>google-services.json</code> file.</td>
        </tr>
        <tr>
            <td><code>android.setHighPriorityPushHandler</code></td>
            <td>boolean</td>
            <td><code>undefined</code></td>
            <td>This is optional, if you choose to use a 3rd party plugin to handle notification permissions, but want our SDK to handle the notifications.</td>
        </tr>
        <tr>
            <td><code>ios.pushNotification</code></td>
            <td>object</td>
            <td style="white-space:nowrap;"><code>undefined</code></td>
            <td>Enables push notifications for iOS, even if it is an empty object</td>
        </tr>
        <tr>
            <td style="white-space:nowrap;"><code>ios.pushNotification.useRichPush</code></td>
            <td>boolean</td>
            <td><code>false</code></td>
            <td>Enables rich push for iOS</td>
        </tr>
        <tr>
            <td style="white-space:nowrap;"><code>ios.pushNotification.env</code></td>
            <td>object</td>
            <td><code>undefined</code></td>
            <td>Set environment variables to use for rich push workaround. This field should be filled when enabling rich push. Expected values: `siteId`: `string`,`apiKey`: `string`, `region`: `us` or `eu`</td>
        </tr>
        <tr>
            <td style="white-space:nowrap;"><code>ios.useFrameworks</code></td>
            <td>string</td>
            <td><code>undefined</code></td>
            <td>This is optional, it allows the plugin to work with static libraries. Options are <code>static</code> and <code>dynamic</code></td>
        </tr>
        <tr>
            <td style="white-space:nowrap;"><code>ios.disableNotificationRegistration</code></td>
            <td>boolean</td>
            <td><code>undefined</code></td>
            <td>This is optional, it removes the `registerPushNotification` handler and allows you to use any 3rd party plugin to handle the permission request </td>
        </tr>
    </tbody>
</table>

# Run the prebuild

After you [install and configure the plugin](#install-and-configure-the-plugin), run the prebuild.

```shell
# Run prebuild
expo prebuild

# Delete ios and android folders before prebuild
expo prebuild --clean
```
Now your project is ready to use the React Native SDK.

## Enable Rich Push on iOS
For now, you'll need to add a short workaround to take advantage of rich push features. Add the following to `ios/NotificationService/NotificationService.swift` after you run `prebuild --clean`.

```swift
...
import CioTracking // <== Add import

@objc
public class NotificationServiceCioManager : NSObject {

    public override init() {}

    @objc(didReceive:withContentHandler:)
    public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
      CustomerIO.initialize(siteId: "<YourSiteId>", apiKey: "<YourApiKey>", region: Region.US) // <== Workaround code
      ...
```

# More information

See our complete SDK documentation at [https://customer.io/docs/sdk/expo/](https://customer.io/docs/sdk/expo/)

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

# License

[MIT](LICENSE)