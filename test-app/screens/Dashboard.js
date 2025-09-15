import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Image, Linking, StyleSheet } from 'react-native';
import ParallaxScrollView from '../components/parallax-scroll-view';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { registerInAppMessagingEventListener } from '../helpers/InAppMessagingListener';
import { requestPermissionForPush } from '../helpers/RequestPushPermission';

import { CustomerIO } from 'customerio-reactnative';
import { BuildMetadata } from '../helpers/BuildMetadata';
import DeviceAttributeModal from './DeviceAttributesModal';
import LoginModal from './LoginModal';
import ProfileAttributeModal from './ProfileAttributeModal';
import SendEventModal from './SendEventModal';

export default function DashboardScreen() {
  useEffect(() => {
    return registerInAppMessagingEventListener();
  }, []);

  const [loginModalVisible, seLoginModalVisible] = useState(false);
  const [sendEventModalVisible, setSendEventModalVisible] = useState(false);
  const [deviceAttributeModalVisible, setDeviceAttributeModalVisible] =
    useState(false);
  const [profileAttributeModalVisible, setProfileAttributeModalVisible] =
    useState(false);

  const workspaceInfo = BuildMetadata.toString();

  const handleRequestPushPermissionButtonPressed = () => {
    requestPermissionForPush();
  };

  const handleNavigateToTestScreenButtonPressed = () => {
    router.push('/nav-test');
  };

  const handleDeeplinkToTestScreenButtonPressed = () => {
    Linking.openURL('expo-test-app://nav-test')
      .then(() => {
        console.log('EXPO-TEST: Deeplinking to test screen opened successfully');
      })
      .catch((err) => {
        console.error('EXPO-TEST: Deeplinking to test screen failed!', err);
      });
  };

  const handleNavigateToInlineExamplesButtonPressed = () => {
    router.push('/inline-examples');
  };

  const handleLogoutButtonPressed = () => {
    CustomerIO.clearIdentify();
  };

  useFocusEffect(
    useCallback(() => {
      CustomerIO.screen('Dashboard');

      return () => {
        console.log('EXPO-TEST: Leaving DashboardScreen');
      };
    }, [])
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#E3FFCE', dark: '#E3FFCE' }}
      headerImage={
        <Image
          source={require('../assets/images/partial-customerio-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.section}>
        <Button title="Login" onPress={() => seLoginModalVisible(true)} />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Send event"
          onPress={() => setSendEventModalVisible(true)}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Profile Attribute"
          onPress={() => setProfileAttributeModalVisible(true)}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Device attribute"
          onPress={() => setDeviceAttributeModalVisible(true)}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Request push permission"
          onPress={handleRequestPushPermissionButtonPressed}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Navigate to test screen"
          onPress={handleNavigateToTestScreenButtonPressed}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Deeplink to test screen"
          onPress={handleDeeplinkToTestScreenButtonPressed}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button
          title="Inline Examples"
          onPress={handleNavigateToInlineExamplesButtonPressed}
        />
      </ThemedView>

      <ThemedView style={styles.section}>
        <Button title="Logout" onPress={handleLogoutButtonPressed} />
      </ThemedView>

      <ThemedView style={styles.spacer} />

      <ThemedView style={styles.bottomLabelContainer}>
        <ThemedText style={styles.bottomLabel}>{workspaceInfo}</ThemedText>
      </ThemedView>

      <LoginModal
        visible={loginModalVisible}
        onClose={() => seLoginModalVisible(false)}
      />
      <SendEventModal
        visible={sendEventModalVisible}
        onClose={() => setSendEventModalVisible(false)}
      />
      <ProfileAttributeModal
        visible={profileAttributeModalVisible}
        onClose={() => setProfileAttributeModalVisible(false)}
      />
      <DeviceAttributeModal
        visible={deviceAttributeModalVisible}
        onClose={() => setDeviceAttributeModalVisible(false)}
      />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  spacer: {
    height: 32,
  },
  section: {
    marginBottom: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    width: '80%',
  },
  bottomLabelContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  bottomLabel: {
    fontSize: 16,
    color: 'gray',
  },
});
