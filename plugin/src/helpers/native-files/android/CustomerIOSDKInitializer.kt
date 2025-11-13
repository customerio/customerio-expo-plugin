package io.customer.sdk.expo

import android.app.Application
import io.customer.datapipelines.config.ScreenView
import io.customer.messaginginapp.MessagingInAppModuleConfig
import io.customer.messaginginapp.ModuleMessagingInApp
import io.customer.messagingpush.MessagingPushModuleConfig
import io.customer.messagingpush.ModuleMessagingPushFCM
import io.customer.reactnative.sdk.messaginginapp.NativeMessagingInAppModuleImpl
import io.customer.sdk.CustomerIOBuilder
import io.customer.sdk.core.util.CioLogLevel
import io.customer.sdk.data.model.Region

object CustomerIOSDKInitializer {
    fun initialize(application: Application) = with(
        CustomerIOBuilder(application, "{{CDP_API_KEY}}")
    ) {
        val siteId: String? = {{SITE_ID}}
        val migrationSiteId: String? = {{MIGRATION_SITE_ID}}
        val region = Region.getRegion({{REGION}})

        setIfDefined({{LOG_LEVEL}}, CustomerIOBuilder::logLevel) { CioLogLevel.getLogLevel(it) }
        setIfDefined(region, CustomerIOBuilder::region)
        setIfDefined({{AUTO_TRACK_DEVICE_ATTRIBUTES}}, CustomerIOBuilder::autoTrackDeviceAttributes)
        setIfDefined({{TRACK_APPLICATION_LIFECYCLE_EVENTS}}, CustomerIOBuilder::trackApplicationLifecycleEvents)
        setIfDefined({{SCREEN_VIEW_USE}}, CustomerIOBuilder::screenViewUse) { ScreenView.getScreenView(it) }
        setIfDefined(migrationSiteId, CustomerIOBuilder::migrationSiteId)

        // Add messaging modules if siteId is provided
        if (!(siteId.isNullOrBlank())) {
            addCustomerIOModule(
                ModuleMessagingInApp(
                    MessagingInAppModuleConfig.Builder(siteId, region)
                        .setEventListener(NativeMessagingInAppModuleImpl.inAppEventListener)
                        .build()
                )
            )
        }
        addCustomerIOModule(
            ModuleMessagingPushFCM(
                MessagingPushModuleConfig.Builder().build()
            )
        )

        build()
    }
}

// Apply a value after transforming it, only if both the original and transformed values are non-nil
private inline fun <R, T> CustomerIOBuilder.setIfDefined(
    value: R?,
    block: CustomerIOBuilder.(T) -> CustomerIOBuilder,
    transform: (R) -> T,
): CustomerIOBuilder = value?.let { block(transform(it)) } ?: this

// Apply a value to a setter only if it's non-nil
private inline fun <T> CustomerIOBuilder.setIfDefined(
    value: T?,
    block: CustomerIOBuilder.(T) -> CustomerIOBuilder,
): CustomerIOBuilder = setIfDefined(
    value = value,
    block = block,
    transform = { it },
)
