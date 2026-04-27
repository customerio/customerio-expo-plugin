import fs from 'fs';
import os from 'os';
import path from 'path';

import { getRelativePathToRNSDK } from '../../plugin/src/helpers/constants/ios';

// These tests build real on-disk fixture trees (including symlinks for the
// pnpm case) and exercise the resolver against them. The behaviour we care
// about is that the returned :path agrees with what React Native autolinking
// emits, regardless of layout.

const PKG_JSON_CONTENT = JSON.stringify({
  name: 'customerio-reactnative',
  version: '6.4.0',
});

function makePkgJson(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), PKG_JSON_CONTENT);
}

describe('getRelativePathToRNSDK fixtures', () => {
  let tmpRoot: string;

  beforeEach(() => {
    // realpath because os.tmpdir() goes through /var → /private/var symlinks
    // on macOS. The fallback resolver path normalizes through realpath, so
    // tests need to compare against the resolved form to avoid spurious
    // mismatches that don't happen in real-world layouts.
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'cio-resolve-'))
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('flat npm: resolves to ../node_modules/customerio-reactnative', () => {
    const projectRoot = path.join(tmpRoot, 'flat-npm');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });
    makePkgJson(path.join(projectRoot, 'node_modules', 'customerio-reactnative'));

    expect(getRelativePathToRNSDK(iosPath)).toBe(
      path.join('..', 'node_modules', 'customerio-reactnative')
    );
  });

  it('pnpm: resolves to the symlink path, NOT the .pnpm realpath', () => {
    const projectRoot = path.join(tmpRoot, 'pnpm-app');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    // Real package lives inside the pnpm virtual store.
    const realDir = path.join(
      projectRoot,
      'node_modules',
      '.pnpm',
      'customerio-reactnative@6.4.0_abc',
      'node_modules',
      'customerio-reactnative'
    );
    makePkgJson(realDir);

    // Public symlink that React Native autolinking sees.
    const symlinkDir = path.join(projectRoot, 'node_modules', 'customerio-reactnative');
    fs.symlinkSync(realDir, symlinkDir, 'dir');

    const resolved = getRelativePathToRNSDK(iosPath);

    // The whole point of the fix: we must return the symlink path, not the
    // realpath inside .pnpm/. CocoaPods compares :path strings character-for-
    // character, so the realpath form would conflict with autolinking.
    expect(resolved).toBe(
      path.join('..', 'node_modules', 'customerio-reactnative')
    );
    expect(resolved).not.toContain('.pnpm');
  });

  it('yarn classic workspace: resolves to the hoisted parent node_modules', () => {
    const wsRoot = path.join(tmpRoot, 'yarn-ws');
    const appPath = path.join(wsRoot, 'apps', 'mobile');
    const iosPath = path.join(appPath, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    // Hoisted to the workspace root; the leaf app has no local copy.
    makePkgJson(path.join(wsRoot, 'node_modules', 'customerio-reactnative'));
    fs.mkdirSync(path.join(appPath, 'node_modules'), { recursive: true });

    expect(getRelativePathToRNSDK(iosPath)).toBe(
      path.join('..', '..', '..', 'node_modules', 'customerio-reactnative')
    );
  });

  it('throws a clear error when customerio-reactnative is missing', () => {
    const projectRoot = path.join(tmpRoot, 'no-dep');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    expect(() => getRelativePathToRNSDK(iosPath)).toThrow(
      /customerio-reactnative was not found/
    );
  });
});
