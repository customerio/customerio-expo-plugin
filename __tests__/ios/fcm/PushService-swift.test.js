const { testAppPath, testAppName } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const pushServicePath = path.join(iosPath, `${testAppName()}/PushService.swift`);

test("Plugin creates expected PushService.swift", async () => {
  const content = await fs.readFile(pushServicePath, "utf8");

  expect(content).toMatchSnapshot();
});
