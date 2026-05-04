import {
  CioConfig,
  CioLogLevel,
  CioRegion,
  CustomerIO,
} from 'customerio-reactnative';
import { registerRootComponent } from 'expo';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const SMOKE_TAG = '[CioSmoke pnpm-flat]';

function App() {
  useEffect(() => {
    const config: CioConfig = {
      cdpApiKey: 'REPLACE_WITH_REAL_KEY',
      region: CioRegion.US,
      logLevel: CioLogLevel.Debug,
    };

    // Each call below routes through the NativeCustomerIO TurboModule. If
    // pod linkage is broken under pnpm, any of them throws "NativeCustomerIO
    // could not be found" — which is the bug we're guarding against. We
    // don't care whether the data lands in a workspace; we care that the
    // bridge is callable.
    try {
      CustomerIO.initialize(config);
      console.log(`${SMOKE_TAG} initialize OK`);

      CustomerIO.identify({
        userId: 'pnpm-flat-dev-smoke',
        traits: { source: 'pnpm-flat-dev-app' },
      });
      console.log(`${SMOKE_TAG} identify OK`);

      CustomerIO.track('pnpm_dev_smoke_event', { ts: Date.now() });
      console.log(`${SMOKE_TAG} track OK`);

      const inAppListener = CustomerIO.inAppMessaging.registerEventsListener(
        (event) => console.log(`${SMOKE_TAG} inApp event:`, event)
      );
      console.log(`${SMOKE_TAG} in-app listener registered`);

      CustomerIO.pushMessaging
        .showPromptForPushNotifications({ ios: { sound: true, badge: true } })
        .then((status) => console.log(`${SMOKE_TAG} push permission:`, status))
        .catch((err) => console.warn(`${SMOKE_TAG} push permission error:`, err));

      return () => {
        inAppListener?.remove?.();
      };
    } catch (err) {
      console.error(`${SMOKE_TAG} FAILED — native module not linked?`, err);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>customerio-expo-plugin pnpm dev app</Text>
      <Text style={styles.subtitle}>
        Smoke-tests SDK bridge on launch. Watch the console for {SMOKE_TAG} lines.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});

registerRootComponent(App);
