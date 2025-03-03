import React, { useState, useEffect, useRef } from 'react';
import { Platform, Alert, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Import your screens
import DashboardScreen from './screens/Dashboard';
import NavigationTestScreen from './screens/NavigationTest';

// Initialize any SDKs or services
import { initializeCioSdk } from './helpers/SdkInit';

// Set the notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createStackNavigator();

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    initializeCioSdk();

    registerForPushNotificationsAsync().then(token => {
      console.log('Expo Push Token:', token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Expo Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Expo Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const linking = {
    prefixes: ['expo-test-app://'],
    config: {
      screens: {
        NavigationTest: 'nav-test',
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

async function registerForPushNotificationsAsync() {
  let token;

  console.log('Starting push notification registration process...');

  // Get existing notification permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log(`Existing notification permission status: ${existingStatus}`);

  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log(`Updated notification permission status: ${finalStatus}`);
  }

  // If permissions are still not granted, alert the user
  if (finalStatus !== 'granted') {
    Alert.alert('Failed to get push token for push notification!');
    console.log('Notification permissions not granted.');
    return;
  }

  // Retrieve the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    console.log(`Using project ID: ${projectId}`);

    // const response = await Notifications.getExpoPushTokenAsync({ projectId });
    // token = response.data;
    // Get the native device push token
    const { data } = await Notifications.getDevicePushTokenAsync();
    token = data;
    console.log(`Expo push token retrieved: ${token}`);
  } catch (error) {
    console.log('Error fetching Expo push token:', error);
  }

  // Configure notification channel for Android devices
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    console.log('Android notification channel set.');
  }

  return token;
}