import fs from 'fs';
import os from 'os';
import path from 'path';

import { injectCIOPodfileCode } from '../../../plugin/src/helpers/utils/injectCIOPodfileCode';

// `fcm-core` first ships in customerio-reactnative 7.1.0. Older versions have no such subspec, so
// prebuild should stop with the reason instead of leaving `pod install` to fail on it.

const PODFILE = [
  "target 'TestApp' do",
  '  use_expo_modules!',
  'end',
  '',
  'post_install do |installer|',
  '  react_native_post_install(installer)',
  'end',
  '',
].join('\n');

let projectRoot: string;
let iosPath: string;

const installRNSDK = (version: string) => {
  const dir = path.join(projectRoot, 'node_modules', 'customerio-reactnative');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'customerio-reactnative', version })
  );
};

const podfile = () => fs.readFileSync(path.join(iosPath, 'Podfile'), 'utf8');

beforeEach(() => {
  // realpath: os.tmpdir() goes through /var → /private/var on macOS.
  projectRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cio-fcm-core-'))
  );
  iosPath = path.join(projectRoot, 'ios');
  fs.mkdirSync(iosPath);
  fs.writeFileSync(path.join(iosPath, 'Podfile'), PODFILE);
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('ios scenarios — useFirebaseFromApp and the customerio-reactnative version', () => {
  it('stops prebuild when customerio-reactnative is older than 7.1.0', async () => {
    installRNSDK('7.0.0');

    await expect(
      injectCIOPodfileCode(iosPath, true, { useFirebaseFromApp: true })
    ).rejects.toThrow(
      'ios.pushNotification.useFirebaseFromApp needs customerio-reactnative 7.1.0 or later, but 7.0.0 is installed.'
    );
    expect(podfile()).toBe(PODFILE);
  });

  it.each(['7.1.0', '7.1.0-beta.1', '8.0.0'])(
    'writes fcm-core with customerio-reactnative %s',
    async (version) => {
      installRNSDK(version);

      await injectCIOPodfileCode(iosPath, true, { useFirebaseFromApp: true });

      expect(podfile()).toContain(
        "pod 'customerio-reactnative/fcm-core', :path => '../node_modules/customerio-reactnative'"
      );
    }
  );

  it('does not check the version for apps that keep the fcm subspec', async () => {
    installRNSDK('7.0.0');

    await injectCIOPodfileCode(iosPath, true);

    expect(podfile()).toContain(
      "pod 'customerio-reactnative/fcm', :path => '../node_modules/customerio-reactnative'"
    );
  });

  it('does not check the version for APN apps', async () => {
    installRNSDK('7.0.0');

    await injectCIOPodfileCode(iosPath, false, { useFirebaseFromApp: true });

    expect(podfile()).toContain(
      "pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'"
    );
  });
});
