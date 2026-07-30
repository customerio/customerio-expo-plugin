import Foundation
import UIKit
#if canImport(CioLocationGeofence)
import CioLocationGeofence
#endif

/// Customer.io geofence background-delivery bridge. Injected into the app's AppDelegate by the Expo plugin.
@objc public class CioGeofenceAppDelegateHandler: NSObject {
    // @MainActor: GeofenceModule.bootstrapForBackgroundDelivery is main-actor isolated.
    @MainActor
    @objc public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) {
        #if canImport(CioLocationGeofence)
        // Re-arm geofence background delivery on cold launch, before React Native starts.
        GeofenceModule.bootstrapForBackgroundDelivery(launchOptions: launchOptions)
        #endif
    }
}
