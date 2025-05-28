const { testAppPath, testAppName, isExpoVersion53OrHigher } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const pushServicePath = path.join(iosPath, `${testAppName()}/PushService.swift`);

// PushService.swift is only relevant for versions lower than Expo 53
(isExpoVersion53OrHigher() ? describe.skip : describe)("Pre-Expo 53 PushService tests", () => {
  test("Plugin creates expected PushService.swift", async () => {
    const content = await fs.readFile(pushServicePath, "utf8");

    expect(content).toMatchSnapshot();
  });
});
