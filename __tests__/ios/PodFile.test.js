const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const podFilePath = path.join(iosPath, "Podfile");

test("Plugin injects expected customerio-reactnative/apn and customerio-reactnative-richpush/apn in Podfile (Expo v52)", async () => {
  const content = await fs.readFile(podFilePath, "utf8");

  expect(content).toMatchSnapshot();
});
