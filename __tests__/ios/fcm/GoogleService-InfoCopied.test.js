const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const googleServicesFile = path.join(iosPath, "GoogleService-Info.plist");

test("GoogleService-Info.plist is copied at the expected location in the iOS project", async () => {
  const googleServicesFileExists = fs.existsSync(googleServicesFile);

  expect(googleServicesFileExists).toBe(true);
});
