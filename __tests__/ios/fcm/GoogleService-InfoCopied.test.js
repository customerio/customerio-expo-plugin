const fs = require("fs-extra");
const path = require("path");

const testProjectPath = path.join(__dirname, "../../../test-app");
const iosPath = path.join(testProjectPath, "ios");
const appName = "ExpoTestbed"; // Replace with your app name if different
// Define all possible locations where GoogleService-Info.plist might exist
const possibleLocations = [
  path.join(iosPath, "GoogleService-Info.plist"),                    // Our plugin's default location
  path.join(iosPath, appName, "GoogleService-Info.plist"),           // Where React Native Firebase typically adds it
  path.join(iosPath, "Pods", "GoogleService-Info.plist"),            // Sometimes found in Pods
  path.join(iosPath, appName, "Resources", "GoogleService-Info.plist"), // Alternative location in app resources
  path.join(iosPath, "Supporting", "GoogleService-Info.plist")       // Another possible location
];

describe("GoogleService-Info.plist File", () => {
  test("GoogleService-Info.plist exists in at least one expected location", () => {
    // Check all possible locations
    const existsInAnyLocation = possibleLocations.some(location => fs.existsSync(location));
    
    // Log all locations where the file exists
    const existingLocations = possibleLocations.filter(location => fs.existsSync(location));
    if (existingLocations.length > 0) {
      console.log("GoogleService-Info.plist found in these locations:");
      existingLocations.forEach(location => console.log(`- ${location}`));
    } else {
      console.log("GoogleService-Info.plist not found in any expected location");
    }
    
    expect(existsInAnyLocation).toBe(true);
  });
  
  test("GoogleService-Info.plist file is not duplicated", () => {
    // Count how many locations have the file
    const existingLocations = possibleLocations.filter(location => fs.existsSync(location));
    
    // If more than one location has the file, log a warning
    if (existingLocations.length > 1) {
      console.warn("WARNING: GoogleService-Info.plist found in multiple locations:");
      existingLocations.forEach(location => console.log(`- ${location}`));
    }
    
    // We expect the file to be in at most one location
    // This test will pass if the file exists in exactly one location
    // and will fail if it's duplicated
    expect(existingLocations.length).toBeLessThanOrEqual(1);
  });
});
