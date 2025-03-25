const { testAppPath } = require("../utils");
const path = require("path");
const g2js = require('gradle-to-js/lib/parser');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, "android");
const appBuildGradlePath = path.join(androidPath, "app/build.gradle");

test("Plugin applies Google Services plugin in the app Gradle build file", async () => {
  const gradleFileAsJson = await g2js.parseFile(appBuildGradlePath);

  const hasPlugin = gradleFileAsJson.apply.some(plugin => plugin.includes('com.google.gms.google-services'));
  expect(hasPlugin).toBe(true);
});
