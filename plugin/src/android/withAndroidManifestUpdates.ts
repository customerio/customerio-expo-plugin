import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

// Default low priority for Firebase messaging service when setHighPriorityPushHandler is false
export const DEFAULT_LOW_PRIORITY = -10;

// Helper function to calculate target priority for low priority services
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateLowPriority(services: any[], excludeIndex?: number): number {
  const relevantServices = excludeIndex !== undefined
    ? services.filter((_, index) => index !== excludeIndex)
    : services;

  const existingPriorities = relevantServices
    .flatMap(service => service['intent-filter'] || [])
    .map(filter => (filter.$ as Record<string, string>)?.['android:priority'])
    .filter(priority => priority !== undefined)
    .map(priority => parseInt(priority, 10))
    .filter(priority => !isNaN(priority));

  let targetPriority = DEFAULT_LOW_PRIORITY;
  if (existingPriorities.length > 0) {
    const minExistingPriority = Math.min(...existingPriorities);
    if (minExistingPriority <= DEFAULT_LOW_PRIORITY) {
      targetPriority = minExistingPriority - 1;
    }
  }

  return targetPriority;
}

export const withAndroidManifestUpdates: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter, options) => {
  return withAndroidManifest(configOuter, (props) => {
    const application = props.modResults.manifest
      .application as ManifestApplication[];
    const customerIOMessagingpush =
      'io.customer.messagingpush.CustomerIOFirebaseMessagingService';

    if (!application[0].service) {
      application[0].service = [];
    }

    const existingServiceIndex = application[0].service.findIndex(
      (service) => service.$['android:name'] === customerIOMessagingpush
    );

    if (existingServiceIndex === -1) {
      // Intent filter structure for Firebase messaging service
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intentFilter: any = {
        action: [
          {
            $: {
              'android:name': 'com.google.firebase.MESSAGING_EVENT',
            },
          },
        ],
      };

      // Handle priority based on setHighPriorityPushHandler value
      if (options.setHighPriorityPushHandler === true) {
        // High priority - no priority attribute means default high priority
        console.log(
          'Successfully set CustomerIO push handler as high priority in AndroidManifest.xml'
        );
      } else if (options.setHighPriorityPushHandler === false) {
        // Low priority - calculate target priority based on existing services
        const targetPriority = calculateLowPriority(application[0].service);

        intentFilter.$ = {
          'android:priority': targetPriority.toString(),
        };
        console.log(
          `Successfully set CustomerIO push handler as low priority (${targetPriority}) in AndroidManifest.xml`
        );
      }

      application[0].service.push({
        '$': {
          'android:name': customerIOMessagingpush,
          'android:exported': 'false',
        },
        'intent-filter': [intentFilter],
      });
    } else if (options.setHighPriorityPushHandler === true) {
      // Service exists, need to ensure it becomes high priority (remove priority attribute)
      const existingService = application[0].service[existingServiceIndex];

      if (existingService['intent-filter'] && existingService['intent-filter'].length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intentFilter = existingService['intent-filter'][0] as any;
        if (intentFilter.$ && intentFilter.$['android:priority']) {
          delete intentFilter.$['android:priority'];
          console.log(
            'Successfully updated existing CustomerIO push handler to high priority in AndroidManifest.xml'
          );
        }
      }
    } else if (options.setHighPriorityPushHandler === false) {
      // Service exists, but we need to update its priority when flag is false
      const existingService = application[0].service[existingServiceIndex];

      // Calculate target priority excluding the existing CustomerIO service
      const targetPriority = calculateLowPriority(application[0].service, existingServiceIndex);

      // Update existing service intent-filter with priority (preserve other attributes)
      if (existingService['intent-filter'] && existingService['intent-filter'].length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intentFilter = existingService['intent-filter'][0] as any;
        if (!intentFilter.$) {
          intentFilter.$ = {};
        }
        intentFilter.$['android:priority'] = targetPriority.toString();
        console.log(
          `Successfully updated existing CustomerIO push handler to low priority (${targetPriority}) in AndroidManifest.xml`
        );
      }
    }

    props.modResults.manifest.application = application;
    return props;
  });
};
