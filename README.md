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

## Location

To enable the Customer.io SDK location native module, set `location: { enabled: true }` in your plugin config. When enabled, the plugin adds the iOS Podfile location subspec and sets `customerio_location_enabled=true` in Android `gradle.properties`. The plugin does **not** add location permissions or privacy usage strings (e.g. `NSLocationWhenInUseUsageDescription`, `ACCESS_FINE_LOCATION`); your app must declare those and request permission (e.g. via `react-native-permissions`) before using `CustomerIO.location` or passing `config.location` to `CustomerIO.initialize`.

You can set the location **tracking mode** under `config.location.trackingMode`:

- **`MANUAL`** (default) – Your app controls when location is captured (e.g. via `CustomerIO.location.setLastKnownLocation` or `CustomerIO.location.requestLocationUpdate`).
- **`ON_APP_START`** – The SDK captures location once per app launch when the app becomes active.
- **`OFF`** – Location module is included but tracking is disabled.

Example with tracking mode:

```json
{
  "plugins": [
    [
      "customerio-expo-plugin",
      {
        "config": {
          "cdpApiKey": "...",
          "siteId": "...",
          "location": { "trackingMode": "MANUAL" }
        },
        "location": { "enabled": true }
      }
    ]
  ]
}
```

# Getting started

You'll find our [complete SDK documentation at https://customer.io/docs/sdk/expo](https://customer.io/docs/sdk/expo/).

# Local development

[Here is a quick start guide to start with local development.](/local-development-readme.md)

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

# License

[MIT](LICENSE)
