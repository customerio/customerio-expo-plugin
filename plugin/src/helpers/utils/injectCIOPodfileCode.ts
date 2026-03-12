import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export type InjectCIOPodfileOptions = {
  /** When true, add the location subspec. When false/omit, use single push subspec only. */
  locationEnabled?: boolean;
  /** When false and locationEnabled, inject only :subspecs => ['location']. When true, use push + location. */
  hasPush?: boolean;
};

/** Builds the host app pod line for the Podfile (single subspec or :subspecs with location). Exported for tests. */
export function buildHostAppPodSnippet(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
): string {
  const path = getRelativePathToRNSDK(iosPath);
  const locationEnabled = options?.locationEnabled === true;
  const hasPush = options?.hasPush !== false;

  if (!locationEnabled) {
    const subspec = isFcmPushProvider ? 'fcm' : 'apn';
    return `pod 'customerio-reactnative/${subspec}', :path => '${path}'`;
  }

  if (!hasPush) {
    return `pod 'customerio-reactnative', :subspecs => ['location'], :path => '${path}'`;
  }

  const pushSubspec = isFcmPushProvider ? 'fcm' : 'apn';
  return `pod 'customerio-reactnative', :subspecs => ['${pushSubspec}', 'location'], :path => '${path}'`;
}

export async function injectCIOPodfileCode(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
) {
  const blockStart = '# --- CustomerIO Host App START ---';
  const blockEnd = '# --- CustomerIO Host App END ---';

  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    // We need to decide what line of code in the Podfile to insert our native code.
    // The "post_install" line is always present in an Expo project Podfile so it's reliable.
    // Find that line in the Podfile and then we will insert our code above that line.
    const lineInPodfileToInjectSnippetBefore = /post_install do \|installer\|/;

    const podLine = buildHostAppPodSnippet(iosPath, isFcmPushProvider, options);

    const snippetToInjectInPodfile = `
${blockStart}
  ${podLine}
${blockEnd}
`.trim();

    FileManagement.write(
      filename,
      injectCodeByRegex(
        podfile,
        lineInPodfileToInjectSnippetBefore,
        snippetToInjectInPodfile
      ).join('\n')
    );
  } else {
    logger.info('CustomerIO Podfile snippets already exists. Skipping...');
  }
}

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
  isFcmPushProvider: boolean
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);

  const blockStart = '# --- CustomerIO Notification START ---';
  const blockEnd = '# --- CustomerIO Notification END ---';

  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    const snippetToInjectInPodfile = `
${blockStart}
target 'NotificationService' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
  pod 'customerio-reactnative-richpush/${isFcmPushProvider ? 'fcm' : 'apn'
      }', :path => '${getRelativePathToRNSDK(iosPath)}'
end
${blockEnd}
`.trim();

    FileManagement.append(filename, snippetToInjectInPodfile);
  }
}
