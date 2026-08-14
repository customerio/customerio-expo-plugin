# Expo Compatibility Testing Scripts

This directory contains scripts for setting up and validating compatibility of Customer.io Expo plugin across different Expo versions. These scripts automate the creation of test apps, dependency installation, plugin configuration, build validation, and snapshot testing of the generated code.

## 🛠️ Available Scripts

### 1. `compatibility:create-test-app`

Creates a new Expo test app to test plugin compatibility with specified Expo version and template. By default, the app name is auto generated using the Expo version and template.

#### Usage

```sh
npm run compatibility:create-test-app -- --expo-version=<version>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--expo-version` | Expo SDK version to test (e.g., `50`, `52` `latest`) | - | ✅ |

#### Template selection

The script does not use the `sdk-<major>` template dist-tag. That tag tracks `next`, so it can point at a template pinning an `expo` release that hasn't reached `latest` yet — and a template pinning an unreleased `expo` fails to install, with no cause anywhere in this repository.

Instead it resolves the Expo major (floating, unchanged), reads the stable `expo` release for that major from its dist-tag, and generates from the **newest** `expo-template-<name>` in the major whose pinned `expo` range that release satisfies. The major still floats and the template is still as new as possible — it is not a pin.

If no template in the major is satisfiable, the script fails with an `Upstream registry inconsistent` diagnosis naming the versions that disagree. That state is upstream and resolves on its own; it is not a plugin regression, and nothing in this repository needs to change in response to it.

Dependencies are installed by this script (`create-expo-app` runs with `--no-install`), with retries. `create-expo-app`'s own installer reports failures as a warning and still prints `Your project is ready!`, which hides a broken dependency graph until a later build step fails for an unrelated-looking reason.

### 2. `compatibility:setup-test-app`

Sets up the test app by installing dependencies, copying Google services files, and updating `app.json` with necessary configurations like app package and bundle id.

#### Usage

```sh
npm run compatibility:setup-test-app -- --app-path=<path-to-app>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--app-path` | Path to the test app directory | - | ✅ |

### 3. `compatibility:configure-plugin`

Configures the test app by updating `app.json` with required configurations for Customer.io Expo plugin to function correctly.

#### Usage

```sh
npm run compatibility:configure-plugin -- --app-path=<path-to-app>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--app-path` | Path to the test app directory | - | ✅ |
| `--ios-push-provider` | iOS push notification provider (`fcm` or `apn`) | None | ❌ |
| `--add-default-config` | Adds basic default configurations for Customer.io plugin to `app.json` | `false` | ❌ |
| `--ios-use-frameworks` | Framework usage for iOS (`static` for `fcm`, `none` otherwise) | Auto determined based on `--ios-push-provider` | ❌ |

### 4. `compatibility:validate-plugin`

Validates Customer.io Expo plugin by running `expo prebuild`, building the app, and executing snapshot tests to verify compatibility, compilation, and code generation.

#### Usage

```sh
npm run compatibility:validate-plugin -- --app-path=<path-to-app>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--app-path` | Path to the test app directory | - | ✅ |
| `--platforms` | Platforms to test (`android`, `ios`) | `android,ios` | ❌ |
| `--ios-push-providers` | iOS push providers to test (`apn`, `fcm`) | `apn,fcm` | ❌ |
| `--ios-use-frameworks` | Framework usage forwarded to each iOS provider configuration | `static` for FCM and unset for APN, applied per provider | ❌ |

### 5. `compatibility:run-compatibility-tests`

Runs the full workflow: creating, setting up, configuring, and validating the test app to test the entire compatibility flow locally.

#### Usage

```sh
npm run compatibility:run-compatibility-tests -- --expo-version=<version>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--expo-version` | Expo SDK version to test | `latest` | ❌ |
| `--app-name` | Name of the test app | Auto generated with Expo version | ❌ |
| `--dir-name` | Directory to create the test app in | `ci-test-apps` | ❌ |

---

### 💡 Tip: Manually Testing a Feature on a Specific Expo Version

To test a feature manually on a specific Expo version, run the following commands:

```sh
npm run compatibility:create-test-app -- --expo-version=<version>
npm run compatibility:setup-test-app -- --app-path=<path-to-app>
npm run compatibility:configure-plugin -- --app-path=<path-to-app> --add-default-config --ios-push-provider=<provider>
npx expo prebuild --clean
```

Then run the app as usual to test the feature.
