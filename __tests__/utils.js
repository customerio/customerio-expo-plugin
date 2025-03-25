const path = require("path");
const fs = require("fs-extra");

/**
 * Gets the test app path from environment or uses default
 * @returns {string} The path to the test app
 */
function testAppPath() {
    const appPath = process.env.TEST_APP_PATH
    if (appPath) {
        return path.join(appPath)
    }
    return path.join(__dirname, "../test-app")
}

/**
 * Gets the test app name from environment or uses default
 * @returns {string} The name of the test app
 */
function testAppName() {
    return process.env.TEST_APP_NAME || "ExpoTestbed"
}

/**
 * Gets the Expo SDK version from the test app
 * @param {string} appPath - Path to the app
 * @returns {string} Expo SDK version
 */
async function getExpoVersion(appPath = testAppPath()) {
    try {
        const packageJson = await fs.readJson(path.join(appPath, 'package.json'));
        const expoVersion = packageJson.dependencies.expo.replace('^', '').replace('~', '');
        return expoVersion;
    } catch (error) {
        console.warn('Could not determine Expo version:', error.message);
        return 'unknown';
    }
}

/**
 * Creates a partial file snapshot that captures only what's important
 * @param {string} content - Full file content
 * @param {Object} options - Options for creating partial snapshot
 * @param {string[]} options.include - Strings that must be included
 * @param {string[]} options.exclude - Strings that should be excluded
 * @param {RegExp[]} options.patterns - Regex patterns to extract content
 * @returns {Object} Partial snapshot object
 */
function createPartialSnapshot(content, { include = [], exclude = [], patterns = [] }) {
    const result = {
        includes: {},
        extracts: []
    };
    
    // Check for required strings
    include.forEach(str => {
        result.includes[str] = content.includes(str);
    });
    
    // Extract patterns
    patterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
            result.extracts.push(matches[0]);
        }
    });
    
    return result;
}

/**
 * Runs a test for each specified parameter
 * @param {string} title - Test title
 * @param {Array} params - Parameters to test with
 * @param {Function} testFn - Test function (receives param)
 */
function testEachParam(title, params, testFn) {
    test.each(params)(`${title} [%s]`, (param) => testFn(param));
}

module.exports = { 
    testAppPath, 
    testAppName, 
    getExpoVersion,
    createPartialSnapshot,
    testEachParam
};