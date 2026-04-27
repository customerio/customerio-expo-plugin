const { testAppPath } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const podFilePath = path.join(iosPath, "Podfile");

test("Plugin injects expected customerio-reactnative/apn and customerio-reactnative-richpush/apn in Podfile", async () => {
    const content = await fs.readFile(podFilePath, "utf8");

    // Ensure CustomerIO Host App block exists with the install-time path
    // resolver lambda and an apn subspec line that references the variable.
    expect(content).toContain("# --- CustomerIO Host App START ---");
    expect(content).toContain("# --- CustomerIO Host App END ---");
    expect(content).toContain("customerio_reactnative_path = (lambda do");
    const hasSingleSubspec = content.includes("pod 'customerio-reactnative/apn', :path => customerio_reactnative_path");
    const hasMultiSubspecWithApn = content.includes(":subspecs =>") && content.includes("'apn'") && content.includes(":path => customerio_reactnative_path");
    expect(hasSingleSubspec || hasMultiSubspecWithApn).toBe(true);

    // Ensure NotificationService target is added with the rich push pod and
    // a local path-resolver lambda (separate Ruby scope from the host app
    // block, so the lambda is emitted again here).
    const podFileAsLines = content.split('\n').map(line => line.trim());
    const startIndex = podFileAsLines.indexOf("# --- CustomerIO Notification START ---");
    const endIndex = podFileAsLines.indexOf("# --- CustomerIO Notification END ---", startIndex);
    expect(startIndex).toBeGreaterThan(-1);
    expect(endIndex).toBeGreaterThan(startIndex);
    const targetBlock = podFileAsLines.slice(startIndex, endIndex + 1).filter(line => line.length > 0);
    const expectedLines = [
      "# --- CustomerIO Notification START ---",
      "target 'NotificationService' do",
      "use_frameworks! :linkage => :static",
      "customerio_reactnative_path = (lambda do",
      "out = `node --print \"require.resolve('customerio-reactnative/package.json')\" 2>/dev/null`.strip",
      "if $?.success? && !out.empty?",
      "Pathname.new(File.dirname(out)).relative_path_from(Pathname.new(__dir__)).to_s",
      "else",
      "'../node_modules/customerio-reactnative'",
      "end",
      "end).call",
      "pod 'customerio-reactnative-richpush/apn', :path => customerio_reactnative_path",
      "end",
      "# --- CustomerIO Notification END ---"
    ];

    expect(targetBlock).toEqual(expectedLines);
});
