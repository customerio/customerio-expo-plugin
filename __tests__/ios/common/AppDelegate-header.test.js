const { testAppPath, testAppName } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const appDelegateHeaderPath = path.join(iosPath, `${testAppName()}/AppDelegate.h`);

test("Plugin injects CIO imports and calls into AppDelegate.h", async () => {
  const content = await fs.readFile(appDelegateHeaderPath, "utf8");

  expect(content).toMatchSnapshot();
});
