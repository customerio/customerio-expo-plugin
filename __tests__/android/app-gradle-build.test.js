const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const androidPath = path.join(testProjectPath, "android");
const appBuildGradlePath = path.join(androidPath, "app/build.gradle");

test("Plugin applies Google Services plugin in the app Gradle build file (Expo v52)", async () => {
  const content = await fs.readFile(appBuildGradlePath, "utf8");

  expect(content).toMatchSnapshot();
});
