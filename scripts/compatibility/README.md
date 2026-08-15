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

#### Expo version selection

The generated app is held to the **stable** `expo` release — the one on the `latest` dist-tag — resolved fresh on every run.

This is not a committed pin. Nothing is stored in this repository and nothing needs bumping: the day a new release is promoted to `latest`, the next run tests against it, so a genuinely incompatible release still turns CI red immediately. What it excludes is releases that have not reached `latest` yet, which is not what customers install.

Two things are needed to make that hold, because there are two independent places the version gets decided:

1. **Template choice.** `sdk-<major>` tracks `next`, so it can point at a template pinning an `expo` that isn't out yet. The curated tag is still used whenever it is usable; the script walks back to the newest usable template in the major only when it isn't.
2. **The pin itself.** Choosing the template is *not* sufficient. Templates pin `expo` with a `~` range, and npm resolves a range to the highest **published** version regardless of dist-tag — `~57.0.12` still installs 57.0.13 when that release exists on `next` only. So the exact stable version is written into the app before installing, and re-asserted in `compatibility:setup-test-app` after `npx expo install --fix`, which otherwise rewrites it.

If no template in the major is usable, the script fails with an `Upstream registry inconsistent` diagnosis naming the versions that disagree. That state is upstream and resolves on its own; it is not a plugin regression. A bad `--expo-template` argument is reported separately, as our problem.

**Known limitation:** only `expo` is held to the stable release. The template pins ~20 other `expo-*` packages with their own `~` ranges, so a broken pre-stable release of one of those can still fail the install. `expo install --fix` realigns them to the SDK, but only after the first install has already run.

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
