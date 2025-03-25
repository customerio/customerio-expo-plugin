# Expo Compatibility Testing Scripts

This directory contains scripts for setting up and validating compatibility of Customer.io Expo plugin across different Expo versions. These scripts automate the creation of test apps, dependency installation, plugin configuration, build validation, and testing of the generated code.

## 🧪 Testing Approach

Our testing approach uses several strategies to ensure compatibility across Expo versions:

1. **Structured Data Testing**: Rather than relying on exact snapshots, we parse files into structured data (JSON, XML, etc.) and make assertions on the important parts.

2. **Contract Testing**: We define "contracts" that specify what the plugin promises to deliver regardless of Expo version, then verify these contracts are fulfilled.

3. **Partial Snapshots**: For complex files like AppDelegate, we extract and test only the critical sections that should be consistent across Expo versions.

4. **Custom Matchers**: Custom Jest matchers make tests more readable and maintainable by encapsulating complex assertions.

5. **Parameterized Tests**: Tests can be run with different parameters, making it easy to test against multiple configurations.

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

Validates Customer.io Expo plugin by running `expo prebuild`, building the app, and executing tests to verify compatibility, compilation, and code generation.

#### Usage

```sh
npm run compatibility:validate-plugin -- --app-path=<path-to-app>
```

| **Argument** | **Description** | **Default** | **Required** |
| - | - | - | - |
| `--app-path` | Path to the test app directory | - | ✅ |
| `--platforms` | Platforms to test (`android`, `ios`) | `android,ios` | ❌ |
| `--ios-push-providers` | iOS push providers to test (`apn`, `fcm`) | `apn,fcm` | ❌ |
| `--contract-tests` | Run contract validation tests | `true` | ❌ |

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

## 📚 Test Structure

Our tests are organized into several components:

### 1. File-specific Tests

These tests verify the specific implementation details of generated files.

### 2. Contract Tests

Contract tests ensure that regardless of the specific implementation, the plugin fulfills its core promises:
- Required files are present
- Required functionality is implemented
- Required configurations are set

### 3. Helper Utilities

- `parsers.js`: Utilities for parsing different file types into structured data
- `matchers.js`: Custom Jest matchers for common assertions
- `contracts.js`: Definitions of what constitutes a valid plugin integration
- `contractTesting.js`: Utilities to verify contracts are fulfilled
- `testConfig.js`: Configuration for tests, including platform-specific behaviors

## 💡 Tip: Manually Testing a Feature on a Specific Expo Version

To test a feature manually on a specific Expo version, run the following commands:

```sh
npm run compatibility:create-test-app -- --expo-version=<version>
npm run compatibility:setup-test-app -- --app-path=<path-to-app>
npm run compatibility:configure-plugin -- --app-path=<path-to-app> --add-default-config --ios-push-provider=<provider>
npx expo prebuild --clean
```

Then run the app as usual to test the feature.
