import Foundation
import UIKit
#if canImport(CioLocationGeofence)
import CioLocationGeofence
#endif

/// Bridges the host app's AppDelegate to the Customer.io geofence background-delivery bootstrap.
///
/// The Expo config plugin injects a single `application(_:didFinishLaunchingWithOptions:)` call into
/// the app's AppDelegate. Keeping the logic here means the AppDelegate edit stays a one-liner and the
/// geofence wiring can evolve without re-touching the app's AppDelegate.
@objc public class CioGeofenceAppDelegateHandler: NSObject {
    // Main-actor isolated because the plugin injects the call into the host AppDelegate's
    // (main-actor) didFinishLaunchingWithOptions, and GeofenceModule.bootstrapForBackgroundDelivery
    // is itself @MainActor. Mirrors the SDK's reference AppDelegate, which calls it directly.
    @MainActor
    @objc public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) {
        #if canImport(CioLocationGeofence)
        // iOS can cold-launch the app for a geofence transition without the JS runtime, so bootstrap
        // background delivery here rather than relying on CustomerIO.initialize. The plugin injects the
        // call before React Native starts, mirroring the SDK's reference AppDelegate — it reads persisted
        // state and re-arms region monitoring independently of the JS runtime, and is safe on every launch.
        GeofenceModule.bootstrapForBackgroundDelivery(launchOptions: launchOptions)
        #endif
    }
}
