import { readFileSync, appendFile } from 'fs';

import { CIO_PODFILE_REGEX, CIO_PODFILE_SNIPPET } from '../constants/ios';

export async function injectCIOPodfileCode(iosPath: string) {
  const podfile = readFileSync(`${iosPath}/Podfile`, 'utf-8');
  const matches = podfile.match(CIO_PODFILE_REGEX);

  if (!matches) {
    appendFile(`${iosPath}/Podfile`, CIO_PODFILE_SNIPPET, (err) => {
      if (err) {
        throw new Error('Error writing to Podfile');
      }
    });
  }
}
