const { testAppPath, testAppName, isExpoVersion53OrHigher } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const appDelegateHandlerPath = path.join(iosPath, `${testAppName()}/CioSdkAppDelegateHandler.swift`);

// CioSdkAppDelegateHandler.swift is only relevant for versions lower than Expo 53
(isExpoVersion53OrHigher() ? describe : describe.skip)("Expo 53 CioSdkAppDelegateHandler tests", () => {
  test("Plugin creates expected CioSdkAppDelegateHandler.swift", async () => {
    const content = await fs.readFile(appDelegateHandlerPath, "utf8");

    expect(content).toMatchSnapshot();
  });
});
