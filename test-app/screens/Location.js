import { CustomerIO } from 'customerio-reactnative';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Button,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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

// Higher = more access. Used to fetch only when the permission level increases
// (e.g. gaining "Always" in Settings), never on a downgrade between states.
const grantRank = (status) =>
  status === 'backgroundGranted' ? 2 : status === 'foregroundOnly' ? 1 : 0;

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

  // Drives the state-aware Background Location button (mirrors the native/RN samples).
  // 'notDetermined' | 'foregroundOnly' | 'backgroundGranted' | 'denied'
  const [locationStatus, setLocationStatus] = useState('notDetermined');
  const locationStatusRef = useRef('notDetermined');
  // Sequence guard: mount, AppState resume, and permission handlers can refresh
  // concurrently — drop a stale completion so it can't overwrite a newer result.
  const refreshSeqRef = useRef(0);

  // Reads current permissions and updates the button state. Returns the resolved
  // status, or null if this run was superseded by a newer one (or errored).
  const refreshLocationStatus = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      const background = await Location.getBackgroundPermissionsAsync();
      if (seq !== refreshSeqRef.current) {
        return null;
      }
      let status;
      if (background.status === 'granted') {
        status = 'backgroundGranted';
      } else if (foreground.status === 'granted') {
        status = 'foregroundOnly';
      } else if (foreground.status === 'denied' && !foreground.canAskAgain) {
        status = 'denied';
      } else {
        status = 'notDetermined';
      }
      locationStatusRef.current = status;
      setLocationStatus(status);
      return status;
    } catch (e) {
      if (seq === refreshSeqRef.current) {
        Alert.alert('Error', (e && e.message) || String(e));
      }
      return null;
    }
  }, []);

  const refreshGeofences = useCallback(() => {
    try {
      CustomerIO.geofence.refreshFromCurrentLocation();
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  }, []);

  // Query on mount; re-query on resume so the button reflects changes made in
  // Settings, and fetch if a grant happened there. In-app grants fetch directly
  // from their handlers, so this only covers the return-from-Settings path.
  useEffect(() => {
    refreshLocationStatus();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') {
        return;
      }
      const previous = locationStatusRef.current;
      const status = await refreshLocationStatus();
      // Fetch whenever the permission level increased (a grant made in Settings),
      // including foregroundOnly → backgroundGranted; skip downgrades. The SDK's
      // auto-fetch hook runs once per process, so Settings grants need an explicit fetch.
      if (status && grantRank(status) > grantRank(previous)) {
        refreshGeofences();
      }
    });
    return () => sub.remove();
  }, [refreshLocationStatus, refreshGeofences]);

  const showOpenSettingsDialog = () => {
    Alert.alert(
      'Location Permission Required',
      'Location permission is denied. Please enable it from app settings.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  // Escalate to background ("Always"/"Allow all the time") after foreground is granted.
  const requestBackgroundLocation = async () => {
    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      const next = await refreshLocationStatus();
      // Trust the freshly-read status: the OS may already show background granted
      // (e.g. enabled in Settings) even when the request result comes back denied.
      if (next === 'backgroundGranted' || background.status === 'granted') {
        refreshGeofences();
        Alert.alert(
          'Success',
          'Background location granted — fetching location to start geofence'
        );
      } else if (next === 'denied' || !background.canAskAgain) {
        showOpenSettingsDialog();
      } else {
        // iOS resolves the "Always" prompt asynchronously; the button updates on
        // resume, which fetches if granted. Point the user to Settings otherwise.
        Alert.alert(
          'Info',
          'Requesting background location — enable "Always" / "Allow all the time" in Settings if no prompt appears'
        );
      }
    } catch (e) {
      Alert.alert('Error', (e && e.message) || String(e));
    }
  };

  const showBackgroundRationale = () => {
    Alert.alert(
      'Allow background location?',
      'Geofence transitions only fire while the app is backgrounded if you grant ' +
        '"Always" / "Allow all the time". Continue and choose it when prompted — or ' +
        'in Settings if no prompt appears.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => requestBackgroundLocation() },
      ]
    );
  };

  // State-aware Background Location action, matching the native/RN sample apps.
  const handleBackgroundLocationTap = async () => {
    switch (locationStatus) {
      case 'foregroundOnly':
        showBackgroundRationale();
        return;
      case 'backgroundGranted':
        return;
      case 'denied':
        Linking.openSettings();
        return;
      default: {
        // notDetermined: request foreground first, then escalate to background.
        const foreground = await Location.requestForegroundPermissionsAsync();
        await refreshLocationStatus();
        if (foreground.status === 'granted') {
          refreshGeofences();
          showBackgroundRationale();
        } else if (!foreground.canAskAgain) {
          showOpenSettingsDialog();
        } else {
          Alert.alert('Info', 'Location permission denied');
        }
      }
    }
  };

  const backgroundButtonLabel = (() => {
    switch (locationStatus) {
      case 'foregroundOnly':
        return Platform.OS === 'ios' ? "Upgrade to 'Always'" : 'Allow all the time';
      case 'backgroundGranted':
        return Platform.OS === 'ios' ? '✓ Always — granted' : '✓ Background — granted';
      case 'denied':
        return 'Open Settings';
      default:
        return 'Grant location access';
    }
  })();

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
      await refreshLocationStatus();
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
      await refreshLocationStatus();
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
          <ThemedText style={styles.sectionHeading}>BACKGROUND LOCATION (GEOFENCE)</ThemedText>
          <Button
            title={backgroundButtonLabel}
            onPress={handleBackgroundLocationTap}
            disabled={locationStatus === 'backgroundGranted'}
          />
          <Button title="Refresh geofences from current location" onPress={refreshGeofences} />
          <ThemedText style={styles.hint}>
            Geofence runs automatically once enabled, but needs background ("Always" /
            "Allow all the time") location to deliver transitions while the app is closed.
            This grants foreground access first, then escalates to background.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>SDK LOCATION</ThemedText>
          <Button
            title="Request location once (SDK)"
            onPress={handleRequestSdkLocationUpdate}
          />
          <ThemedText style={styles.hint}>
            Ask for permission if needed, then SDK fetches location once. The SDK stops any
            in-flight request when the app goes to background.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>QUICK PRESETS</ThemedText>
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

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>USE CURRENT LOCATION</ThemedText>
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

        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>MANUAL ENTRY</ThemedText>
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
    gap: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 8,
    gap: 8,
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
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    textAlign: 'center',
  },
});
