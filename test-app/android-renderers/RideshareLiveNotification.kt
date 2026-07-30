package com.customerio.testbed.livenotifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import io.customer.messagingpush.data.communication.CustomerIOLiveNotificationsCallback
import io.customer.messagingpush.data.model.CustomerIOParsedPushPayload

/**
 * Renders the custom `rideshare` live notification, the Android counterpart to
 * `ios-widgets/RideshareLiveActivity.swift`.
 *
 * The plugin copies this file into the generated Android project and registers the class, because
 * `liveNotifications.customRenderer` names it in app.json. A custom activity type has no built-in
 * SDK template on either platform, so the app draws it: SwiftUI on iOS, a `Notification` here.
 *
 * Returning null for any other type lets the SDK fall back to its built-in templates.
 */
class RideshareLiveNotificationCallback : CustomerIOLiveNotificationsCallback {
    override fun createLiveNotification(
        payload: CustomerIOParsedPushPayload,
        context: Context,
    ): Notification? {
        // Template fields arrive flattened in `extras`; the activity type is under the reserved
        // "notification_type" key.
        val extras = payload.extras
        if (extras.getString("notification_type") != RIDESHARE_TYPE) return null

        // The SDK re-invokes this on the "end" event. Return a terminal, non-ongoing notification
        // then so it can be dismissed instead of sticking around forever.
        val ended = extras.getString("event") == "end"

        val driverName = extras.getString("driverName") ?: "Your driver"
        val status = extras.getString("status") ?: ""
        // Every custom value crosses the bridge as a string; parse what you need.
        val etaMinutes = extras.getString("etaMinutes")?.toDoubleOrNull()?.toInt()

        // Same fields the SwiftUI shows, in the same order: status leads as the title, then the
        // driver and the ETA. `status` is not repeated in the body since it is already the title.
        val body = listOfNotNull(
            driverName,
            etaMinutes?.let { "ETA $it min" },
        ).joinToString(" • ")

        ensureChannel(context)
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(status.ifEmpty { if (ended) "Arrived" else "Rideshare" })
            .setContentText(body)
            .setOngoing(!ended)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Rideshare",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
            )
        }
    }

    private companion object {
        const val RIDESHARE_TYPE = "com.customerio.testbed.rideshare"
        const val CHANNEL_ID = "rideshare_live_notification"
    }
}
