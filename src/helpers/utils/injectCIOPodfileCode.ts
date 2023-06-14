import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { FileManagement } from './fileManagement';

export async function injectCIOPodfileCode(iosPath: string) {
  const hostAppTargetBlockStart = '# --- CustomerIO Host App START ---';
  const hostAppTargetBlockContents = `  pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'`;
  const hostAppTargetBlockEnd = '# --- CustomerIO Host App END ---';

  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(new RegExp(hostAppTargetBlockStart));

  if (!matches) {
    const lines = podfile.split('\n');
    // We need to decide what line of code in the Podfile to insert our native code.
    // The "post_install" line is always present in an Expo project Podfile so it's reliable.
    // Find that line in the Podfile and then we will insert our code above that line.
    const index = lines.findIndex((line) =>
      /post_install do \|installer\|/.test(line)
    );
    let content: string[] = lines;
    if (index > -1) {
      // Constructs the new Podfile contents that we will write to the file system.
      content = [
        ...lines.slice(0, index - 1),
        hostAppTargetBlockStart,
        hostAppTargetBlockContents,
        hostAppTargetBlockEnd,
        ...lines.slice(index - 1),
      ];
    }

    FileManagement.write(filename, content.join('\n'));
  } else {
    console.log('CustomerIO Podfile snippets already exists. Skipping...');
  }
}

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks']
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);

  const blockStart = '# --- CustomerIO Notification START ---';
  const blockContent = `target 'NotificationService' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
  pod 'customerio-reactnative-richpush/apn', :path => '../node_modules/customerio-reactnative'
end`;
  const blockEnd = '# --- CustomerIO Notification END ---';

  const matches = podfile.match(new RegExp(blockStart));

  if (!matches) {
    const content: string[] = [blockStart, blockContent, blockEnd];

    FileManagement.append(filename, content.join('\n'));
  }
}
