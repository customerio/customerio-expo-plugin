<p align=center>
  <a href="https://customer.io">
    <img src="https://avatars.githubusercontent.com/u/1152079?s=200&v=4" height="60">
  </a>
</p>

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](code_of_conduct.md)

# Customer.io Expo Plugin

This is the official Customer.io Expo plugin, supporting mobile apps.

The Expo plugin takes advantage of our [React Native SDK](https://github.com/customerio/customerio-reactnative), and requires very little setup. It extends the Expo config to let you customize the pre-build phase of managed workflow builds, which means you don't need to eject to a bare workflow.

After you add the plugin to your project, the plugin automatically installs our React Native SDK and configures the necessary native code files required to make it work in your project. Simply run pre-build after adding the plugin.

> **Note**: The plugin automatically includes the customerio-reactnative SDK as a dependency. You do not need to add it to your project's package.json. If you already have customerio-reactnative in your dependencies, we recommend removing it to avoid version conflicts.

# Getting started

You'll find our [complete SDK documentation at https://customer.io/docs/sdk/expo](https://customer.io/docs/sdk/expo/).

# Local development

[Here is a quick start guide to start with local development.](/local-development-readme.md)

# Contributing

Thanks for taking an interest in our project! We welcome your contributions.

We value an open, welcoming, diverse, inclusive, and healthy community for this project. We expect all  contributors to follow our [code of conduct](CODE_OF_CONDUCT.md).

# License

[MIT](LICENSE)
