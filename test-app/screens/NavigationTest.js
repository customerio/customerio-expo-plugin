import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useFocusEffect } from '@react-navigation/native';
import { CustomerIO } from "customerio-reactnative";

export default function NavigationTestScreen() {

  useFocusEffect(
    useCallback(() => {
      CustomerIO.screen("NavigationTest");

      // Optional cleanup logic
      return () => {
        console.log('EXPO-TEST: Leaving LabelScreen');
      };
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.label}>This is a page to test navigation!</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
  },
});
