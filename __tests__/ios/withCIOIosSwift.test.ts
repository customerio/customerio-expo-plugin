import type { ExpoConfig } from '@expo/config-types';
import { withCIOIosSwift } from '../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../../plugin/src/types/cio-types';

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
});
