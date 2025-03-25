const { getTestPaths } = require("../../helpers/testConfig");
const { extractContentBetweenMarkers } = require("../../helpers/parsers");
const { testEachParam } = require("../../utils");
const fs = require("fs-extra");
const { TEST_PARAMS } = require("../../helpers/testConfig");

describe('iOS Podfile Customizations for APN', () => {
  const { getPodfilePath } = getTestPaths();
  const podFilePath = getPodfilePath();

  test('Plugin injects customerio-reactnative/apn pod in Podfile', async () => {
    const content = await fs.readFile(podFilePath, "utf8");
    
    // Using our custom matcher
    expect(content).toHaveCIOPodDependencies();
    
    // Check for APN-specific pod
    expect(content).toContain("pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'");
  });

  test('Plugin adds NotificationService target with rich push pod for APN', async () => {
    const content = await fs.readFile(podFilePath, "utf8");
    
    // Extract the notification service target section
    const targetBlock = await extractContentBetweenMarkers(
      podFilePath, 
      "# --- CustomerIO Notification START ---", 
      "# --- CustomerIO Notification END ---"
    );
    
    // Check the content of the notification service target
    expect(targetBlock).toContain("target 'NotificationService'");
    expect(targetBlock).toContain("use_frameworks!");
    expect(targetBlock).toContain("pod 'customerio-reactnative-richpush/apn'");
  });
});