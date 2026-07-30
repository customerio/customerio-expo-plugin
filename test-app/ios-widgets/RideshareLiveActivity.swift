import ActivityKit
import CioLiveActivities_Attributes
import SwiftUI
import WidgetKit

/// A custom Live Activity the test app owns, rendered alongside the SDK's built-in templates.
///
/// The plugin copies this file into the widget extension it generates and adds
/// `RideshareLiveActivity()` to that bundle, next to the built-in `CIOSegmentsLiveActivity()` and
/// `CIOCountdownTimerLiveActivity()` — which is the point of the exercise: a custom template and the
/// built-ins coexist in one widget target.
///
/// The attributes type comes from the SDK (`CIOCustomAttributes`), so nothing here has to define one.
/// Its content-state is an untyped `[String: String]`, which is what lets JavaScript drive the
/// activity without handing a Swift type across the bridge. The keys below are the ones
/// `screens/LiveActivities.js` sends.
@available(iOS 16.2, *)
struct RideshareLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CIOCustomAttributes.self) { context in
            // Lock screen / banner presentation.
            VStack(alignment: .leading, spacing: 4) {
                Text("Rideshare").font(.headline)
                Text(context.state.data["driverName"] ?? "").font(.subheadline)
                Text(context.state.data["status"] ?? "").font(.body)
                Text("ETA \(context.state.data["etaMinutes"] ?? "—") min")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            // Required on any custom template: this is what carries the tap URL the SDK
            // reports `opened` from and routes the deep link with. The bundled templates do
            // the same on both their lock screen and Dynamic Island.
            .cioWidgetUrl(context.state.cioMetadata)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.data["driverName"] ?? "")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.data["etaMinutes"] ?? "—") min")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.data["status"] ?? "")
                }
            } compactLeading: {
                Image(systemName: "car.fill")
            } compactTrailing: {
                Text("\(context.state.data["etaMinutes"] ?? "")m")
            } minimal: {
                Image(systemName: "car.fill")
            }
            .cioWidgetUrl(context.state.cioMetadata)
        }
    }
}
