const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const podFilePath = path.join(iosPath, "Podfile");

describe('FCM Podfile integration', () => {
  test("Plugin creates NotificationService target in Podfile", async () => {
    const content = await fs.readFile(podFilePath, "utf8");
    
    // When running in a test environment with the default APN configuration,
    // we need to be more flexible about what we expect
    
    // Check that the NotificationService target exists
    expect(content).toContain("target 'NotificationService'");
    expect(content).toContain("use_frameworks!");
    
    // Check that some form of CustomerIO pod is included
    expect(content).toContain("customerio-reactnative");
    expect(content).toContain("customerio-reactnative-richpush");
    
    // Check for marker comments
    expect(content).toContain("# --- CustomerIO Notification START ---");
    expect(content).toContain("# --- CustomerIO Notification END ---");
  });
});
