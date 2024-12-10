import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";
import { CustomerIO } from "customerio-reactnative";
import { requestPermissionForPush } from "../helpers/RequestPushPermission";

export default function DashboardScreen() {
  const [email, setEmail] = useState("");
  const [eventName, setEventName] = useState("");

  const handleLoginButtonPressed = () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail === "") {
      CustomerIO.clearIdentify();
      alert(`Logged out!`);
    } else {
      CustomerIO.identify({
        userId: trimmedEmail,
        traits: {
          first_name: trimmedEmail,
          email: trimmedEmail,
        },
      });
      alert(`Identified ${trimmedEmail}`);
    }
  };

  const handleSendEventButtonPressed = () => {
    CustomerIO.track(eventName, { product: "shoes", price: "29.99" });
    alert(`Tracked event: ${eventName}`);
  };

  const handleRequestPushPermissionButtonPressed = () => {
    requestPermissionForPush();
  };

  return (
    <View style={styles.container}>
      {/* First Section */}
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="Login" onPress={handleLoginButtonPressed} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Second Section */}
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Event name"
          autoCapitalize="none"
          value={eventName}
          onChangeText={setEventName}
        />
        <Button title="Send event" onPress={handleSendEventButtonPressed} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Third Button */}
      <Button
        title="Request push permission"
        onPress={handleRequestPushPermissionButtonPressed}
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
  divider: {
    height: 1,
    backgroundColor: "#ccc",
    width: "100%",
    marginVertical: 10,
  },
});
