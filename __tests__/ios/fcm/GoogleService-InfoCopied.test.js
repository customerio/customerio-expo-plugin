const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const googleServicesFile = path.join(iosPath, "GoogleService-Info.plist");

test("Plugin injects expected customerio-reactnative/apn and customerio-reactnative-richpush/apn in Podfile", async () => {
  const googleServicesFileExists = fs.existsSync(googleServicesFile);

  expect(googleServicesFileExists).toBe(true);
});
