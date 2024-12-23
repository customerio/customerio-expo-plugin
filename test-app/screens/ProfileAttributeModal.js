import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { CustomerIO } from 'customerio-reactnative';

export default function ProfileAttributeModal({ visible, onClose }) {
  const [attributeName, setAttributeName] = useState('');
  const [attributeValue, setAttributeValue] = useState('');

  const handlePopupButtonPress = () => {
    if (attributeName === '' || attributeValue === '') {
      onClose();
      return;
    }

    const profileAttributes = {
      [attributeName]: attributeValue,
    };
    CustomerIO.setProfileAttributes(profileAttributes);

    setAttributeName('');
    setAttributeValue('');

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
          <Text style={styles.modalTitle}>Profile Attribute</Text>

          <TextInput
            style={styles.input}
            placeholder="Attribute Name"
            autoCapitalize="none"
            value={attributeName}
            onChangeText={setAttributeName}
          />
          <TextInput
            style={styles.input}
            placeholder="Attribute Value"
            autoCapitalize="none"
            value={attributeValue}
            onChangeText={setAttributeValue}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  modalButton: {
    marginTop: 10,
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
