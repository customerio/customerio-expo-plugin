import type { ExpoConfig } from '@expo/config-types';
import * as fs from 'fs';
import os from 'os';
import path from 'path';
import {
  hasExpoSceneLifecycle,
  modifyAppDelegateForLiveActivityUrl,
  modifyAppDelegateForNativeSDKInitializer,
  modifyAppDelegateForPushHandler,
  withCIOIosSwift,
} from '../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { getFixturePath } from '../utils';

describe('hasExpoSceneLifecycle', () => {
  let projectRoot: string;
  const projectName = 'TestApp';

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cio-expo-scenes-'));
    fs.mkdirSync(path.join(projectRoot, projectName));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('requires both Expo SceneDelegate and the scene manifest before moving URL ownership', () => {
    expect(hasExpoSceneLifecycle(projectRoot, projectName)).toBe(false);

    fs.writeFileSync(
      path.join(projectRoot, projectName, 'SceneDelegate.swift'),
      'class SceneDelegate: ExpoAppSceneDelegate {}'
    );
    fs.writeFileSync(
      path.join(projectRoot, projectName, 'Info.plist'),
      '<plist><dict></dict></plist>'
    );
    expect(hasExpoSceneLifecycle(projectRoot, projectName)).toBe(false);

    fs.writeFileSync(
      path.join(projectRoot, projectName, 'Info.plist'),
      '<plist><dict><key>UIApplicationSceneManifest</key><dict/></dict></plist>'
    );
    expect(hasExpoSceneLifecycle(projectRoot, projectName)).toBe(false);

    fs.writeFileSync(
      path.join(projectRoot, projectName, 'Info.plist'),
      '<plist><dict><key>UIApplicationSceneManifest</key><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></dict></plist>'
    );
    expect(hasExpoSceneLifecycle(projectRoot, projectName)).toBe(true);
  });
});

// Mock dependencies
jest.mock('@expo/config-plugins', () => ({
  withXcodeProject: jest.fn((config, callback) => {
    const mockXcodeConfig = {
      modRequest: { projectRoot: '/test/project', projectName: 'TestApp' },
      modResults: {
        pbxCreateGroup: jest.fn(() => 'mock-group'),
        pbxGroupByName: jest.fn(() => null),
        findPBXGroupKey: jest.fn(() => 'mock-key'),
        addToPbxGroup: jest.fn(),
        addSourceFile: jest.fn(),
      },
    };
    callback(mockXcodeConfig);
    return config;
  }),
  withAppDelegate: jest.fn((_config, callback) => {
    const mockAppDelegateConfig = {
      modResults: {
        contents: `import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`,
      },
    };
    return callback(mockAppDelegateConfig);
  }),
}));

jest.mock('../../plugin/src/helpers/utils/fileManagement', () => ({
  FileManagement: {
    copyFile: jest.fn(),
    readFile: jest.fn(() => 'mock file content {{AUTO_TRACK_PUSH_EVENTS}} {{AUTO_FETCH_DEVICE_TOKEN}} {{SHOW_PUSH_APP_IN_FOREGROUND}} {{APP_GROUP_ID_BUILDER_LINE}}'),
    writeFile: jest.fn(),
  },
}));

jest.mock('../../plugin/src/utils/xcode', () => ({
  copyFileToXcode: jest.fn(),
  getOrCreateCustomerIOGroup: jest.fn(() => 'mock-group'),
}));

jest.mock('../../plugin/src/helpers/utils/patchPluginNativeCode', () => ({
  patchNativeSDKInitializer: jest.fn((content) => `patched: ${content}`),
}));

