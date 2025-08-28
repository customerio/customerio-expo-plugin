import { withAndroidManifest } from '@expo/config-plugins';
import { DEFAULT_LOW_PRIORITY, withAndroidManifestUpdates } from '../../plugin/src/android/withAndroidManifestUpdates';
import type { CustomerIOPluginOptionsAndroid } from '../../plugin/src/types/cio-types';

jest.mock('@expo/config-plugins');

const mockWithAndroidManifest = withAndroidManifest as jest.MockedFunction<typeof withAndroidManifest>;

describe('Android Manifest Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockConfig = (existingServices: any[] = []) => ({
    modResults: {
      manifest: {
        application: [{
          service: existingServices
        }]
      }
    }
  });

  const createMockOptions = (setHighPriorityPushHandler?: boolean): CustomerIOPluginOptionsAndroid => ({
    androidPath: '/test/path',
    setHighPriorityPushHandler
  });

  const customerIOServiceName = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
  const messagingAction = 'com.google.firebase.MESSAGING_EVENT';

  describe('when setHighPriorityPushHandler is true', () => {
    it('should add CustomerIO service without priority (high priority)', () => {
      const mockConfig = createMockConfig();

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(true));

      const services = mockConfig.modResults.manifest.application[0].service;
      expect(services).toHaveLength(1);

      const cioService = services[0];
      expect(cioService.$['android:name']).toBe(customerIOServiceName);
      expect(cioService.$['android:exported']).toBe('false');
      expect(cioService['intent-filter']).toHaveLength(1);

      const intentFilter = cioService['intent-filter'][0];
      expect(intentFilter.action[0].$['android:name']).toBe(messagingAction);
      // High priority should not have android:priority attribute
      expect(intentFilter.$).toBeUndefined();
    });
  });

  describe('when setHighPriorityPushHandler is false', () => {
    it('should use default -10 priority when no priorities exist or all are higher', () => {
      // Test with no existing services
      const mockConfigEmpty = createMockConfig();
      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfigEmpty as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(false));

      let services = mockConfigEmpty.modResults.manifest.application[0].service;
      expect(services).toHaveLength(1);
      expect(services[0]['intent-filter'][0].$['android:priority']).toBe(DEFAULT_LOW_PRIORITY.toString());

      // Test with higher existing priorities
      const existingServices = [
        {
          $: { 'android:name': 'some.other.Service' },
          'intent-filter': [{
            $: { 'android:priority': '5' },
            action: [{ $: { 'android:name': 'some.action' } }]
          }]
        },
        {
          $: { 'android:name': 'another.Service' },
          'intent-filter': [{
            // No priority attribute
            action: [{ $: { 'android:name': 'another.action' } }]
          }]
        }
      ];

      const mockConfigWithHigher = createMockConfig(existingServices);
      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfigWithHigher as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(false));

      services = mockConfigWithHigher.modResults.manifest.application[0].service;
      expect(services).toHaveLength(3);
      const cioService = services[2];
      expect(cioService['intent-filter'][0].$['android:priority']).toBe(DEFAULT_LOW_PRIORITY.toString());
    });

    it('should go lower than existing negative priorities', () => {
      const existingServices = [
        {
          $: { 'android:name': 'some.other.Service' },
          'intent-filter': [{
            $: { 'android:priority': '-5' },
            action: [{ $: { 'android:name': 'some.action' } }]
          }]
        },
        {
          $: { 'android:name': 'another.Service' },
          'intent-filter': [{
            $: { 'android:priority': '-10' },
            action: [{ $: { 'android:name': 'another.action' } }]
          }]
        }
      ];

      const mockConfig = createMockConfig(existingServices);

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(false));

      const services = mockConfig.modResults.manifest.application[0].service;
      expect(services).toHaveLength(3);

      const cioService = services[2]; // Should be the last added
      const intentFilter = cioService['intent-filter'][0];
      // Should be -10 - 1 = -11 (one less than the minimum existing priority)
      expect(intentFilter.$['android:priority']).toBe('-11');
    });

  });

  describe('when CustomerIO service already exists', () => {
    it('should not add duplicate service when setHighPriorityPushHandler is true', () => {
      const existingServices = [
        {
          $: {
            'android:name': customerIOServiceName,
            'android:exported': 'false'
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': messagingAction } }]
          }]
        }
      ];

      const mockConfig = createMockConfig(existingServices);

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(true));

      const services = mockConfig.modResults.manifest.application[0].service;
      // Should still be 1 (not duplicated)
      expect(services).toHaveLength(1);
    });

    it('should update existing service priority when setHighPriorityPushHandler is false', () => {
      const existingServices = [
        {
          $: {
            'android:name': customerIOServiceName,
            'android:exported': 'false'
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': messagingAction } }]
          }]
        }
      ];

      const mockConfig = createMockConfig(existingServices);

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(false));

      const services = mockConfig.modResults.manifest.application[0].service;
      // Should still be 1 (not duplicated)
      expect(services).toHaveLength(1);

      const cioService = services[0];
      const intentFilter = cioService['intent-filter'][0];
      // Should have updated the existing service with low priority
      expect(intentFilter.$['android:priority']).toBe(DEFAULT_LOW_PRIORITY.toString());
    });

    it('should update existing service priority considering other services', () => {
      const existingServices = [
        {
          $: {
            'android:name': customerIOServiceName,
            'android:exported': 'false'
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': messagingAction } }]
          }]
        },
        {
          $: { 'android:name': 'some.other.Service' },
          'intent-filter': [{
            $: { 'android:priority': '-15' },
            action: [{ $: { 'android:name': 'some.action' } }]
          }]
        }
      ];

      const mockConfig = createMockConfig(existingServices);

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(false));

      const services = mockConfig.modResults.manifest.application[0].service;
      expect(services).toHaveLength(2);

      const cioService = services[0];
      const intentFilter = cioService['intent-filter'][0];
      // Should be -15 - 1 = -16 (lower than existing -15)
      expect(intentFilter.$['android:priority']).toBe('-16');
    });
  });

  describe('when application services array does not exist', () => {
    it('should create services array and add CustomerIO service', () => {
      const mockConfig = {
        modResults: {
          manifest: {
            application: [{}] // No service property
          }
        }
      };

      mockWithAndroidManifest.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      withAndroidManifestUpdates({} as any, createMockOptions(true));

      const application = mockConfig.modResults.manifest.application[0] as any;
      expect(application.service).toBeDefined();
      expect(application.service).toHaveLength(1);
      expect(application.service[0].$['android:name']).toBe(customerIOServiceName);
    });
  });
});
