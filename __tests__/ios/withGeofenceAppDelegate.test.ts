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

// Expo SDK 54 uses `internal import Expo`.
const APP_DELEGATE_INTERNAL_IMPORT = PRISTINE_APP_DELEGATE.replace(
  'import Expo',
  'internal import Expo'
);

describe('modifyAppDelegateForGeofenceBootstrap', () => {
  it('adds the geofence import guarded by canImport', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    expect(result).toContain('#if canImport(CioLocationGeofence)');
    expect(result).toContain('import CioLocationGeofence');
    // Import lands after the existing imports, before the class declaration.
    expect(result.indexOf('import CioLocationGeofence')).toBeLessThan(
      result.indexOf('class AppDelegate')
    );
  });

  it('injects the bootstrap at the top of didFinishLaunchingWithOptions, before React Native starts', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    expect(result).toContain(
      'GeofenceModule.bootstrapForBackgroundDelivery(launchOptions: launchOptions)'
    );
    // Cold-wake delivery must not depend on the JS runtime, so the bootstrap has to run before
    // factory.startReactNative(...) boots React Native (and before the delegate is created).
    const bootstrapIdx = result.indexOf('bootstrapForBackgroundDelivery');
    expect(bootstrapIdx).toBeGreaterThan(-1);
    expect(bootstrapIdx).toBeLessThan(result.indexOf('let delegate = ReactNativeDelegate()'));
    expect(bootstrapIdx).toBeLessThan(result.indexOf('factory.startReactNative'));
  });

  it('guards the bootstrap call with canImport', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    const guardCount = (result.match(/#if canImport\(CioLocationGeofence\)/g) || []).length;
    // One guard for the import, one for the bootstrap call.
    expect(guardCount).toBe(2);
  });

  it('handles the `internal import` variant', () => {
    const result = modifyAppDelegateForGeofenceBootstrap(APP_DELEGATE_INTERNAL_IMPORT);
    expect(result).toContain('import CioLocationGeofence');
    expect(result).toContain('bootstrapForBackgroundDelivery');
  });

  it('is idempotent', () => {
    const once = modifyAppDelegateForGeofenceBootstrap(PRISTINE_APP_DELEGATE);
    const twice = modifyAppDelegateForGeofenceBootstrap(once);
    expect(twice).toBe(once);
    expect((twice.match(/bootstrapForBackgroundDelivery/g) || []).length).toBe(1);
  });

  it('injects the bootstrap on re-run when only the import was applied previously', () => {
    // Simulates a prior prebuild that added the import but failed to inject the bootstrap:
    // the re-run must add the missing bootstrap without duplicating the import.
    const importOnly = PRISTINE_APP_DELEGATE.replace(
      'import ReactAppDependencyProvider',
      'import ReactAppDependencyProvider\n\n#if canImport(CioLocationGeofence)\nimport CioLocationGeofence\n#endif'
    );
    const result = modifyAppDelegateForGeofenceBootstrap(importOnly);
    expect(result).toContain(
      'GeofenceModule.bootstrapForBackgroundDelivery(launchOptions: launchOptions)'
    );
    expect((result.match(/import CioLocationGeofence/g) || []).length).toBe(1);
  });
});
