## [1.0.0-beta.12](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.11...1.0.0-beta.12) (2023-07-06)


### Bug Fixes

* path fix for monorepo support ([#91](https://github.com/customerio/customerio-expo-plugin/issues/91)) ([8f551d3](https://github.com/customerio/customerio-expo-plugin/commit/8f551d3948cf33267220b58d5c6271b97db15594))

## [1.0.0-beta.11](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.10...1.0.0-beta.11) (2023-07-03)


### ⚠ BREAKING CHANGES

* auto-update native SDK and easier rich push install (#81)

### Bug Fixes

* auto-update native SDK and easier rich push install ([#81](https://github.com/customerio/customerio-expo-plugin/issues/81)) ([793e927](https://github.com/customerio/customerio-expo-plugin/commit/793e9274cf83cfbea6334957a1df2a96ccb80f2d))

## [1.0.0-beta.10](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.9...1.0.0-beta.10) (2023-06-01)


### Bug Fixes

* xcode race condition fix ([#76](https://github.com/customerio/customerio-expo-plugin/issues/76)) ([ff136ba](https://github.com/customerio/customerio-expo-plugin/commit/ff136ba21e08c4b63a17ad298c8fd71934108efc))

## [1.0.0-beta.9](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.8...1.0.0-beta.9) (2023-05-17)


### Bug Fixes

* compatibility for monorepos ([#67](https://github.com/customerio/customerio-expo-plugin/issues/67)) ([14fa86c](https://github.com/customerio/customerio-expo-plugin/commit/14fa86cab7b2c3465f7d1afe2906aef70c59af3b))

## [1.0.0-beta.8](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.7...1.0.0-beta.8) (2023-05-11)


### Bug Fixes

* expo-notifications compatibility with customerio-expo-plugin ([#70](https://github.com/customerio/customerio-expo-plugin/issues/70)) ([fe5cd0f](https://github.com/customerio/customerio-expo-plugin/commit/fe5cd0f5d0dd715e76b8bbfd656b4667eaf63dbf))

## [1.0.0-beta.7](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.6...1.0.0-beta.7) (2023-03-06)


### Features

* support for React Native and iOS SDK v2 ([#51](https://github.com/customerio/customerio-expo-plugin/issues/51)) ([65a76d9](https://github.com/customerio/customerio-expo-plugin/commit/65a76d98da8c1d012c0ff9f6bb697aea47d3b74f))

## [1.0.0-beta.6](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.5...1.0.0-beta.6) (2023-02-27)


### Bug Fixes

* github ref in npm publish step of deploy action ([#47](https://github.com/customerio/customerio-expo-plugin/issues/47)) ([59fb7f0](https://github.com/customerio/customerio-expo-plugin/commit/59fb7f0ad5ff05adb828166f4d62d96d18b08f9c))

## [1.0.0-beta.5](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.4...1.0.0-beta.5) (2023-02-27)


### Bug Fixes

* added dependencies ([#46](https://github.com/customerio/customerio-expo-plugin/issues/46)) ([5a2b643](https://github.com/customerio/customerio-expo-plugin/commit/5a2b643828e080a771fbd24795e818bada1c0e2f))

## [1.0.0-beta.4](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.3...1.0.0-beta.4) (2023-02-27)


### Features

* flexible notification request handling ([#40](https://github.com/customerio/customerio-expo-plugin/issues/40)) ([447a7c2](https://github.com/customerio/customerio-expo-plugin/commit/447a7c271d2da8d64ad12c5b16207c2c0500a45e))

## [1.0.0-beta.3](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-beta.2...1.0.0-beta.3) (2023-02-20)


### Bug Fixes

* hot fixes ([#37](https://github.com/customerio/customerio-expo-plugin/issues/37)) ([4e1953c](https://github.com/customerio/customerio-expo-plugin/commit/4e1953c2ab77a04d0586e9afe72dcda7549bf684))

## 1.0.0-beta.2 (2022-12-30)

* removed restriction on peerDependencies to prevent issues on customer end ([#24](https://github.com/customerio/customerio-expo-plugin/issues/24)) ([bce90c0](https://github.com/customerio/customerio-expo-plugin/commit/bce90c0031c10707328c7a16f528f8536bd1c12e))

## 1.0.0-beta.1 (2022-12-30)


### ⚠ BREAKING CHANGES

* changed googleServicesFilePath to googleServicesFile (#16)

### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))
* fixed issues with adding file to target ([#10](https://github.com/customerio/customerio-expo-plugin/issues/10)) ([0674c66](https://github.com/customerio/customerio-expo-plugin/commit/0674c6624dad61fdaa86800327c32f66a37470da))
* rich push environment variable setup ([#23](https://github.com/customerio/customerio-expo-plugin/issues/23)) ([8d83c95](https://github.com/customerio/customerio-expo-plugin/commit/8d83c955ea2f19d9d8ab9a10c069279f1f57db0e))
* user agent for expo ([#8](https://github.com/customerio/customerio-expo-plugin/issues/8)) ([19e78b1](https://github.com/customerio/customerio-expo-plugin/commit/19e78b1f00b04627004af4fa7f2a53c1b0f33ac8))


### Bug Fixes

* fixed info.plist formatting issue ([#18](https://github.com/customerio/customerio-expo-plugin/issues/18)) ([d701794](https://github.com/customerio/customerio-expo-plugin/commit/d70179445ae3fbd051b9d374b159dcb5207ca281))
* update .releaserc.json ([#21](https://github.com/customerio/customerio-expo-plugin/issues/21)) ([8c751cf](https://github.com/customerio/customerio-expo-plugin/commit/8c751cf221fdd2e63190af8be9a4716faac9783c))
* updated package version ([#19](https://github.com/customerio/customerio-expo-plugin/issues/19)) ([ab30383](https://github.com/customerio/customerio-expo-plugin/commit/ab303831c69c8bdee9e6831ebcce67539a6c7e5d))


### Code Refactoring

* changed googleServicesFilePath to googleServicesFile ([#16](https://github.com/customerio/customerio-expo-plugin/issues/16)) ([26be4db](https://github.com/customerio/customerio-expo-plugin/commit/26be4db53893432882b52b25c6040b40c76bca7b))

## [1.0.0-alpha.6](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-alpha.5...1.0.0-alpha.6) (2022-12-30)


### ⚠ BREAKING CHANGES

* changed googleServicesFilePath to googleServicesFile (#16)

### Features

* fixed issues with adding file to target ([#10](https://github.com/customerio/customerio-expo-plugin/issues/10)) ([0674c66](https://github.com/customerio/customerio-expo-plugin/commit/0674c6624dad61fdaa86800327c32f66a37470da))
* rich push environment variable setup ([#23](https://github.com/customerio/customerio-expo-plugin/issues/23)) ([8d83c95](https://github.com/customerio/customerio-expo-plugin/commit/8d83c955ea2f19d9d8ab9a10c069279f1f57db0e))
* user agent for expo ([#8](https://github.com/customerio/customerio-expo-plugin/issues/8)) ([19e78b1](https://github.com/customerio/customerio-expo-plugin/commit/19e78b1f00b04627004af4fa7f2a53c1b0f33ac8))


### Code Refactoring

* changed googleServicesFilePath to googleServicesFile ([#16](https://github.com/customerio/customerio-expo-plugin/issues/16)) ([26be4db](https://github.com/customerio/customerio-expo-plugin/commit/26be4db53893432882b52b25c6040b40c76bca7b))

## [1.0.0-alpha.5](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-alpha.4...1.0.0-alpha.5) (2022-12-20)


### Bug Fixes

* fixed info.plist formatting issue ([#18](https://github.com/customerio/customerio-expo-plugin/issues/18)) ([d701794](https://github.com/customerio/customerio-expo-plugin/commit/d70179445ae3fbd051b9d374b159dcb5207ca281))
* update .releaserc.json ([#21](https://github.com/customerio/customerio-expo-plugin/issues/21)) ([8c751cf](https://github.com/customerio/customerio-expo-plugin/commit/8c751cf221fdd2e63190af8be9a4716faac9783c))
* updated package version ([#19](https://github.com/customerio/customerio-expo-plugin/issues/19)) ([ab30383](https://github.com/customerio/customerio-expo-plugin/commit/ab303831c69c8bdee9e6831ebcce67539a6c7e5d))

## [1.0.0-alpha.5](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-alpha.4...1.0.0-alpha.5) (2022-12-20)


### Bug Fixes

* fixed info.plist formatting issue ([#18](https://github.com/customerio/customerio-expo-plugin/issues/18)) ([d701794](https://github.com/customerio/customerio-expo-plugin/commit/d70179445ae3fbd051b9d374b159dcb5207ca281))
* updated package version ([#19](https://github.com/customerio/customerio-expo-plugin/issues/19)) ([ab30383](https://github.com/customerio/customerio-expo-plugin/commit/ab303831c69c8bdee9e6831ebcce67539a6c7e5d))

## [1.0.0-alpha.5](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-alpha.4...1.0.0-alpha.5) (2022-12-20)


### Bug Fixes

* fixed info.plist formatting issue ([#18](https://github.com/customerio/customerio-expo-plugin/issues/18)) ([d701794](https://github.com/customerio/customerio-expo-plugin/commit/d70179445ae3fbd051b9d374b159dcb5207ca281))

## [1.0.0-alpha.4](https://github.com/customerio/customerio-expo-plugin/compare/1.0.0-alpha.3...1.0.0-alpha.4) (2022-11-30)


### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))

## 1.0.0-alpha.1 (2022-11-30)


### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))

## 1.0.0-alpha.1 (2022-11-30)


### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))

## 1.0.0-alpha.1 (2022-11-30)


### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))

## 1.0.0-alpha.4 (2022-11-30)


### Features

* added ability to set use_frameworks to static ([#9](https://github.com/customerio/customerio-expo-plugin/issues/9)) ([05d7012](https://github.com/customerio/customerio-expo-plugin/commit/05d7012dfdffe70aed7c93ef08fe3975c2440674))
