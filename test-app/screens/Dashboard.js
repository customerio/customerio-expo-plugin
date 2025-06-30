import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { registerInAppMessagingEventListener } from '../helpers/InAppMessagingListener';
import { requestPermissionForPush } from '../helpers/RequestPushPermission';

import { CustomerIO } from 'customerio-reactnative';
import { BuildMetadata } from '../helpers/BuildMetadata';
import DeviceAttributeModal from './DeviceAttributesModal';
import LoginModal from './LoginModal';
import ProfileAttributeModal from './ProfileAttributeModal';
import SendEventModal from './SendEventModal';

export default function DashboardScreen({ navigation }) {
  useEffect(() => {
    registerInAppMessagingEventListener();
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
    navigation.navigate('NavigationTest');
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
    navigation.navigate('InlineExamples');
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Button title="Login" onPress={() => seLoginModalVisible(true)} />
        </View>

        <View style={styles.section}>
          <Button
            title="Send event"
            onPress={() => setSendEventModalVisible(true)}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Profile Attribute"
            onPress={() => setProfileAttributeModalVisible(true)}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Device attribute"
            onPress={() => setDeviceAttributeModalVisible(true)}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Request push permission"
            onPress={handleRequestPushPermissionButtonPressed}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Navigate to test screen"
            onPress={handleNavigateToTestScreenButtonPressed}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Deeplink to test screen"
            onPress={handleDeeplinkToTestScreenButtonPressed}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="Inline Examples"
            onPress={handleNavigateToInlineExamplesButtonPressed}
          />
        </View>

        <View style={styles.section}>
          <Button title="Logout" onPress={handleLogoutButtonPressed} />
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomLabelContainer}>
          <Text style={styles.bottomLabel}>{workspaceInfo}</Text>
        </View>
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  spacer: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
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
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  bottomLabel: {
    fontSize: 16,
    color: 'gray',
  },
});
