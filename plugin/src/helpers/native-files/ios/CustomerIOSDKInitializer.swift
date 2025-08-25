import CioDataPipelines
import CioInternalCommon
import CioMessagingInApp
import customerio_reactnative

class CustomerIOSDKInitializer {
    static func initialize() {
        // Override SDK client info to include Expo metadata in user agent
        let pluginVersion = "{{EXPO_PLUGIN_VERSION}}"
        DIGraphShared.shared.override(
            value: CustomerIOSdkClient(source: "Expo", sdkVersion: pluginVersion),
            forType: SdkClient.self
        )

        let cdpApiKey = "{{CDP_API_KEY}}"
        let siteId: String? = {{SITE_ID}}
        let region = CioInternalCommon.Region.getRegion(from: {{REGION}})

        let builder = SDKConfigBuilder(cdpApiKey: cdpApiKey)
        setIfDefined(value: {{LOG_LEVEL}}, thenPassItTo: builder.logLevel, transformingBy: CioLogLevel.getLogLevel)
        setIfDefined(value: region, thenPassItTo: builder.region)
        setIfDefined(value: {{AUTO_TRACK_DEVICE_ATTRIBUTES}}, thenPassItTo: builder.autoTrackDeviceAttributes)
        setIfDefined(value: {{TRACK_APPLICATION_LIFECYCLE_EVENTS}}, thenPassItTo: builder.trackApplicationLifecycleEvents)
        setIfDefined(value: {{SCREEN_VIEW_USE}}, thenPassItTo: builder.screenViewUse) { ScreenView.getScreenView($0) }
        setIfDefined(value: {{MIGRATION_SITE_ID}}, thenPassItTo: builder.migrationSiteId)

        CustomerIO.initialize(withConfig: builder.build())

        if let siteId = siteId {
          let inAppConfig = MessagingInAppConfigBuilder(siteId: siteId, region: region).build()
          MessagingInApp.initialize(withConfig: inAppConfig)
          MessagingInApp.shared.setEventListener(ReactInAppEventListener.shared)
        }
    }

    /// Apply a value to a setter only if it's non-nil
    private static func setIfDefined<Raw>(
        value rawValue: Raw?,
        thenPassItTo handler: (Raw) -> Any
    ) {
        setIfDefined(value: rawValue, thenPassItTo: handler) { $0 }
    }

    /// Apply a value after transforming it, only if both the original and transformed values are non-nil
    private static func setIfDefined<Raw, Transformed>(
        value rawValue: Raw?,
        thenPassItTo handler: (Transformed) -> Any,
        transformingBy transform: (Raw) -> Transformed?
    ) {
        if let value = rawValue, let result = transform(value) {
            _ = handler(result)
        }
    }
}
