import {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
} from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import { FileManagement } from '../../plugin/src/helpers/utils/fileManagement';
import {
  withNotificationIconAndColor,
  FIREBASE_NOTIFICATION_COLOR_METADATA,
  FIREBASE_NOTIFICATION_ICON_METADATA,
  NOTIFICATION_COLOR_RESOURCE,
  NOTIFICATION_ICON_ASSET,
} from '../../plugin/src/android/withNotificationIconAndColor';

jest.mock('@expo/config-plugins', () => ({
  withAndroidManifest: jest.fn(),
  withAndroidColors: jest.fn(),
  AndroidConfig: {
    Colors: {
      assignColorValue: jest.fn((xml) => xml),
    },
  },
}));

jest.mock('../../plugin/src/helpers/utils/fileManagement', () => ({
  FileManagement: {
    exists: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
  },
}));

const mockWithAndroidManifest = withAndroidManifest as jest.MockedFunction<
  typeof withAndroidManifest
>;
const mockWithAndroidColors = withAndroidColors as jest.MockedFunction<
  typeof withAndroidColors
>;
const mockAssignColorValue = AndroidConfig.Colors
  .assignColorValue as jest.MockedFunction<
  typeof AndroidConfig.Colors.assignColorValue
>;
const mockFileManagement = FileManagement as jest.Mocked<
  typeof FileManagement
>;

const makeApplication = (): ManifestApplication =>
  ({
    $: { 'android:name': '.MainApplication' },
  } as ManifestApplication);

const metadataNames = (app: ManifestApplication): string[] =>
  (app['meta-data'] ?? []).map((m) => m.$['android:name']);

const metadataResource = (
  app: ManifestApplication,
  name: string
): string | undefined =>
  (app['meta-data'] ?? []).find((m) => m.$['android:name'] === name)?.$[
    'android:resource'
  ];

describe('withNotificationIconAndColor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const runWrapper = (
    pushNotification: { icon?: string; color?: string } | undefined
  ) => {
    const application = makeApplication();
    const mockManifestConfig = {
      modResults: { manifest: { application: [application] } },
      modRequest: {
        projectRoot: '/project',
        platformProjectRoot: '/project/android',
      },
    };
    mockWithAndroidManifest.mockImplementation((config, modifier) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modifier(mockManifestConfig as any);
      return config;
    });

    const colorsXml = { resources: {} };
    const mockColorsConfig = { modResults: colorsXml };
    mockWithAndroidColors.mockImplementation((config, modifier) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modifier(mockColorsConfig as any);
      return config;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withNotificationIconAndColor({} as any, {
      androidPath: '/test',
      pushNotification,
    });

    return application;
  };

  it('writes both meta-data entries as resource references when icon and color reference existing resources', () => {
    const app = runWrapper({
      icon: '@drawable/ic_stat_notification',
      color: '@color/notification_accent',
    });

    expect(metadataNames(app)).toEqual([
      FIREBASE_NOTIFICATION_ICON_METADATA,
      FIREBASE_NOTIFICATION_COLOR_METADATA,
    ]);
    expect(
      metadataResource(app, FIREBASE_NOTIFICATION_ICON_METADATA)
    ).toEqual('@drawable/ic_stat_notification');
    expect(
      metadataResource(app, FIREBASE_NOTIFICATION_COLOR_METADATA)
    ).toEqual('@color/notification_accent');

    // Nothing to copy and no color value to write
    expect(mockFileManagement.copyFile).not.toHaveBeenCalled();
    expect(mockWithAndroidColors).not.toHaveBeenCalled();
  });

  it('writes a hex color into colors.xml under the plugin-owned resource name', () => {
    const app = runWrapper({ color: '#1DA1F2' });

    expect(mockAssignColorValue).toHaveBeenCalledWith(expect.anything(), {
      name: NOTIFICATION_COLOR_RESOURCE,
      value: '#1DA1F2',
    });
    expect(
      metadataResource(app, FIREBASE_NOTIFICATION_COLOR_METADATA)
    ).toEqual(`@color/${NOTIFICATION_COLOR_RESOURCE}`);
  });

  it('copies a local icon into the drawable resources and references it', () => {
    mockFileManagement.exists.mockReturnValue(true);
    const app = runWrapper({ icon: './assets/notification-icon.png' });

    expect(mockFileManagement.copyFile).toHaveBeenCalledWith(
      '/project/assets/notification-icon.png',
      `/project/android/app/src/main/res/drawable/${NOTIFICATION_ICON_ASSET}.png`
    );
    expect(
      metadataResource(app, FIREBASE_NOTIFICATION_ICON_METADATA)
    ).toEqual(`@drawable/${NOTIFICATION_ICON_ASSET}`);
  });

  it('skips the icon entirely when the local file does not exist', () => {
    mockFileManagement.exists.mockReturnValue(false);
    const app = runWrapper({ icon: './assets/missing.png' });

    expect(mockFileManagement.copyFile).not.toHaveBeenCalled();
    // No meta-data pointing at a drawable that was never created, which would
    // fail the Android resource build.
    expect(app['meta-data']).toBeUndefined();
  });

  it('throws on a malformed color value', () => {
    expect(() => runWrapper({ color: 'not-a-color' })).toThrow(
      /pushNotification\.color/
    );
  });

  it('is a no-op when neither icon nor color is configured', () => {
    const app = runWrapper(undefined);
    expect(app['meta-data']).toBeUndefined();
    expect(mockWithAndroidColors).not.toHaveBeenCalled();
    expect(mockFileManagement.copyFile).not.toHaveBeenCalled();
  });
});
