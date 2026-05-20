const {
  testAppPath,
  getTestAppAndroidJavaSourcePath,
  isExpoVersionAtLeast,
  isExpoVersionLatest,
} = require('../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

// The snapshot is pinned to Expo SDK 54's MainApplication.kt template
// (`ReactNativeHostWrapper` + `DefaultReactNativeHost`). SDK 55 rewrote the
// host bootstrap to use `ExpoReactHostFactory.getDefaultReactHost`, so the
// snapshot will not match newer SDKs. Until per-SDK fixtures are added for
// Android (mirroring `__tests__/scenarios/ios/appDelegateSwiftSdkVersions`),
// scope this test to the pinned SDK 54 row only.
const runsExpo54Snapshot =
  !isExpoVersionLatest() &&
  isExpoVersionAtLeast('54.0.0') &&
  !isExpoVersionAtLeast('55.0.0');

describe('Expo 54 MainApplication tests', () => {
  const mainApplicationPath = path.join(
    androidPath,
    getTestAppAndroidJavaSourcePath(),
    'MainApplication.kt'
  );
  if (runsExpo54Snapshot) {
    test('Plugin injects CIO initializer into MainApplication.kt', async () => {
      const content = await fs.readFile(mainApplicationPath, 'utf8');
      expect(content).toMatchSnapshot();
    });
  } else {
    // Skip name must match the active test name so jest doesn't flag the
    // SDK-54 snapshot as obsolete on rows where the test is skipped.
    test.skip('Plugin injects CIO initializer into MainApplication.kt', () => {
      // Snapshot pinned to Expo SDK 54 template — see comment above.
    });
  }
});
