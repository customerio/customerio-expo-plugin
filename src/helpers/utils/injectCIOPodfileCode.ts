import { CIO_PODFILE_REGEX, CIO_PODFILE_SNIPPET } from '../constants/ios';
import { FileManagement } from './fileManagement';

export async function injectCIOPodfileCode(iosPath: string) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const matches = podfile.match(CIO_PODFILE_REGEX);

  if (!matches) {
    FileManagement.append(filename, CIO_PODFILE_SNIPPET);
  }
}
