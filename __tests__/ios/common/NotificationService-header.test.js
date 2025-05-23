const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const notificationServiceHeaderPath = path.join(iosPath, "NotificationService/NotificationService.h");

test("Plugin creates expected NotificationService.h", async () => {
  const content = await fs.readFile(notificationServiceHeaderPath, "utf8");

  expect(content).toMatchSnapshot();
});
