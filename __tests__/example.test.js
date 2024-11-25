const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../test-app");
const iosPath = path.join(testProjectPath, "ios");

// This is only an example to prove that tests actually run and succeed!
test("iOS AppDelegate.swift contains expected pnHandlerObj error call", async () => {
  const appDelegatePath = path.join(iosPath, "testapp/AppDelegate.mm");
  const content = await fs.readFile(appDelegatePath, "utf8");

  expect(content).toContain("[pnHandlerObj application:application error:error];");
});