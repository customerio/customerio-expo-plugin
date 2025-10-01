const { testAppPath, getTestAppAndroidJavaSourcePath, getExpoVersion } = require('../utils');
const semver = require('semver');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

describe('Expo 54+ MainApplication tests', () => {
  const mainApplicationPath = path.join(
    androidPath,
    getTestAppAndroidJavaSourcePath(),
    'MainApplication.kt'
  );
  if (semver.gte(semver.coerce(getExpoVersion()), '54.0.0')) {
    test('Plugin injects CIO initializer into MainApplication.kt', async () => {
      const content = await fs.readFile(mainApplicationPath, 'utf8');
      expect(content).toMatchSnapshot();
    });
  } else {
    test.skip('Plugin injects CIO initializer into MainApplication.kt', () => {
      // Skipped: Only relevant for Expo 54+ (snapshot matches Expo 54 template)
    });
  }
});
