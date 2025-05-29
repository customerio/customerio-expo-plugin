const { testAppPath, testAppName, isExpoVersion53OrHigher } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const appDelegateHeaderPath = path.join(iosPath, `${testAppName()}/AppDelegate.h`);

// Tests for pre-Expo 53 (Objective-C)
(isExpoVersion53OrHigher() ? describe.skip : describe)("Pre-Expo 53 - AppDelegate.h", () => {
  test("Plugin injects CIO imports and calls into AppDelegate.h", async () => {
    const content = await fs.readFile(appDelegateHeaderPath, "utf8");

    expect(content).toMatchSnapshot();
  });
});
