import React, { useEffect } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import DashboardScreen from "./screens/Dashboard";
import NavigationTestScreen from "./screens/NavigationTest";
import InlineExamplesScreen from "./screens/InlineExamples";

import { initializeCioSdk } from "./helpers/SdkInit";

const Stack = createStackNavigator();

export default function App() {
  // TODO: Remove SDK initialization once auto-initialization is fully implemented
  useEffect(() => {
    initializeCioSdk();
  }, []);

  const linking = {
    prefixes: ['expo-test-app://'],
    config: {
      screens: {
        NavigationTest: 'nav-test'
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="NavigationTest" component={NavigationTestScreen} />
        <Stack.Screen name="InlineExamples" component={InlineExamplesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
