import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptionsAndroid } from '../types/cio-types';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGistMavenRepository } from './withGistMavenRepository';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withProjectGoogleServices } from './withProjectGoogleServices';

export function withCIOAndroid(
  config,
  props: CustomerIOPluginOptionsAndroid,
): ConfigPlugin<CustomerIOPluginOptionsAndroid> {
  config = withGistMavenRepository(config, props);
  config = withProjectGoogleServices(config, props);
  config = withAppGoogleServices(config, props);
  config = withGoogleServicesJSON(config, props);

  return config;
}
