import {
  CustomerIO,
  NotificationInboxBellView,
} from 'customerio-reactnative';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ThemedView } from '../components/themed-view';

/**
 * The branded bell; tapping it opens the SDK's own inbox panel.
 *
 * NotificationInboxView (the message list) is deliberately NOT rendered here. Showing the
 * list marks every visible unread message as opened straight away — the same behavior as
 * opening the panel — so having it on screen next to the bell wipes the unread state before
 * you can exercise the badge. Hosts that want the list should give it its own screen.
 */
export default function VisualInboxScreen() {
  const [lastBellTap, setLastBellTap] = useState('No bell taps yet');
  const [lastEvent, setLastEvent] = useState('No inbox events yet');

  // Global inbox event listener. While registered, this app owns action navigation:
  // the SDK forwards events here and suppresses its own default handling.
  useEffect(() => {
    const subscription = CustomerIO.inAppMessaging.registerInboxEventListener(
      (event) => {
        const summary = `${event.eventType} ${event.actionValue ?? ''}`.trim();
        console.log('[InboxEventListener]', summary, event.message?.queueId);
        setLastEvent(summary);
      }
    );
    return () => subscription.remove();
  }, []);

  return (
    <ThemedView style={styles.container}>
      {/* 88 not 56: the native composition insets its 56 bell by 16 per side, so a
          smaller box squeezes the circle onto the glyph. */}
      <NotificationInboxBellView
        style={styles.bell}
        onTap={() => setLastBellTap('bell tapped')}
      />
      <Text style={styles.readout}>last bell tap: {lastBellTap}</Text>
      <Text style={styles.readout}>last inbox event: {lastEvent}</Text>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  bell: { width: 88, height: 88, alignSelf: 'flex-end' },
  readout: { fontSize: 12 },
});
