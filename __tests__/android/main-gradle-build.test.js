const { testAppPath } = require("../utils");
const fs = require('fs-extra');
const path = require('path');
const g2js = require('gradle-to-js/lib/parser');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, 'android');
const mainBuildGradlePath = path.join(androidPath, 'build.gradle');

test('Plugin injects expted dependencies in the main Gradle build file', async () => {
  const mainBuildGradleContent = await fs.readFile(mainBuildGradlePath, "utf8");
  const gradleFileAsJson = await g2js.parseFile(mainBuildGradlePath);

  const hasBuildScriptDependency = gradleFileAsJson.buildscript.dependencies.some(
    (dependency) =>
      dependency.group === 'com.google.gms' &&
      dependency.name === 'google-services' &&
      dependency.type === 'classpath' &&
      dependency.version === '4.3.13'
  );
  expect(hasBuildScriptDependency).toBe(true);
});
