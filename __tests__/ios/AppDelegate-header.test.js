const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const appDelegateHeaderPath = path.join(iosPath, "ExpoTestApp/AppDelegate.h");

test("Plugin injects CIO imports and calls into AppDelegate.h", async () => {
  const content = await fs.readFile(appDelegateHeaderPath, "utf8");

  expect(content).toMatchSnapshot();
});
