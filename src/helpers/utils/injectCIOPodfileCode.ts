import {
  CIO_PODFILE_REGEX,
  CIO_PODFILE_SNIPPET,
  CIO_PODFILE_POST_INSTALL_REGEX,
  CIO_PODFILE_TARGET_NAMES_SNIPPET,
  CIO_PODFILE_POST_INSTALL_SNIPPET,
  CIO_PODFILE_POST_INSTALL_FALLBACK_SNIPPET,
  CIO_PODFILE_NOTIFICATION_SNIPPET,
  CIO_PODFILE_NOTIFICATION_REGEX,
} from '../constants/ios';
import { FileManagement } from './fileManagement';

export async function injectCIOPodfileCode(iosPath: string) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(CIO_PODFILE_REGEX);

  const lines = podfile.split('\n');
  const index = lines.findIndex((line) =>
    CIO_PODFILE_POST_INSTALL_REGEX.test(line)
  );
  let content: string[] = lines;
  if (index > -1) {
    content = [
      ...lines.slice(0, index - 1),
      !matches ? CIO_PODFILE_SNIPPET : '',
      CIO_PODFILE_TARGET_NAMES_SNIPPET,
      ...lines.slice(index - 1, index + 1),
      CIO_PODFILE_POST_INSTALL_SNIPPET,
      ...lines.slice(index + 1),
    ];
  } else {
    content.push(CIO_PODFILE_POST_INSTALL_FALLBACK_SNIPPET);
  }

  FileManagement.write(filename, content.join('\n'));
}

export async function injectCIONotificationPodfileCode(iosPath: string) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(CIO_PODFILE_NOTIFICATION_REGEX);

  if (!matches) {
    FileManagement.append(filename, CIO_PODFILE_NOTIFICATION_SNIPPET);
  }
}
