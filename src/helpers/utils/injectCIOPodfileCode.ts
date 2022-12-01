import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import {
  CIO_PODFILE_NOTIFICATION_SNIPPET,
  CIO_PODFILE_NOTIFICATION_STATIC_FRAMEWORK_SNIPPET,
  CIO_PODFILE_NOTIFICATION_REGEX,
} from '../constants/ios';
import { FileManagement } from './fileManagement';

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks']
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(CIO_PODFILE_NOTIFICATION_REGEX);

  if (!matches) {
    const snippet =
      useFrameworks === 'static'
        ? CIO_PODFILE_NOTIFICATION_STATIC_FRAMEWORK_SNIPPET
        : CIO_PODFILE_NOTIFICATION_SNIPPET;
    FileManagement.append(filename, snippet);
  }
}
