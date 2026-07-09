import { withGradleProperties } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { withGeofenceGradleProperties } from '../../plugin/src/android/withGeofenceGradleProperties';

jest.mock('@expo/config-plugins');

const mockWithGradleProperties = withGradleProperties as jest.MockedFunction<
  typeof withGradleProperties
>;

describe('withGeofenceGradleProperties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds customerio_geofence_enabled=true when geofence.enabled is true', () => {
    const mockConfig = {
      modResults: [
        { type: 'property' as const, key: 'someKey', value: 'someValue' },
      ],
    };

    mockWithGradleProperties.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withGeofenceGradleProperties({} as ExpoConfig, {
      geofence: { enabled: true },
    });

    expect(mockConfig.modResults).toContainEqual({
      type: 'property',
      key: 'customerio_geofence_enabled',
      value: 'true',
    });
    expect(mockConfig.modResults).toHaveLength(2);
  });

  it('updates existing customerio_geofence_enabled when geofence.enabled is true', () => {
    const mockConfig = {
      modResults: [
        {
          type: 'property' as const,
          key: 'customerio_geofence_enabled',
          value: 'false',
        },
      ],
    };

    mockWithGradleProperties.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withGeofenceGradleProperties({} as ExpoConfig, {
      geofence: { enabled: true },
    });

    expect(mockConfig.modResults).toHaveLength(1);
    expect(mockConfig.modResults[0]).toEqual({
      type: 'property',
      key: 'customerio_geofence_enabled',
      value: 'true',
    });
  });

  it('does not modify config when geofence.enabled is false', () => {
    mockWithGradleProperties.mockImplementation((config) => config);

    const config = {} as ExpoConfig;
    const result = withGeofenceGradleProperties(config, {
      geofence: { enabled: false },
    });

    expect(result).toBe(config);
    expect(mockWithGradleProperties).not.toHaveBeenCalled();
  });

  it('does not modify config when geofence is omitted', () => {
    mockWithGradleProperties.mockImplementation((config) => config);

    const config = {} as ExpoConfig;
    const result = withGeofenceGradleProperties(config, {});

    expect(result).toBe(config);
    expect(mockWithGradleProperties).not.toHaveBeenCalled();
  });
});
