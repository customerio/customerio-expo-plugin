const { testAppPath, testAppName, isExpoVersion53OrHigher } = require('../../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, 'ios');

// Tests for Expo 53+ (Swift)
(isExpoVersion53OrHigher() ? describe : describe.skip)('Expo 53+ AppDelegate tests', () => {
  const appDelegateSwiftPath = path.join(
    iosPath,
    `${testAppName()}/AppDelegate.swift`
  );

  test('Plugin injects CIO handler into AppDelegate.swift', async () => {
    const content = await fs.readFile(appDelegateSwiftPath, 'utf8');

    expect(content).toMatchSnapshot();
  });
});
