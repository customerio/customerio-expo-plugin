const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const appDelegateImplPath = path.join(iosPath, "testapp/AppDelegate.mm");

test("Plugin injects CIO imports and calls into AppDelegate.mm (Expo v52)", async () => {
  const content = await fs.readFile(appDelegateImplPath, "utf8");

  expect(content).toMatchSnapshot();
});
