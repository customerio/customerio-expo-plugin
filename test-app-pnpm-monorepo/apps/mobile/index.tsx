import { CioConfig, CioLogLevel, CioRegion, CustomerIO } from 'customerio-reactnative';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { describeWorkspace } from '@cio-test/shared-cio-utils';

export default function App() {
  useEffect(() => {
    const config: CioConfig = {
      cdpApiKey: 'REPLACE_WITH_REAL_KEY',
      region: CioRegion.US,
      logLevel: CioLogLevel.Debug,
    };
    CustomerIO.initialize(config);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>customerio-expo-plugin pnpm monorepo dev app</Text>
      <Text style={styles.subtitle}>{describeWorkspace()}</Text>
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
