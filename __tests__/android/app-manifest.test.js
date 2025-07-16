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

test("Plugin injects notification channel metadata in the app manifest", async () => {
  // When pushNotification.channel config is set with id, name, and importance
  // metadata tags should be added to the app Manifest file
  const manifestContent = await fs.readFile(appManifestPath, "utf8");

  parseString(manifestContent, (err, manifest) => {
    if (err) throw err;

    const application = manifest?.manifest?.application?.[0];
    expect(application).toBeDefined();

    const metadataList = application['meta-data'] || [];
    
    // Check for channel ID metadata
    const channelIdMetadata = metadataList.find(
      metadata => metadata['$']['android:name'] === 'io.customer.notification_channel_id'
    );
    expect(channelIdMetadata).toBeDefined();
    
    // Check for channel name metadata
    const channelNameMetadata = metadataList.find(
      metadata => metadata['$']['android:name'] === 'io.customer.notification_channel_name'
    );
    expect(channelNameMetadata).toBeDefined();
    
    // Check for channel importance metadata
    const channelImportanceMetadata = metadataList.find(
      metadata => metadata['$']['android:name'] === 'io.customer.notification_channel_importance'
    );
    expect(channelImportanceMetadata).toBeDefined();
    
    // Verify the values match what's configured in the test app (app.json)
    expect(channelIdMetadata['$']['android:value']).toBe('cio-expo-id');
    expect(channelNameMetadata['$']['android:value']).toBe('CIO Test');
    expect(channelImportanceMetadata['$']['android:value']).toBe('4');
  });
});
