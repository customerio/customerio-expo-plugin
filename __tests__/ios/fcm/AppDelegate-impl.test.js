const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const appDelegateImplPath = path.join(iosPath, "ExpoTestbed/AppDelegate.mm");

test("Plugin injects CIO imports and calls into AppDelegate.mm", async () => {
  const content = await fs.readFile(appDelegateImplPath, "utf8");

  expect(content).toMatchSnapshot();
});
