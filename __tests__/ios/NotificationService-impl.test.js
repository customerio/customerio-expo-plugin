const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const notificationServiceImplPath = path.join(iosPath, "NotificationService/NotificationService.m");

test("Plugin creates expected NotificationService.m", async () => {
  const content = await fs.readFile(notificationServiceImplPath, "utf8");

  expect(content).toMatchSnapshot();
});
