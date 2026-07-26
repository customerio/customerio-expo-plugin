import { CustomerIO, LiveActivityTemplate } from 'customerio-reactnative';
import React, { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';

// Activity types are registered by the plugin's native auto-init from
// `config.liveNotifications.types` in app.json — no JavaScript initialization needed.

export default function LiveActivitiesScreen() {
  const [segmentsId, setSegmentsId] = useState(null);
  const [segmentsComplete, setSegmentsComplete] = useState(0);
  const [countdownId, setCountdownId] = useState(null);

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
