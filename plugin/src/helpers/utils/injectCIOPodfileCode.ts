import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export async function injectCIOPodfileCode(iosPath: string, pushProvider: string) {
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

    const useFcm = pushProvider === 'fcm';
    const snippetToInjectInPodfile = `
${blockStart}
  pod 'customerio-reactnative/${useFcm ? "fcm" : "apn"}', :path => '${getRelativePathToRNSDK(
    iosPath
  )}'
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
    console.log('CustomerIO Podfile snippets already exists. Skipping...');
  }
}

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
  pushProvider: string
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);

  const blockStart = '# --- CustomerIO Notification START ---';
  const blockEnd = '# --- CustomerIO Notification END ---';

  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    const useFcm = pushProvider === 'fcm';
    const snippetToInjectInPodfile = `
${blockStart}
target 'NotificationService' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
  pod 'customerio-reactnative-richpush/${useFcm ? "fcm" : "apn"}', :path => '${getRelativePathToRNSDK(
    iosPath
  )}'
end
${blockEnd}
`.trim();

    FileManagement.append(filename, snippetToInjectInPodfile);
  }
}
