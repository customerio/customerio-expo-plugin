import { withStringsXml } from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';
import { addStringsToXml, withProjectStrings } from '../../plugin/src/android/withProjectStrings';
import { getPluginVersion } from '../../plugin/src/utils/plugin';

jest.mock('@expo/config-plugins');

const mockWithStringsXml = withStringsXml as jest.MockedFunction<typeof withStringsXml>;

describe('Android Project Strings Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer.io SDK client metadata strings', () => {
    it('should set client source to "Expo" and version to current plugin version', () => {
      const mockConfig = {
        modResults: {
          resources: {
            string: []
          }
        }
      };

      mockWithStringsXml.mockImplementation((config, modifier) => {
        modifier(mockConfig as any);
        return config;
      });

      // Read the actual package.json to get the expected version
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const expectedVersion = packageJson.version;

      withProjectStrings({} as any);

      expect(mockConfig.modResults.resources.string).toContainEqual({
        $: { name: 'customer_io_react_native_sdk_client_source' },
        _: 'Expo'
      });
      expect(mockConfig.modResults.resources.string).toContainEqual({
        $: { name: 'customer_io_react_native_sdk_client_version' },
        _: expectedVersion
      });
    });
  });

  describe('addStringsToXml utility', () => {
    it('should add Customer.io SDK strings to empty XML', () => {
      const stringsXml = {
        resources: {
          string: []
        }
      };

      const stringResources = [
        { name: 'customer_io_react_native_sdk_client_source', value: 'Expo' },
        { name: 'customer_io_react_native_sdk_client_version', value: getPluginVersion() }
      ];

      addStringsToXml(stringsXml, stringResources);

      expect(stringsXml.resources.string).toHaveLength(2);
      expect(stringsXml.resources.string[0]).toEqual({
        $: { name: 'customer_io_react_native_sdk_client_source' },
        _: 'Expo'
      });
      expect(stringsXml.resources.string[1]).toEqual({
        $: { name: 'customer_io_react_native_sdk_client_version' },
        _: getPluginVersion()
      });
    });

    it('should update existing Customer.io SDK strings', () => {
      const stringsXml = {
        resources: {
          string: [
            {
              $: { name: 'customer_io_react_native_sdk_client_source' },
              _: 'ReactNative'
            },
            {
              $: { name: 'customer_io_react_native_sdk_client_version' },
              _: '1.0.0'
            }
          ]
        }
      };

      const stringResources = [
        { name: 'customer_io_react_native_sdk_client_source', value: 'Expo' },
        { name: 'customer_io_react_native_sdk_client_version', value: getPluginVersion() }
      ];

      addStringsToXml(stringsXml, stringResources);

      expect(stringsXml.resources.string).toHaveLength(2);
      expect(stringsXml.resources.string[0]._).toBe('Expo');
      expect(stringsXml.resources.string[1]._).toBe(getPluginVersion());
    });

    it('should create XML structure when missing', () => {
      const stringsXml = {};

      const stringResources = [
        { name: 'customer_io_react_native_sdk_client_source', value: 'Expo' }
      ];

      addStringsToXml(stringsXml as any, stringResources);

      expect(stringsXml).toEqual({
        resources: {
          string: [
            {
              $: { name: 'customer_io_react_native_sdk_client_source' },
              _: 'Expo'
            }
          ]
        }
      });
    });
  });
});
