import { withBuildProperties } from 'expo-build-properties';

// Set ios deployment target to 13.0, this
export function withCustomerIOBuildProperties(config, props) {
  return withBuildProperties(config, {
    ios: {
      deploymentTarget: '13.0',
    },
  });
}
