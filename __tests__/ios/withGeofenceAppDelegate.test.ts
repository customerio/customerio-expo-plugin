import { modifyAppDelegateForGeofenceBootstrap } from '../../plugin/src/ios/withGeofenceAppDelegate';

jest.mock('../../plugin/src/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn() },
}));

// Mirrors the real Expo SDK 53+ Swift AppDelegate: React Native is started via
// factory.startReactNative(...) partway through didFinishLaunchingWithOptions, before the return.
const PRISTINE_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('modifyAppDelegateForGeofenceBootstrap', () => {
  it('adds the handler property to the AppDelegate class', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    expect(result).toContain('let cioGeofenceHandler = CioGeofenceAppDelegateHandler()');
    // Property is declared inside the class, before the method.
    expect(result.indexOf('let cioGeofenceHandler')).toBeGreaterThan(result.indexOf('class AppDelegate'));
    expect(result.indexOf('let cioGeofenceHandler')).toBeLessThan(result.indexOf('func application'));
  });

  it('injects the handler call at the top of didFinishLaunchingWithOptions, before React Native starts', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    expect(result).toContain(
      'cioGeofenceHandler.application(application, didFinishLaunchingWithOptions: launchOptions)'
    );
    // Cold-wake delivery must not depend on the JS runtime, so the call runs before
    // factory.startReactNative(...) boots React Native (and before the delegate is created).
    const callIdx = result.indexOf('cioGeofenceHandler.application(');
    expect(callIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeLessThan(result.indexOf('let delegate = ReactNativeDelegate()'));
    expect(callIdx).toBeLessThan(result.indexOf('factory.startReactNative'));
  });

  it('does not inject a CioLocationGeofence import into the AppDelegate (the handler owns it)', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    expect(result).not.toContain('import CioLocationGeofence');
    expect(result).not.toContain('GeofenceModule.bootstrapForBackgroundDelivery');
  });

  it('is idempotent', () => {
    const once = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    const twice = modifyAppDelegateForGeofenceBootstrap(once);
    expect(twice).toBe(once);
    expect((twice.match(/cioGeofenceHandler\.application\(/g) || []).length).toBe(1);
    expect((twice.match(/let cioGeofenceHandler =/g) || []).length).toBe(1);
  });
});
