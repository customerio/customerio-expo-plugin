const { getTestPaths } = require("../helpers/testConfig");
const { parseAndroidManifest } = require("../helpers/parsers");

describe('Android Manifest Customizations', () => {
  const { appManifestPath } = getTestPaths();

  test("Plugin injects CustomerIOFirebaseMessagingService in the app manifest", async () => {
    // When setHighPriorityPushHandler config is set to true when setting up the plugin
    // an intent filter for CustomerIOFirebaseMessagingService is added to the app Manifest file
    const manifest = await parseAndroidManifest(appManifestPath);
    
    // Using our custom matcher
    expect(manifest).toHaveCIOFirebaseService();
    
    // The custom matcher above replaces all these individual assertions:
    // const expectedServiceName = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
    // const expectedAction = 'com.google.firebase.MESSAGING_EVENT';
    // const application = manifest?.manifest?.application?.[0];
    // expect(application).toBeDefined();
    // const services = application.service || [];
    // const service = services.find(service => service['$']['android:name'] === expectedServiceName);
    // expect(service).toBeDefined();
    // expect(service['$']['android:exported']).toBe('false');
    // expect(service['intent-filter']).toBeDefined();
    // expect(service['intent-filter'].length).toBeGreaterThan(0);
    // const actions = service['intent-filter'][0].action || [];
    // const hasExpectedAction = actions.some(action => action['$']['android:name'] === expectedAction);
    // expect(hasExpectedAction).toBe(true);
  });
});
