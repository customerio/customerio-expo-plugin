import { withGradleProperties } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { withLocationGradleProperties } from '../../plugin/src/android/withLocationGradleProperties';

jest.mock('@expo/config-plugins');

const mockWithGradleProperties = withGradleProperties as jest.MockedFunction<
  typeof withGradleProperties
>;

describe('withLocationGradleProperties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds customerio_location_enabled=true when location.enabled is true', () => {
    const mockConfig = {
      modResults: [
        { type: 'property' as const, key: 'someKey', value: 'someValue' },
      ],
    };

    mockWithGradleProperties.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withLocationGradleProperties({} as ExpoConfig, {
      location: { enabled: true },
    });

    expect(mockConfig.modResults).toContainEqual({
      type: 'property',
      key: 'customerio_location_enabled',
      value: 'true',
    });
    expect(mockConfig.modResults).toHaveLength(2);
  });

  it('updates existing customerio_location_enabled when location.enabled is true', () => {
    const mockConfig = {
      modResults: [
        {
          type: 'property' as const,
          key: 'customerio_location_enabled',
          value: 'false',
        },
      ],
    };

    mockWithGradleProperties.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withLocationGradleProperties({} as ExpoConfig, {
      location: { enabled: true },
    });

    expect(mockConfig.modResults).toHaveLength(1);
    expect(mockConfig.modResults[0]).toEqual({
      type: 'property',
      key: 'customerio_location_enabled',
      value: 'true',
    });
  });

  it('does not modify config when location.enabled is false', () => {
    mockWithGradleProperties.mockImplementation((config) => config);

    const config = {} as ExpoConfig;
    const result = withLocationGradleProperties(config, {
      location: { enabled: false },
    });

    expect(result).toBe(config);
    expect(mockWithGradleProperties).not.toHaveBeenCalled();
  });

  it('does not modify config when location is omitted', () => {
    mockWithGradleProperties.mockImplementation((config) => config);

    const config = {} as ExpoConfig;
    const result = withLocationGradleProperties(config, {});

    expect(result).toBe(config);
    expect(mockWithGradleProperties).not.toHaveBeenCalled();
  });
});
