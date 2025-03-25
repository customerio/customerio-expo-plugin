import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      <Text style={styles.label}>This is a page to test navigation!</Text>
    </View>
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
