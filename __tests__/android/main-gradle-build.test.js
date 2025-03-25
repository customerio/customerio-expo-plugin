const { getTestPaths } = require("../helpers/testConfig");
const { parseGradleFile } = require("../helpers/parsers");
const fs = require('fs-extra');

describe('Android Project Gradle Customizations', () => {
  const { mainBuildGradlePath } = getTestPaths();

  test('Plugin injects expected dependencies in the main Gradle build file', async () => {
    const mainBuildGradleContent = await fs.readFile(mainBuildGradlePath, "utf8");
    const gradleFileAsJson = await parseGradleFile(mainBuildGradlePath);

    // Check for Google Services classpath dependency
    const hasBuildScriptDependency = gradleFileAsJson.buildscript.dependencies.some(
      (dependency) =>
        dependency.group === 'com.google.gms' &&
        dependency.name === 'google-services' &&
        dependency.type === 'classpath'
    );
    
    expect(hasBuildScriptDependency).toBe(true);
    
    // Check for Gist maven repository
    expect(mainBuildGradleContent).toContain('maven { url "https://maven.gist.build" }');
  });
});
