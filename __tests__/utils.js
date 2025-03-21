const path = require("path");

function testAppPath() {
    const appPath = process.env.TEST_APP_PATH || "../test-app"
    return path.join(appPath);
}

function testAppName() {
    return process.env.TEST_APP_NAME || "ExpoTestbed"
}

module.exports = { testAppPath, testAppName };