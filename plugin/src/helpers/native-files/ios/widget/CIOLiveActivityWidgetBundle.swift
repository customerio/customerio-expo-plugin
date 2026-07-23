import CioLiveActivities_Attributes
import CioLiveActivities_Templates
import SwiftUI
import WidgetKit

// Renders the Customer.io built-in Live Activity templates. The SwiftUI for each template lives in
// the Customer.io iOS SDK, so this widget bundle is all the host app needs. App-defined custom
// templates are not rendered here — apps add those in their own widget target.
@main
struct CIOLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        CIOSegmentsLiveActivity()
        CIOCountdownTimerLiveActivity()
    }
}
