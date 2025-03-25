const { getTestPaths } = require("../helpers/testConfig");
const { parseGradleFile } = require("../helpers/parsers");

describe('Android Gradle Customizations', () => {
  const { appBuildGradlePath } = getTestPaths();

  test("Plugin applies Google Services plugin in the app Gradle build file", async () => {
    const gradleFileAsJson = await parseGradleFile(appBuildGradlePath);
    
    // Using our custom matcher
    expect(gradleFileAsJson).toHaveGoogleServicesPlugin();
  });
});
