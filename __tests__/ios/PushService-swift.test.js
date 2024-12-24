const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const pushServicePath = path.join(iosPath, "ExpoTestApp/PushService.swift");

test("Plugin creates expected PushService.swift", async () => {
  const content = await fs.readFile(pushServicePath, "utf8");

  expect(content).toMatchSnapshot();
});