describe('withCIOIosSwift', () => {
  const mockConfig: ExpoConfig = {
    name: 'Test App',
    slug: 'test-app',
    sdkVersion: '53.0.0',
  };

  const mockSdkConfig: NativeSDKConfig = {
    cdpApiKey: 'test-api-key',
    region: 'US',
    autoTrackDeviceAttributes: true,
    trackApplicationLifecycleEvents: true,
    screenViewUse: 'all',
    logLevel: 'debug',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with push notifications configured', () => {
    const mockPropsWithPush: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      pushNotification: {
        provider: 'apn',
        autoFetchDeviceToken: true,
        autoTrackPushEvents: true,
        showPushAppInForeground: true,
      },
    };

    it('should copy CioSdkAppDelegateHandler and inject handler call', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, mockSdkConfig, mockPropsWithPush);

      // Should call withAppDelegate to modify AppDelegate
      expect(withAppDelegate).toHaveBeenCalled();

      // The callback should modify AppDelegate to add handler call
      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: {
          contents: `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`,
        },
      });

      expect(result.modResults.contents).toContain('cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)');
      expect(result.modResults.contents).toContain('let cioSdkHandler = CioSdkAppDelegateHandler()');
    });

    it('moves URL routing only after the generated project has adopted scenes', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'cio-expo-scene-wiring-')
      );
      const projectName = 'TestApp';
      const projectDirectory = path.join(projectRoot, projectName);
      fs.mkdirSync(projectDirectory);

      try {
        withCIOIosSwift(
          mockConfig,
          mockSdkConfig,
          mockPropsWithPush,
          undefined,
          undefined,
          false,
          true
        );
        const appDelegateCallback = withAppDelegate.mock.calls[0][1];
        const contents = fs.readFileSync(
          getFixturePath('ios', 'AppDelegate.sdk58.swift'),
          'utf8'
        );
        const modRequest = {
          platformProjectRoot: projectRoot,
          projectName,
        };

        const withoutScenes = await appDelegateCallback({
          modRequest,
          modResults: { contents },
        });
        expect(withoutScenes.modResults.contents).not.toContain(
          'NativeCustomerIO.configureExpoSceneDeepLinkRouting()'
        );
        expect(withoutScenes.modResults.contents).toContain(
          'cioSdkHandler.application(app, open: url, options: options)'
        );

        fs.writeFileSync(
          path.join(projectDirectory, 'SceneDelegate.swift'),
          'class SceneDelegate: ExpoAppSceneDelegate {}'
        );
        fs.writeFileSync(
          path.join(projectDirectory, 'Info.plist'),
          '<plist><dict><key>UIApplicationSceneManifest</key><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></dict></plist>'
        );

        const withScenes = await appDelegateCallback({
          modRequest,
          modResults: { contents },
        });
        expect(withScenes.modResults.contents).toContain(
          'NativeCustomerIO.configureExpoSceneDeepLinkRouting()'
        );
        expect(withScenes.modResults.contents).not.toContain(
          'cioSdkHandler.application(app, open: url, options: options)'
        );
      } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });

  describe('with auto-init only (no push notifications)', () => {
    const mockPropsAutoInitOnly: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      // No pushNotification property
    };

    it('should inject CustomerIOSDKInitializer.initialize() directly into AppDelegate', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, mockSdkConfig, mockPropsAutoInitOnly);

      // Should still call withAppDelegate to modify AppDelegate
      expect(withAppDelegate).toHaveBeenCalled();

      // The callback should modify AppDelegate to add direct auto-init call
      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: {
          contents: `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`,
        },
      });

      // Should inject direct auto-initialization
      expect(result.modResults.contents).toContain('CustomerIOSDKInitializer.initialize()');
      expect(result.modResults.contents).toContain('// Auto Initialize Native Customer.io SDK');

      // Should NOT inject CioSdkAppDelegateHandler code
      expect(result.modResults.contents).not.toContain('cioSdkHandler.application');
      expect(result.modResults.contents).not.toContain('let cioSdkHandler = CioSdkAppDelegateHandler()');
    });

  });

  describe('without sdkConfig', () => {
    const mockPropsNoAutoInit: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      pushNotification: {
        provider: 'apn',
        autoFetchDeviceToken: true,
      },
    };

    it('should not inject any auto-initialization code when sdkConfig is undefined', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, undefined, mockPropsNoAutoInit);

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: {
          contents: `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`,
        },
      });

      // Should contain push handler but not auto-init
      expect(result.modResults.contents).toContain('cioSdkHandler.application');
      expect(result.modResults.contents).not.toContain('CustomerIOSDKInitializer.initialize()');
    });
  });

  describe('edge cases', () => {
    it('should handle when neither push notifications nor auto-init are configured', () => {
      const mockPropsEmpty: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
      };

      const { withAppDelegate } = require('@expo/config-plugins');

      // Should not call withAppDelegate when there's nothing to configure
      withCIOIosSwift(mockConfig, undefined, mockPropsEmpty);

      // withAppDelegate should not be called since there's nothing to inject
      expect(withAppDelegate).not.toHaveBeenCalled();
    });

    it('should skip duplicate injections when code already exists', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, mockSdkConfig, { iosPath: '/test/ios' });

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: {
          contents: `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    // Auto Initialize Native Customer.io SDK
    CustomerIOSDKInitializer.initialize()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`,
        },
      });

      // Should not inject duplicate code
      const initializeOccurrences = (result.modResults.contents.match(/CustomerIOSDKInitializer\.initialize\(\)/g) || []).length;
      expect(initializeOccurrences).toBe(1);
    });

    it('should inject .appGroupId(...) builder line when appGroupId is set', () => {
      const { FileManagement } = require('../../plugin/src/helpers/utils/fileManagement');
      const propsWithAppGroup: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
        pushNotification: {
          provider: 'apn',
          appGroupId: 'group.com.example.app',
        },
      };

      withCIOIosSwift(mockConfig, undefined, propsWithAppGroup);

      const writtenContent: string = FileManagement.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('.appGroupId("group.com.example.app")');
    });

    it('should NOT inject .appGroupId(...) builder line when appGroupId is not set', () => {
      const { FileManagement } = require('../../plugin/src/helpers/utils/fileManagement');
      const propsNoAppGroup: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
        pushNotification: {
          provider: 'apn',
        },
      };

      withCIOIosSwift(mockConfig, undefined, propsNoAppGroup);

      const writtenContent: string = FileManagement.writeFile.mock.calls[0][1];
      expect(writtenContent).not.toContain('.appGroupId(');
    });
  });

  describe('handleDeeplinkInKilledState placement', () => {
    const modernAppDelegateFixture = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

    const legacyAppDelegateFixture = `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

    const propsWithDeeplink: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      pushNotification: {
        provider: 'apn',
        handleDeeplinkInKilledState: true,
      },
    };

    it('injects deeplink workaround BEFORE factory.startReactNative on modern Expo Swift templates', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, undefined, propsWithDeeplink);

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: { contents: modernAppDelegateFixture },
      });
      const out: string = result.modResults.contents;

      const snippetIdx = out.indexOf('Deep link workaround for app killed state start');
      const factoryIdx = out.indexOf('factory.startReactNative');
      const ifGuardIdx = out.indexOf('#if os(iOS) || os(tvOS)');

      expect(snippetIdx).toBeGreaterThan(-1);
      expect(factoryIdx).toBeGreaterThan(-1);
      // Snippet must precede both the #if guard and the factory.startReactNative call,
      // otherwise the workaround runs after RN has already bootstrapped.
      expect(snippetIdx).toBeLessThan(ifGuardIdx);
      expect(snippetIdx).toBeLessThan(factoryIdx);
      // Snapshot the full transformed AppDelegate so unintended drift in the snippet content
      // (whitespace, comments, the keys we read from the push payload) is also surfaced.
      expect(out).toMatchSnapshot();
    });

    it('routes modifiedLaunchOptions into factory.startReactNative on modern templates', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, undefined, propsWithDeeplink);

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: { contents: modernAppDelegateFixture },
      });
      const out: string = result.modResults.contents;

      // The factory.startReactNative call must consume modifiedLaunchOptions, not the original.
      expect(out).toMatch(/factory\.startReactNative\([\s\S]*?launchOptions:\s*modifiedLaunchOptions\s*\)/);
      expect(out).not.toMatch(/factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\s*\)/);
      // Trailing super.application is also rewritten for backward compatibility with older templates
      // where it was the call that bootstrapped RN.
      expect(out).toContain(
        'return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)'
      );
      expect(out).toMatchSnapshot();
    });

    it('falls back to rewriting the return statement on legacy templates without factory.startReactNative', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, undefined, propsWithDeeplink);

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const result = await appDelegateCallback({
        modResults: { contents: legacyAppDelegateFixture },
      });
      const out: string = result.modResults.contents;

      const snippetIdx = out.indexOf('Deep link workaround for app killed state start');
      const returnIdx = out.indexOf('return super.application');

      expect(snippetIdx).toBeGreaterThan(-1);
      expect(snippetIdx).toBeLessThan(returnIdx);
      expect(out).toContain(
        'return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)'
      );
    });

    it('is idempotent — repeated invocations do not stack the snippet', async () => {
      const { withAppDelegate } = require('@expo/config-plugins');

      withCIOIosSwift(mockConfig, undefined, propsWithDeeplink);

      const appDelegateCallback = withAppDelegate.mock.calls[0][1];
      const first = await appDelegateCallback({
        modResults: { contents: modernAppDelegateFixture },
      });
      const second = await appDelegateCallback({
        modResults: { contents: first.modResults.contents },
      });
      const out: string = second.modResults.contents;

      const occurrences = (out.match(/Deep link workaround for app killed state start/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

describe('modifyAppDelegateForLiveActivityUrl (Live Notifications without push)', () => {
  // React Native 0.83 / Expo SDK 55 emit `internal import Expo` as the very first line. An
  // expression anchored to a bare `import` at offset 0 matches nothing here, so the imports were
  // silently skipped and the injected `CustomerIO.` reference failed to compile.
  const RN_083_APP_DELEGATE = `internal import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return super.application(app, open: url, options: options)
  }
}
`;

  test('injects both imports after a leading modifier import', () => {
    const out = modifyAppDelegateForLiveActivityUrl(RN_083_APP_DELEGATE);

    // CustomerIO is declared in CioInternalCommon, which only CioDataPipelines re-exports.
    expect(out).toContain('import CioDataPipelines');
    expect(out).toContain('import CioLiveActivities');
    expect(out).toContain('CustomerIO.liveActivities.handleWidgetUrl(url)');
    // Placed after the existing imports, not before them.
    expect(out.indexOf('import CioDataPipelines')).toBeGreaterThan(
      out.indexOf('internal import Expo')
    );
  });

  test('is idempotent', () => {
    const once = modifyAppDelegateForLiveActivityUrl(RN_083_APP_DELEGATE);
    const twice = modifyAppDelegateForLiveActivityUrl(once);

    expect(twice).toBe(once);
    expect(
      (twice.match(/CustomerIO\.liveActivities\.handleWidgetUrl/g) || []).length
    ).toBe(1);
    expect((twice.match(/import CioDataPipelines/g) || []).length).toBe(1);
  });

  test('defers to the push handler when it already owns the method', () => {
    const withPushHandler = `import Expo

