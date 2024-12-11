const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const androidPath = path.join(testProjectPath, "android");
const appManifestPath = path.join(androidPath, "app/src/main/AndroidManifest.xml");

test("Plugin injects CustomerIOFirebaseMessagingService in the app manifest", async () => {
  // When setHighPriorityPushHandler config is set to true when setting up the plugin
  // an intent filter for CustomerIOFirebaseMessagingService is added to the app Manifest file
  const content = await fs.readFile(appManifestPath, "utf8");

  expect(content).toMatchSnapshot();
});
