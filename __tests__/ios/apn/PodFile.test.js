const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const podFilePath = path.join(iosPath, "Podfile");

test("Plugin injects expected customerio-reactnative/apn and customerio-reactnative-richpush/apn in Podfile", async () => {
    const content = await fs.readFile(podFilePath, "utf8");

    // Ensure APN pod is added
    expect(content).toContain("pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'");

    // Ensure NotificationService target is added with rich push pod
    const podFileAsLines = content.split('\n').map(line => line.trim());
    const startIndex = podFileAsLines.indexOf("# --- CustomerIO Notification START ---");
    const endIndex = podFileAsLines.indexOf("# --- CustomerIO Notification END ---", startIndex);
    expect(startIndex).toBeGreaterThan(-1);
    expect(endIndex).toBeGreaterThan(startIndex);
    const targetBlock = podFileAsLines.slice(startIndex, endIndex + 1).filter(line => line.length > 0);
    const expectedLines = [
      "# --- CustomerIO Notification START ---",
      "target 'NotificationService' do",
      "pod 'customerio-reactnative-richpush/apn', :path => '../node_modules/customerio-reactnative'",
      "end",
      "# --- CustomerIO Notification END ---"
    ];

    expect(targetBlock).toEqual(expectedLines);
});
