import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';
import * as fs from 'fs';
import * as path from 'path';

export async function injectCIOPodfileCode(iosPath: string, isFcmPushProvider: boolean) {
  const blockStart = '# --- CustomerIO Host App START ---';
  const blockEnd = '# --- CustomerIO Host App END ---';

  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(new RegExp(blockStart));
  
  // Check if this is Expo 53 by looking for Swift-based AppDelegate
  const appDelegatePath = path.join(iosPath, 'AppDelegate.swift');
  const isExpo53 = fs.existsSync(appDelegatePath);

  if (!matches) {
    // We need to decide what line of code in the Podfile to insert our native code.
    // The "post_install" line is always present in an Expo project Podfile so it's reliable.
    // Find that line in the Podfile and then we will insert our code above that line.
    const lineInPodfileToInjectSnippetBefore = /post_install do \|installer\|/;
    
    let snippetToInjectInPodfile = '';
    
    if (isExpo53) {
      // For Expo 53, we need to include the ReactAppDependencyProvider source
      snippetToInjectInPodfile = `
${blockStart}
  # Add source for ReactAppDependencyProvider
  source 'https://github.com/react-native-tvos/react-native-tvos-podspecs.git'
  
  pod 'customerio-reactnative/${isFcmPushProvider ? "fcm" : "apn"}', :path => '${getRelativePathToRNSDK(
        iosPath
      )}'
${blockEnd}
`.trim();
      console.log('Adding ReactAppDependencyProvider source for Expo 53');
    } else {
      // For older Expo versions
      snippetToInjectInPodfile = `
${blockStart}
  pod 'customerio-reactnative/${isFcmPushProvider ? "fcm" : "apn"}', :path => '${getRelativePathToRNSDK(
        iosPath
      )}'
${blockEnd}
`.trim();
    }

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
  pod 'customerio-reactnative-richpush/${isFcmPushProvider ? "fcm" : "apn"}', :path => '${getRelativePathToRNSDK(
      iosPath
    )}'
end
${blockEnd}
`.trim();

    FileManagement.append(filename, snippetToInjectInPodfile);
  }
}