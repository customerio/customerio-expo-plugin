import { withAppBuildGradle } from '@expo/config-plugins';
import { modifyAppBuildGradle, withAppGoogleServices } from '../../plugin/src/android/withAppGoogleServices';

jest.mock('@expo/config-plugins');

const mockWithAppBuildGradle = withAppBuildGradle as jest.MockedFunction<
  typeof withAppBuildGradle
>;

describe('withAppGoogleServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects the Google Services apply line into a fresh app/build.gradle', () => {
    const before = 'apply plugin: "com.android.application"\napply plugin: "kotlin-android"\n';
    const after = modifyAppBuildGradle(before);
    expect(after).toMatch(
      /apply plugin: "com\.android\.application"\napply plugin: "com\.google\.gms\.google-services"/,
    );
  });

  it('is a no-op when the snippet is already present', () => {
    const already =
      'apply plugin: "com.android.application"\n' +
      'apply plugin: "com.google.gms.google-services"  // Google Services plugin\n';
    expect(modifyAppBuildGradle(already)).toEqual(already);
  });

  it('wires modifyAppBuildGradle through the @expo/config-plugins withAppBuildGradle wrapper', () => {
    const mockConfig = {
      modResults: { contents: 'apply plugin: "com.android.application"\n' },
    };
    mockWithAppBuildGradle.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withAppGoogleServices({} as any, { androidPath: '/test/path' });

    expect(mockWithAppBuildGradle).toHaveBeenCalledTimes(1);
    expect(mockConfig.modResults.contents).toContain(
      'apply plugin: "com.google.gms.google-services"',
    );
  });
});
