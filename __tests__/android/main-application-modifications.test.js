const {
  testAppPath,
  getTestAppAndroidJavaSourcePath,
  isExpoVersionLatest,
} = require('../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

// Full-file prebuild snapshot — only runs on the `latest` row of the
// compatibility matrix. Pinned SDK rows (currently 54) get scenario tests
// in __tests__/scenarios/android/mainApplicationVersions.test.ts which run
// the pure transform against vanilla CLI-generated fixtures.
(isExpoVersionLatest() ? describe : describe.skip)('Expo latest MainApplication tests', () => {
  const mainApplicationPath = path.join(
    androidPath,
    getTestAppAndroidJavaSourcePath(),
    'MainApplication.kt'
  );
  test('Plugin injects CIO initializer into MainApplication.kt', async () => {
    const content = await fs.readFile(mainApplicationPath, 'utf8');
    expect(content).toMatchSnapshot();
  });
});
