const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../test-app");
const androidPath = path.join(testProjectPath, "android");
const mainBuildGradlePath = path.join(androidPath, "build.gradle");

test("Plugin injects expted dependencies in the main Gradle build file (Expo v52)", async () => {
  const content = await fs.readFile(mainBuildGradlePath, "utf8");

  expect(content).toMatchSnapshot();
});
