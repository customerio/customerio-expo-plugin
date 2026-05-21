const path = require('path');
const semver = require('semver');

function testAppPath() {
  const appPath = process.env.TEST_APP_PATH;
  if (appPath) {
    return path.join(appPath);
  }
  return path.join(__dirname, '../test-app');
}

function testAppName() {
  return process.env.TEST_APP_NAME || 'ExpoTestbed';
}

function getTestAppAndroidPackageName() {
  // Use consistent package name for testing to ensure snapshot tests pass
  return process.env.ANDROID_PACKAGE_NAME || 'io.customer.testbed.expo';
}

function getTestAppAndroidPackagePath() {
  return getTestAppAndroidPackageName().replace(/\./g, '/');
}

function getTestAppAndroidJavaSourcePath() {
  return `app/src/main/java/${getTestAppAndroidPackagePath()}`;
}

/**
 * Resolve a path inside the scenario-suite fixtures tree.
 * Pinned-SDK fixtures live under `__tests__/fixtures/<area>/<name>`.
 */
function getFixturePath(area, name) {
  return path.join(__dirname, 'fixtures', area, name);
}

/**
 * Get the Expo version from environment variable
 * @returns {string} The Expo version
 */
function getExpoVersion() {
  return process.env.EXPO_VERSION || '53.0.0'; // Default to 53
}

/**
 * Returns true when EXPO_VERSION is `latest` or its semver is >= targetVersion.
 * `latest` is treated as the newest supported SDK so version-gated tests still
 * run on the matrix's `latest` row, where the resolved SDK can't be known
 * statically without resolving the npm dist-tag.
 */
function isExpoVersionAtLeast(targetVersion) {
  const sdkVersion = getExpoVersion();
  if (sdkVersion === 'latest') return true;

  const validVersion = semver.valid(sdkVersion) || semver.coerce(sdkVersion);
  if (!validVersion) return false;

  return semver.gte(validVersion, targetVersion);
}

/**
 * Check if the Expo version is 53 or higher
 * @returns {boolean} True if Expo version is 53 or higher
 */
function isExpoVersion53OrHigher() {
  return isExpoVersionAtLeast('53.0.0');
}

/**
 * True when the compatibility matrix invoked the tests with `--expo-version=latest`.
 * Used to gate the prebuild-output snapshot test so the snapshot only needs to
 * track upstream template churn for one row of the matrix; pinned SDK rows get
 * their own scenario tests with per-version fixtures.
 */
function isExpoVersionLatest() {
  return process.env.EXPO_VERSION === 'latest';
}

module.exports = {
  testAppPath,
  testAppName,
  getTestAppAndroidPackageName,
  getTestAppAndroidPackagePath,
  getTestAppAndroidJavaSourcePath,
  getExpoVersion,
  isExpoVersion53OrHigher,
  isExpoVersionAtLeast,
  isExpoVersionLatest,
  getFixturePath,
};
