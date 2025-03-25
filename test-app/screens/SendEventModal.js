import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { CustomerIO } from "customerio-reactnative";

export default function SendEventModal({ visible, onClose }) {
  const [eventName, setEventName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyValue, setPropertyValue] = useState("");

  const handlePopupButtonPress = () => {
    if (eventName === "" || propertyName === "" || propertyValue === "") {
      onClose();
      return;
    }

    CustomerIO.track(eventName, { [propertyName]: propertyValue });

    setEventName("");
    setPropertyName("");
    setPropertyValue("");

    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Send Event</Text>

          <TextInput
            style={styles.input}
            placeholder="Event name"
            autoCapitalize="none"
            value={eventName}
            onChangeText={setEventName}
          />
          <TextInput
            style={styles.input}
            placeholder="Property name"
            value={propertyName}
            onChangeText={setPropertyName}
          />
          <TextInput
            style={styles.input}
            placeholder="Property value"
            value={propertyValue}
            onChangeText={setPropertyValue}
          />

          <TouchableOpacity
            style={styles.modalButton}
            onPress={handlePopupButtonPress}
          >
            <Text style={styles.modalButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    padding: 20,
    backgroundColor: "white",
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    width: "100%",
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  modalButton: {
    marginTop: 10,
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
  },
});
