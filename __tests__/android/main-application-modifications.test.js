const { testAppPath, getTestAppAndroidJavaSourcePath, isExpoVersion53OrHigher } = require('../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

// Tests for Expo 53+ (Auto-init only - Expo 52 doesn't modify MainApplication)
(isExpoVersion53OrHigher() ? describe : describe.skip)('Expo 53+ MainApplication tests', () => {
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
