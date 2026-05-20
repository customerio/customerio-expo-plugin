const { testAppPath, testAppName, isExpoVersionLatest } = require('../../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, 'ios');

// Full-file prebuild snapshot — only runs on the `latest` row of the
// compatibility matrix. Pinned SDK rows (currently 54) get scenario tests
// in __tests__/scenarios/ios/appDelegateSwiftSdkVersions.test.ts which use
// vanilla CLI-generated fixtures instead.
(isExpoVersionLatest() ? describe : describe.skip)('Expo latest AppDelegate tests', () => {
  const appDelegateSwiftPath = path.join(
    iosPath,
    `${testAppName()}/AppDelegate.swift`
  );

  test('Plugin injects CIO handler into AppDelegate.swift', async () => {
    const content = await fs.readFile(appDelegateSwiftPath, 'utf8');

    expect(content).toMatchSnapshot();
  });
});
