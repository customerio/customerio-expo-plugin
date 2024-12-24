const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const notificationServicePath = path.join(iosPath, "NotificationService/NotificationService.swift");

test("Plugin creates expected NotificationService.swift", async () => {
  const content = await fs.readFile(notificationServicePath, "utf8");

  expect(content).toMatchSnapshot();
});
