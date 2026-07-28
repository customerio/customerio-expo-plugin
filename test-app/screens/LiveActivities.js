import { CustomerIO, LiveActivityTemplate } from 'customerio-reactnative';
import React, { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';

// Activity types are registered by the plugin's native auto-init from app.json — the built-ins from
// `config.liveNotifications.types` and the custom one from `config.liveNotifications.customType` —
// so no JavaScript initialization is needed. On iOS all three are rendered by the single widget
// extension the plugin generates: the SDK ships the SwiftUI for the built-ins, and
// `liveNotifications.customWidget` points at the app's own file for the custom one.

export default function LiveActivitiesScreen() {
  const [segmentsId, setSegmentsId] = useState(null);
  const [segmentsComplete, setSegmentsComplete] = useState(0);
  const [countdownId, setCountdownId] = useState(null);
  const [customId, setCustomId] = useState(null);

  const segmentsTotal = 4;

  // MARK: - Segments

  const startSegments = async () => {
    try {
      const id = await CustomerIO.liveActivities.start({
        type: LiveActivityTemplate.Segments,
        header: 'Order #4021',
        status: 'Preparing your order',
        segmentsTotal,
        segmentsComplete: 1,
      });
      setSegmentsId(id);
      setSegmentsComplete(1);
      Alert.alert('Success', `Segments started (${id})`);
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const advanceSegments = async () => {
    if (!segmentsId) return;
    const next = Math.min(segmentsComplete + 1, segmentsTotal);
    try {
      await CustomerIO.liveActivities.update(segmentsId, {
        type: LiveActivityTemplate.Segments,
        header: 'Order #4021',
        status: next >= segmentsTotal ? 'Delivered' : 'Out for delivery',
        segmentsTotal,
        segmentsComplete: next,
      });
      setSegmentsComplete(next);
      Alert.alert('Success', `Segments → ${next}/${segmentsTotal}`);
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const endSegments = async () => {
    if (!segmentsId) return;
    try {
      await CustomerIO.liveActivities.end(segmentsId);
      setSegmentsId(null);
      setSegmentsComplete(0);
      Alert.alert('Info', 'Segments ended');
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  // MARK: - Countdown Timer

  const startCountdown = async () => {
    try {
      const id = await CustomerIO.liveActivities.start({
        type: LiveActivityTemplate.CountdownTimer,
        header: 'Flash Sale',
        title: '50% off ends in',
        statusMessage: 'Hurry!',
        endTime: Math.floor(Date.now() / 1000) + 3600, // epoch seconds, +1h
      });
      setCountdownId(id);
      Alert.alert('Success', `Countdown started (${id})`);
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const endCountdown = async () => {
    if (!countdownId) return;
    try {
      await CustomerIO.liveActivities.end(countdownId);
      setCountdownId(null);
      Alert.alert('Info', 'Countdown ended');
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  // MARK: - Custom

  // The identifier comes from `config.liveNotifications.customType`; the SwiftUI that draws it comes
  // from the top-level `liveNotifications.customWidget`. Values are strings — a bridge payload has no
  // schema, so the widget parses what it needs.
  const rideshare = (status, etaMinutes) => ({
    type: LiveActivityTemplate.Custom,
    data: { driverName: 'Alex', status, etaMinutes: String(etaMinutes) },
  });

  const startCustom = async () => {
    try {
      const id = await CustomerIO.liveActivities.start(rideshare('On the way', 5));
      setCustomId(id);
      Alert.alert('Success', `Rideshare started (${id})`);
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const updateCustom = async () => {
    if (!customId) return;
    try {
      await CustomerIO.liveActivities.update(customId, rideshare('Almost there', 2));
      Alert.alert('Success', 'Rideshare updated');
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const endCustom = async () => {
    if (!customId) return;
    try {
      // A final content-state so the card reads as finished rather than freezing mid-trip.
      await CustomerIO.liveActivities.end(customId, rideshare('Arrived', 0));
      setCustomId(null);
      Alert.alert('Info', 'Rideshare ended');
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>SEGMENTS</ThemedText>
          <ThemedText style={styles.hint}>
            A built-in template with a segmented progress bar.
          </ThemedText>
          <Button title="Start Segments" onPress={startSegments} />
          <Button
            title="Advance Segment (update)"
            onPress={advanceSegments}
            disabled={!segmentsId}
          />
          <Button title="End Segments" onPress={endSegments} disabled={!segmentsId} />
          <ThemedText style={styles.hint}>
            {segmentsId ? `Running: ${segmentsComplete}/${segmentsTotal}` : 'Not started'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>COUNTDOWN TIMER</ThemedText>
          <ThemedText style={styles.hint}>
            A built-in template counting down to a target time.
          </ThemedText>
          <Button title="Start Countdown (+1h)" onPress={startCountdown} />
          <Button title="End Countdown" onPress={endCountdown} disabled={!countdownId} />
          <ThemedText style={styles.hint}>
            {countdownId ? 'Running' : 'Not started'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>CUSTOM (RIDESHARE)</ThemedText>
          <ThemedText style={styles.hint}>
            An app-defined template rendered by RideshareLiveActivity.swift, in the same widget
            bundle as the two built-ins above.
          </ThemedText>
          <ThemedText style={styles.hint}>
            iOS only in this app. A custom type has no built-in template, so Android renders it
            through CustomerIOLiveNotificationsCallback — which is native Kotlin set before SDK
            initialization, not reachable from JavaScript. These buttons will report success on
            Android and show nothing.
          </ThemedText>
          <Button title="Start Custom" onPress={startCustom} />
          <Button title="Update Custom" onPress={updateCustom} disabled={!customId} />
          <Button title="End Custom" onPress={endCustom} disabled={!customId} />
          <ThemedText style={styles.hint}>
            {customId ? 'Running' : 'Not started'}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  container: {
    padding: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionHeading: {
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
  },
});
