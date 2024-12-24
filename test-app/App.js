import React, { useEffect } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import DashboardScreen from "./screens/Dashboard";
import NavigationTestScreen from "./screens/NavigationTest";

import { initializeCioSdk } from "./helpers/SdkInit";

const Stack = createStackNavigator();

export default function App() {
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
