const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const notificationServicePath = path.join(iosPath, "NotificationService/NotificationService.swift");

test("Plugin creates expected NotificationService.swift", async () => {
  const content = await fs.readFile(notificationServicePath, "utf8");

  const appJson = await fs.readJson(path.join(testProjectPath, "app.json"));
  const options = appJson.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === "customerio-expo-plugin"
  )?.[1];
  const apiHost = options?.ios?.pushNotification?.env?.apiHost?.trim();
  if (apiHost) {
    expect(content).toContain(`.apiHost(${JSON.stringify(apiHost)})`);
  } else {
    expect(content).not.toContain('.apiHost(');
  }
  // Keep the baseline snapshot shared with apps that use the default metrics host.
  expect(content.replace(/^.*\.apiHost\(.*\)\n/gm, '')).toMatchSnapshot();
});
