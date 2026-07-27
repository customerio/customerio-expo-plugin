import CioLiveActivities_Attributes
import CioLiveActivities_Templates
import SwiftUI
import WidgetKit

// Reference copy of the widget bundle. The plugin generates this file instead of copying it, so that
// it renders exactly the templates the app enabled, with its branding compiled in and its own
// `liveNotifications.customWidget` SwiftUI added — see `generateWidgetBundleSwift`.
//
// The SwiftUI for each built-in template lives in the Customer.io iOS SDK, so this widget bundle is
// all the host app needs.
@main
struct CIOLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        CIOSegmentsLiveActivity()
        CIOCountdownTimerLiveActivity()
    }
}
