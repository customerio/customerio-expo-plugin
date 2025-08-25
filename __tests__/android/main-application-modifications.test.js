const { testAppPath, getTestAppAndroidJavaSourcePath, isExpoVersion53OrHigher } = require('../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

describe('Expo 53+ MainApplication tests', () => {
  const mainApplicationPath = path.join(
    androidPath,
    getTestAppAndroidJavaSourcePath(),
    'MainApplication.kt'
  );
  if (isExpoVersion53OrHigher()) {
    test('Plugin injects CIO initializer into MainApplication.kt', async () => {
      const content = await fs.readFile(mainApplicationPath, 'utf8');
      expect(content).toMatchSnapshot();
    });
  } else {
    test.skip('Plugin injects CIO initializer into MainApplication.kt', () => {
      // Skipped: Only relevant for Expo 53+
    });
  }
});
