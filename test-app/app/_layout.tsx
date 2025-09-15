import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Home", headerShown: false }} />
        <Stack.Screen name="nav-test" options={{ title: "Navigation Test" }} />
        <Stack.Screen name="inline-examples" options={{ title: "Inline Examples" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
