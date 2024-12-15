import React, { useState, useCallback } from "react";
import { View, Button, StyleSheet, Text } from "react-native";
import { requestPermissionForPush } from "../helpers/RequestPushPermission";
import { useFocusEffect } from '@react-navigation/native';
import Constants from "expo-constants";

import LoginModal from "./LoginModal";
import SendEventModal from "./SendEventModal";
import DeviceAttributeModal from "./DeviceAttributesModal";
import { CustomerIO } from "customerio-reactnative";

export default function DashboardScreen({ navigation }) {
  const [loginModalVisible, seLoginModalVisible] = useState(false);
  const [sendEventModalVisible, setSendEventModalVisible] = useState(false);
  const [deviceAttributeModalVisible, setDeviceAttributeModalVisible] = useState(false);

  const cdpApiKey = Constants.expoConfig?.extra?.cdpApiKey || "Failed to load!";
  const siteId = Constants.expoConfig?.extra?.siteId || "Failed to load!";
  const workspaceInfo = "CDP API Key: " + cdpApiKey + "\n" +
      "Site ID: " + siteId;

  const handleRequestPushPermissionButtonPressed = () => {
    requestPermissionForPush();
  };

  const handleNavigateToTestScreenButtonPressed = () => {
    navigation.navigate('NavigationTest')
  }

  useFocusEffect(
    useCallback(() => {
      CustomerIO.screen("Dashboard");

      return () => {
        console.log('Leaving DashboardScreen');
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Button title="Login" onPress={() => seLoginModalVisible(true)} />
      </View>

      <View style={styles.section}>
        <Button title="Send event" onPress={() => setSendEventModalVisible(true)} />
      </View>

      <View style={styles.section}>
        <Button title="Device attribute" onPress={() => setDeviceAttributeModalVisible(true)} />
      </View>

      <Button
        title="Request push permission"
        onPress={handleRequestPushPermissionButtonPressed}
      />

      <Button
        title="Navigate to test screen"
        onPress={handleNavigateToTestScreenButtonPressed}
      />

      <View style={styles.bottomLabelContainer}>
        <Text style={styles.bottomLabel}>{workspaceInfo}</Text>
      </View>

      <LoginModal
        visible={loginModalVisible}
        onClose={() => seLoginModalVisible(false)}
      />
      <SendEventModal
        visible={sendEventModalVisible}
        onClose={() => setSendEventModalVisible(false)}
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  section: {
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    width: "80%",
  },
  bottomLabelContainer: {
    position: 'absolute',
    bottom: 20, // Distance from the bottom of the screen
    alignItems: 'center',
    width: '100%',
  },
  bottomLabel: {
    fontSize: 16,
    color: 'gray',
  },
});
