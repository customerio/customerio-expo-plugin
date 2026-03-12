import { CustomerIO } from 'customerio-reactnative';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';

const PRESETS = [
  { label: 'New York', lat: 40.7128, lng: -74.006 },
  { label: 'London', lat: 51.5074, lng: -0.1278 },
  { label: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { label: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { label: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { label: '0, 0', lat: 0, lng: 0 },
];

function showLocationPermissionAlert() {
  Alert.alert(
    'Location Permission Required',
    'Please enable location access in Settings to use this feature.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}

export default function LocationScreen() {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [lastSetLocation, setLastSetLocation] = useState(null);
  const [sdkRequestingLabel, setSdkRequestingLabel] = useState(false);
  const [useCurrentLocationLoading, setUseCurrentLocationLoading] = useState(false);

  const setLocation = (lat, lng, source) => {
    try {
      CustomerIO.location.setLastKnownLocation(lat, lng);
      setLastSetLocation({ lat, lng, source });
      setSdkRequestingLabel(false);
      Alert.alert('Success', `Location set successfully (${source})`);
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const handlePreset = (lat, lng, presetName) => {
    setLocation(lat, lng, presetName);
  };

  const handleManualSet = () => {
    const latText = latitude.trim();
    const lonText = longitude.trim();
    if (!latText || !lonText) {
      Alert.alert('Invalid input', 'Please enter valid coordinates');
      return;
    }
    const lat = parseFloat(latText);
    const lng = parseFloat(lonText);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert('Invalid input', 'Please enter valid coordinates');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid range', 'Latitude must be -90..90, longitude -180..180');
      return;
    }
    setLocation(lat, lng, 'Manual');
  };

  const handleRequestSdkLocationUpdate = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setSdkRequestingLabel(true);
        CustomerIO.location.requestLocationUpdate();
        Alert.alert('Success', 'SDK requested location update');
      } else if (status === 'denied') {
        showLocationPermissionAlert();
      } else {
        Alert.alert('Info', 'Location is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setUseCurrentLocationLoading(true);
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUseCurrentLocationLoading(false);
        setLocation(lat, lng, 'Device');
      } else if (status === 'denied') {
        showLocationPermissionAlert();
      } else {
        Alert.alert('Info', 'Location is not available on this device.');
      }
    } catch (e) {
      setUseCurrentLocationLoading(false);
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const statusText = sdkRequestingLabel
    ? 'Requesting location once (SDK)...'
    : lastSetLocation
      ? `Last set: ${lastSetLocation.lat.toFixed(4)}, ${lastSetLocation.lng.toFixed(4)} (${lastSetLocation.source})`
      : 'No location set yet';

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>OPTION 1: QUICK PRESETS</ThemedText>
          <View style={styles.presetGrid}>
            {PRESETS.map(({ label, lat, lng }) => (
              <Button
                key={label}
                title={label}
                onPress={() => handlePreset(lat, lng, label)}
              />
            ))}
          </View>
          <ThemedText style={styles.hint}>Tap a city to set its coordinates</ThemedText>
        </ThemedView>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <ThemedText style={styles.orText}>OR</ThemedText>
          <View style={styles.orLine} />
        </View>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>OPTION 2: SDK LOCATION</ThemedText>
          <Button
            title="Request location once (SDK)"
            onPress={handleRequestSdkLocationUpdate}
          />
          <ThemedText style={styles.hint}>
            Ask for permission if needed, then SDK fetches location once. The SDK stops any
            in-flight request when the app goes to background.
          </ThemedText>
        </ThemedView>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <ThemedText style={styles.orText}>OR</ThemedText>
          <View style={styles.orLine} />
        </View>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>OPTION 3: MANUALLY SET FROM DEVICE</ThemedText>
          <Button
            title={useCurrentLocationLoading ? 'Fetching...' : 'Use Current Location'}
            onPress={handleUseCurrentLocation}
            disabled={useCurrentLocationLoading}
          />
          <ThemedText style={styles.hint}>
            Fetches coordinates from device (GPS, Wi‑Fi, or cell) and sends them to the SDK via
            setLastKnownLocation.
          </ThemedText>
        </ThemedView>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <ThemedText style={styles.orText}>OR</ThemedText>
          <View style={styles.orLine} />
        </View>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>OPTION 4: MANUAL ENTRY</ThemedText>
          <View style={styles.fieldBlock}>
            <ThemedText style={styles.fieldLabel}>Latitude</ThemedText>
            <TextInput
              style={styles.fieldInput}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
              placeholder="e.g., 40.7128"
              placeholderTextColor="#888"
            />
          </View>
          <View style={styles.fieldBlock}>
            <ThemedText style={styles.fieldLabel}>Longitude</ThemedText>
            <TextInput
              style={styles.fieldInput}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
              placeholder="e.g., -74.0060"
              placeholderTextColor="#888"
            />
          </View>
          <Button title="Set Location" onPress={handleManualSet} />
          <ThemedText style={styles.hint}>Enter custom coordinates</ThemedText>
        </ThemedView>

        <ThemedView style={styles.statusCard}>
          <ThemedText style={styles.statusText}>{statusText}</ThemedText>
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
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#888',
  },
  orText: {
    opacity: 0.8,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sectionHeading: {
    fontWeight: '700',
    marginBottom: 8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hint: {
    opacity: 0.9,
    marginTop: 8,
    fontSize: 14,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 6,
    fontWeight: '600',
  },
  fieldInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 8,
    fontSize: 16,
  },
  statusCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    textAlign: 'center',
  },
});
