import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGistMavenRepository } from './withGistMavenRepository';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withProjectGoogleServices } from './withProjectGoogleServices';

export function withCIOAndroid(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsAndroid
): ExpoConfig {
  config = withGistMavenRepository(config, props);
  config = withProjectGoogleServices(config, props);
  config = withAppGoogleServices(config, props);
  config = withGoogleServicesJSON(config, props);

  return config;
}
