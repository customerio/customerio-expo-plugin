const { testAppPath } = require("../utils");
const fs = require("fs-extra");
const path = require("path");
const { parseString } = require('xml2js');

const testProjectPath = testAppPath();
const androidPath = path.join(testProjectPath, "android");
const appManifestPath = path.join(androidPath, "app/src/main/AndroidManifest.xml");

test("Plugin injects CustomerIOFirebaseMessagingService in the app manifest", async () => {
  // When setHighPriorityPushHandler config is set to true when setting up the plugin
  // an intent filter for CustomerIOFirebaseMessagingService is added to the app Manifest file
  const manifestContent = await fs.readFile(appManifestPath, "utf8");

  parseString(manifestContent, (err, manifest) => {
    if (err) throw err;

    const expectedServiceName = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
    const expectedAction = 'com.google.firebase.MESSAGING_EVENT';

    const application = manifest?.manifest?.application?.[0];
    expect(application).toBeDefined();

    const services = application.service || [];
    const service = services.find(service => service['$']['android:name'] === expectedServiceName);
    expect(service).toBeDefined();

    expect(service['$']['android:exported']).toBe('false');
    expect(service['intent-filter']).toBeDefined();
    expect(service['intent-filter'].length).toBeGreaterThan(0);

    const actions = service['intent-filter'][0].action || [];
    const hasExpectedAction = actions.some(action => action['$']['android:name'] === expectedAction);
    expect(hasExpectedAction).toBe(true);
  });
});
