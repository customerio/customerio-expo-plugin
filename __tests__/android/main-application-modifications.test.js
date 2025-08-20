const { testAppPath } = require('../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');

describe('Expo 53+ MainApplication tests', () => {
  const mainApplicationPath = path.join(
    androidPath,
    'app/src/main/java/io/customer/testbed/expo/MainApplication.kt'
  );

  test('Plugin injects CIO initializer into MainApplication.kt', async () => {
    const content = await fs.readFile(mainApplicationPath, 'utf8');
    expect(content).toMatchSnapshot();
  });
});
