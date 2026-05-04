const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const podFilePath = path.join(iosPath, "Podfile");

test("Plugin injects expected customerio-reactnative/fcm and customerio-reactnative-richpush/fcm in Podfile", async () => {
    const content = await fs.readFile(podFilePath, "utf8");

    // Path is resolved at prebuild time and baked directly into :path => '...'.
    // The exact string can vary by RN version (lexical for RN <0.80, realpath
    // for RN >=0.80) so we assert the shape, not the literal string.
    expect(content).toContain("# --- CustomerIO Host App START ---");
    expect(content).toContain("# --- CustomerIO Host App END ---");

    const hasSingleSubspec = /pod 'customerio-reactnative\/fcm', :path => '[^']+'/.test(content);
    const hasMultiSubspecWithFcm = content.includes(":subspecs =>") && content.includes("'fcm'") && /:path => '[^']+'/.test(content);
    expect(hasSingleSubspec || hasMultiSubspecWithFcm).toBe(true);

    // Ensure NotificationService target is added with the rich push pod
    // pointing at the same baked path.
    const podFileAsLines = content.split('\n').map(line => line.trim());
    const startIndex = podFileAsLines.indexOf("# --- CustomerIO Notification START ---");
    const endIndex = podFileAsLines.indexOf("# --- CustomerIO Notification END ---", startIndex);
    expect(startIndex).toBeGreaterThan(-1);
    expect(endIndex).toBeGreaterThan(startIndex);
    const targetBlock = podFileAsLines.slice(startIndex, endIndex + 1).filter(line => line.length > 0);
    expect(targetBlock[0]).toBe("# --- CustomerIO Notification START ---");
    expect(targetBlock[1]).toBe("target 'NotificationService' do");
    expect(targetBlock[2]).toBe("use_frameworks! :linkage => :static");
    expect(targetBlock[3]).toMatch(/^pod 'customerio-reactnative-richpush\/fcm', :path => '[^']+'$/);
    expect(targetBlock[4]).toBe("end");
    expect(targetBlock[5]).toBe("# --- CustomerIO Notification END ---");
});
