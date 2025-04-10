const path = require("path");

function testAppPath() {
    const appPath = process.env.TEST_APP_PATH
    if (appPath) {
        return path.join(appPath)
    }
    return path.join(__dirname, "../test-app")
}

function testAppName() {
    return process.env.TEST_APP_NAME || "ExpoTestbed"
}

module.exports = { testAppPath, testAppName };
