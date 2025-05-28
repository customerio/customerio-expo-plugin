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

/**
 * Get the Expo version from environment variable
 * @returns {string} The Expo version
 */
function getExpoVersion() {
    return process.env.EXPO_VERSION || "53.0.0"; // Default to 53
}

/**
 * Check if the Expo version is 53 or higher
 * @returns {boolean} True if Expo version is 53 or higher
 */
function isExpoVersion53OrHigher() {
    const version = getExpoVersion();
    const majorVersion = parseInt(version.split('.')[0], 10);
    return !isNaN(majorVersion) && majorVersion >= 53;
}

module.exports = {
    testAppPath,
    testAppName,
    getExpoVersion,
    isExpoVersion53OrHigher
};
