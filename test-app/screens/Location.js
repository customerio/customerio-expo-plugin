import { CustomerIO } from 'customerio-reactnative';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
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
  // Geofence: 'notDetermined' | 'foregroundOnly' | 'backgroundGranted' | 'denied' | 'backgroundDenied'
  const [geofenceStatus, setGeofenceStatus] = useState('notDetermined');
  // Mirrors geofenceStatus for the AppState listener, whose closure would otherwise see a stale value.
  const geofenceStatusRef = useRef(geofenceStatus);
  useEffect(() => {
    geofenceStatusRef.current = geofenceStatus;
  }, [geofenceStatus]);

  // Geofence transitions only fire in the background once "Always"/"Allow all the time" is granted.
  // The SDK never requests location permission itself, so the app owns the permission flow and tells
  // the SDK to refresh once permission changes (the SDK's own fetch runs once per process).
  const refreshGeofences = useCallback(() => {
    try {
      CustomerIO.geofence.refreshFromCurrentLocation();
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  }, []);

  const readGeofenceStatus = useCallback(async () => {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      const next = foreground.canAskAgain ? 'notDetermined' : 'denied';
      setGeofenceStatus(next);
      return next;
    }
    const background = await Location.getBackgroundPermissionsAsync();
    let next;
    if (background.status === 'granted') {
      next = 'backgroundGranted';
    } else {
      // Distinguish "can still prompt" (foregroundOnly) from "permanently blocked" (Settings only).
      next = background.canAskAgain ? 'foregroundOnly' : 'backgroundDenied';
    }
    setGeofenceStatus(next);
    return next;
  }, []);

  // Re-check on mount and whenever the app returns to the foreground (e.g. back from Settings).
  // Refresh only when background access was *newly* granted, not on every resume.
  useEffect(() => {
    readGeofenceStatus();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') {
        return;
      }
      const previous = geofenceStatusRef.current;
      const next = await readGeofenceStatus();
      if (next === 'backgroundGranted' && previous !== 'backgroundGranted') {
        refreshGeofences();
      }
    });
    return () => sub.remove();
  }, [readGeofenceStatus, refreshGeofences]);

  const handleGeofencePermissionTap = async () => {
    try {
      if (geofenceStatus === 'denied' || geofenceStatus === 'backgroundDenied') {
        showLocationPermissionAlert();
        return;
      }
      if (geofenceStatus === 'notDetermined') {
        const foreground = await Location.requestForegroundPermissionsAsync();
        if (foreground.status !== 'granted') {
          setGeofenceStatus(foreground.canAskAgain ? 'notDetermined' : 'denied');
          return;
        }
        // Re-read rather than assume foregroundOnly — background may already be granted.
        const next = await readGeofenceStatus();
        if (next === 'backgroundGranted') {
          refreshGeofences();
        }
        return;
      }
      if (geofenceStatus === 'foregroundOnly') {
        Alert.alert(
          'Allow location "Always"',
          'Geofence transitions only fire in the background. Grant "Always" (iOS) or ' +
          '"Allow all the time" (Android) so the SDK can monitor regions while the app is closed.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                await Location.requestBackgroundPermissionsAsync();
                const next = await readGeofenceStatus();
                if (next === 'backgroundGranted') {
                  refreshGeofences();
                } else if (next === 'backgroundDenied') {
                  showLocationPermissionAlert();
                }
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const geofencePermissionLabel = {
    notDetermined: 'Grant location access',
    foregroundOnly: 'Upgrade to "Always" / "Allow all the time"',
    backgroundGranted: 'Background location granted ✓',
    denied: 'Open Settings',
    backgroundDenied: 'Open Settings',
  }[geofenceStatus];

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

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <ThemedText style={styles.orText}>GEOFENCE</ThemedText>
          <View style={styles.orLine} />
        </View>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>OPTION 5: GEOFENCE MONITORING</ThemedText>
          <Button
            title={geofencePermissionLabel}
            onPress={handleGeofencePermissionTap}
            disabled={geofenceStatus === 'backgroundGranted'}
          />
          <Button title="Refresh geofences from current location" onPress={refreshGeofences} />
          <ThemedText style={styles.hint}>
            Geofence transitions fire in the background once "Always" location is granted. The SDK
            never requests permission itself; the app grants it, then calls
            CustomerIO.geofence.refreshFromCurrentLocation() to (re)evaluate nearby geofences.
          </ThemedText>
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
