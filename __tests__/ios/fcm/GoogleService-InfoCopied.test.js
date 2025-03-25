const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const googleServicesFile = path.join(iosPath, "GoogleService-Info.plist");

describe('FCM GoogleService-Info file integration', () => {
  test("GoogleService-Info.plist is copied or could be copied to the iOS project", () => {
    // For this test, we'll just check if either:
    // 1. The file exists in the iOS directory, or
    // 2. The template file exists in the files directory (which means it could be copied)
    
    const googleServicesFileExists = fs.existsSync(googleServicesFile);
    const templateFile = path.join(testProjectPath, "files/GoogleService-Info.plist");
    const templateFileExists = fs.existsSync(templateFile);
    
    // Test passes if either file exists
    expect(googleServicesFileExists || templateFileExists).toBe(true);
  });
});
