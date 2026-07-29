import {
  CioConfig,
  CioLogLevel,
  CioRegion,
  CustomerIO,
} from 'customerio-reactnative';
// Visual Notification Inbox components. Imported here on purpose: these are Fabric views backed by
// new native modules (Compose on Android, SwiftUI on iOS), so rendering them is what proves
// autolinking and pod linkage reach the inbox code under pnpm — the whole point of this app.
import {
  NotificationInboxBellView,
} from 'customerio-reactnative';
import { registerRootComponent } from 'expo';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { describeWorkspace } from '@cio-test/shared-cio-utils';

const SMOKE_TAG = '[CioSmoke pnpm-monorepo]';

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
        userId: 'pnpm-monorepo-dev-smoke',
        traits: { source: 'pnpm-monorepo-dev-app' },
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

      // Visual Notification Inbox: exercise the headless API and the listener bridge. The views
      // themselves are rendered below — together they cover both halves of the inbox surface.
      CustomerIO.inAppMessaging
        .inbox()
        .getMessages()
        .then((messages) =>
          console.log(`${SMOKE_TAG} inbox getMessages OK:`, messages.length)
        )
        .catch((err) => console.warn(`${SMOKE_TAG} inbox getMessages error:`, err));

      const inboxListener = CustomerIO.inAppMessaging.registerInboxEventListener(
        (event) => console.log(`${SMOKE_TAG} inbox event:`, event)
      );
      console.log(`${SMOKE_TAG} inbox listener registered`);

      return () => {
        inAppListener?.remove?.();
        inboxListener?.remove?.();
      };
    } catch (err) {
      console.error(`${SMOKE_TAG} FAILED — native module not linked?`, err);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>customerio-expo-plugin pnpm monorepo dev app</Text>
      <Text style={styles.subtitle}>{describeWorkspace()}</Text>
      <Text style={styles.subtitle}>
        Smoke-tests SDK bridge on launch. Watch the console for {SMOKE_TAG} lines.
      </Text>
      {/* Inbox bell: a Fabric view over the native component, and the only inbox UI the SDK
          exposes besides the message list. Tapping it opens the SDK's own panel. If autolinking or
          pod linkage misses the inbox module, this fails to render rather than failing silently. */}
      <NotificationInboxBellView
        style={styles.bell}
        onTap={() => console.log(`${SMOKE_TAG} inbox bell tapped`)}
      />
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
  bell: {
    marginTop: 24,
    // 88 not 72: the native composition insets its 56 bell by 16 per side, so a smaller
    // box squeezes the circle onto the glyph.
    width: 88,
    height: 88,
  },
});

registerRootComponent(App);