public class AppDelegate: ExpoAppDelegate {
  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    guard let url = cioSdkHandler.application(app, open: url, options: options) else { return true }
    return super.application(app, open: url, options: options)
  }
}
`;

    expect(modifyAppDelegateForLiveActivityUrl(withPushHandler)).toBe(withPushHandler);
  });

  // The push path preserves whichever parameter spelling the AppDelegate used, so a template naming
  // it `_ application` leaves an `application, open:` marker. Checking only the `app,` spelling meant
  // an app that dropped push and re-ran prebuild got a second guard inside the same method.
  test('defers to the push handler that used the `application` parameter spelling', () => {
    const withPushHandler = `import Expo

public class AppDelegate: ExpoAppDelegate {
  public override func application(_ application: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    guard let url = cioSdkHandler.application(application, open: url, options: options) else { return true }
    return super.application(application, open: url, options: options)
  }
}
`;

    expect(modifyAppDelegateForLiveActivityUrl(withPushHandler)).toBe(withPushHandler);
  });
});

describe('Expo scene AppDelegate', () => {
  const sceneAppDelegate = fs.readFileSync(
    getFixturePath('ios', 'AppDelegate.sdk58.swift'),
    'utf8'
  );
  const pushProps: CustomerIOPluginOptionsIOS = {
    iosPath: '/test/ios',
    pushNotification: {
      provider: 'apn',
      handleDeeplinkInKilledState: true,
    },
  };

  it('installs React Native routing before native push auto-initialization', () => {
    const output = modifyAppDelegateForPushHandler(
      sceneAppDelegate,
      pushProps,
      true
    );

    expect(output).toContain('import customerio_reactnative');
    expect(output).toContain(
      'NativeCustomerIO.configureExpoSceneDeepLinkRouting()'
    );
    expect(output.indexOf('NativeCustomerIO.configureExpoSceneDeepLinkRouting()'))
      .toBeLessThan(
        output.indexOf(
          'cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)'
        )
      );
    expect(output).not.toContain(
      'Deep link workaround for app killed state start'
    );
    expect(output).not.toContain(
      'cioSdkHandler.application(application, open: url, options: options)'
    );
  });

  it('installs routing before push handling when JavaScript initializes the SDK', () => {
    const output = modifyAppDelegateForPushHandler(
      sceneAppDelegate,
      pushProps,
      true
    );

    expect(output.indexOf('NativeCustomerIO.configureExpoSceneDeepLinkRouting()'))
      .toBeLessThan(
        output.indexOf(
          'cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)'
        )
      );
  });

  it('installs routing before no-push native auto-initialization', () => {
    const output = modifyAppDelegateForNativeSDKInitializer(sceneAppDelegate, true);

    expect(output).toContain(
      'NativeCustomerIO.configureExpoSceneDeepLinkRouting()'
    );
    expect(output.indexOf('NativeCustomerIO.configureExpoSceneDeepLinkRouting()'))
      .toBeLessThan(output.indexOf('CustomerIOSDKInitializer.initialize()'));
  });

  it('installs routing when the generated initialization line has a trailing comment', () => {
    const customized = sceneAppDelegate.replace(
      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
      `CustomerIOSDKInitializer.initialize() // Added by another config plugin
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`
    );
    const output = modifyAppDelegateForNativeSDKInitializer(customized, true);

    expect(output.indexOf('NativeCustomerIO.configureExpoSceneDeepLinkRouting()'))
      .toBeLessThan(output.indexOf('CustomerIOSDKInitializer.initialize()'));
    expect(output).toContain(
      'CustomerIOSDKInitializer.initialize() // Added by another config plugin'
    );
  });

  it('leaves Live Activity URL ownership to SceneDelegate', () => {
    expect(modifyAppDelegateForLiveActivityUrl(sceneAppDelegate, true)).toBe(
      sceneAppDelegate
    );
  });

  it('removes SDK 57 AppDelegate URL handling on an incremental SDK 58 prebuild', () => {
    const sdk57 = modifyAppDelegateForPushHandler(sceneAppDelegate, pushProps);
    const sdk58 = modifyAppDelegateForPushHandler(sdk57, pushProps, true);

    expect(sdk57).toContain('Deep link workaround for app killed state start');
    expect(sdk57).toContain('cioSdkHandler.application(app, open: url, options: options)');
    expect(sdk58).not.toContain('Deep link workaround for app killed state start');
    expect(sdk58).not.toContain('modifiedLaunchOptions');
    expect(sdk58).not.toContain('cioSdkHandler.application(app, open: url, options: options)');
    expect(sdk58).toContain('NativeCustomerIO.configureExpoSceneDeepLinkRouting()');
  });

  it('removes SDK 57 Live Activity AppDelegate routing on an incremental SDK 58 prebuild', () => {
    const sdk57 = modifyAppDelegateForLiveActivityUrl(sceneAppDelegate);
    const sdk58 = modifyAppDelegateForLiveActivityUrl(sdk57, true);

    expect(sdk57).toContain('CustomerIO.liveActivities.handleWidgetUrl');
    expect(sdk58).not.toContain('CustomerIO.liveActivities.handleWidgetUrl');
    expect(sdk58).not.toContain('import CioLiveActivities');
  });

  it('removes SDK 57 Live Activity routing when enabling push during an SDK 58 prebuild', () => {
    const sdk57 = modifyAppDelegateForLiveActivityUrl(sceneAppDelegate);
    const sdk58 = modifyAppDelegateForPushHandler(sdk57, pushProps, true);

    expect(sdk57).toContain('CustomerIO.liveActivities.handleWidgetUrl');
    expect(sdk58).not.toContain('CustomerIO.liveActivities.handleWidgetUrl');
    expect(sdk58).not.toContain('import CioLiveActivities');
    expect(sdk58).toContain(
      'NativeCustomerIO.configureExpoSceneDeepLinkRouting()'
    );
  });

  it('is idempotent', () => {
    const once = modifyAppDelegateForPushHandler(
      sceneAppDelegate,
      pushProps,
      true
    );
    const twice = modifyAppDelegateForPushHandler(once, pushProps, true);

    expect(twice).toBe(once);
    expect(
      (twice.match(/NativeCustomerIO\.configureExpoSceneDeepLinkRouting/g) ?? [])
        .length
    ).toBe(1);
  });
});

// An app can be prebuilt with Live Notifications and no push, then add a push provider. The push
// handler routes activity URLs itself, so the direct call has to go — otherwise the tap is reported
// twice and the same method carries two guards. These round-trip through the real injector so the
// removal cannot drift from the text it removes.
describe('enabling push after a Live-Notifications-only prebuild', () => {
  const APP_DELEGATE_WITH_METHOD = `internal import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return super.application(app, open: url, options: options)
  }
}
`;

  // The injector creates the method itself when the template has none. The push regex still matches
  // that generated method, so this shape stacks guards too.
  const APP_DELEGATE_WITHOUT_METHOD = `internal import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func applicationDidBecomeActive(_ application: UIApplication) {}
}
`;

  const props: CustomerIOPluginOptionsIOS = {
    iosPath: '/test/ios',
    pushNotification: { provider: 'apn' },
  };

  it.each([
    ['a template that already had the method', APP_DELEGATE_WITH_METHOD],
    ['a method the Live Activity injector created', APP_DELEGATE_WITHOUT_METHOD],
  ])('replaces the Live Activity guard with the push handler for %s', (_label, template) => {
    const liveNotificationsOnly = modifyAppDelegateForLiveActivityUrl(template);
    expect(liveNotificationsOnly).toContain('CustomerIO.liveActivities.handleWidgetUrl');

    const withPush = modifyAppDelegateForPushHandler(liveNotificationsOnly, props);

    // Exactly one guard, and it is the push handler's.
    expect(
      (withPush.match(/CustomerIO\.liveActivities\.handleWidgetUrl/g) || []).length
    ).toBe(0);
    expect((withPush.match(/cioSdkHandler\.application\([a-z]+, open:/g) || []).length).toBe(1);
  });

  it('leaves no orphaned comment when the guard came from an existing method', () => {
    const withPush = modifyAppDelegateForPushHandler(
      modifyAppDelegateForLiveActivityUrl(APP_DELEGATE_WITH_METHOD),
      props
    );

    // Only meaningful for this shape: the push injector re-emits the same comment when it has to
    // create the method itself.
    expect(withPush).not.toContain('Report a Live Activity tap');
  });

  it('is idempotent once push has taken over', () => {
    const once = modifyAppDelegateForPushHandler(
      modifyAppDelegateForLiveActivityUrl(APP_DELEGATE_WITH_METHOD),
      props
    );
    const twice = modifyAppDelegateForPushHandler(once, props);

    expect(twice).toBe(once);
  });
});

});
