import fs from 'fs';
import os from 'os';
import path from 'path';

import { getRelativePathToRNSDK } from '../../plugin/src/helpers/constants/ios';

// These tests build real on-disk fixture trees (including symlinks for the
// pnpm case) and exercise the resolver against them. The behaviour we care
// about is that the returned :path agrees with what React Native autolinking
// emits, which depends on both layout and RN version (see the dispatch in
// `getRelativePathToRNSDK`).

const CIO_PKG_JSON = JSON.stringify({
  name: 'customerio-reactnative',
  version: '6.4.0',
});

function makeCioPkg(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), CIO_PKG_JSON);
}

function makeRnPkg(rootDir: string, version: string) {
  const dir = path.join(rootDir, 'node_modules', 'react-native');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'react-native', version })
  );
}

let logSpy: jest.SpyInstance;

beforeEach(() => {
  // Silence the always-on plugin logs so test output stays readable.
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('getRelativePathToRNSDK fixtures', () => {
  let tmpRoot: string;

  beforeEach(() => {
    // realpath because os.tmpdir() goes through /var → /private/var symlinks
    // on macOS, and the modern (RN >=0.80) branch realpath()s the resolved
    // dir; tests need to compare against the resolved form to avoid
    // spurious mismatches from that base-path indirection.
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'cio-resolve-'))
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('flat npm + RN >=0.80: resolves to ../node_modules/customerio-reactnative', () => {
    const projectRoot = path.join(tmpRoot, 'flat-npm-rn81');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });
    makeCioPkg(path.join(projectRoot, 'node_modules', 'customerio-reactnative'));
    makeRnPkg(projectRoot, '0.81.4');

    expect(getRelativePathToRNSDK(iosPath)).toBe(
      path.join('..', 'node_modules', 'customerio-reactnative')
    );
  });

  it('flat npm + RN <0.80: resolves to ../node_modules/customerio-reactnative (no regression)', () => {
    // The dominant install layout (regular npm, no monorepo, no symlinks)
    // must emit the same string regardless of which RN version pins the
    // dispatch branch. This locks in the no-regression guarantee for the
    // overwhelming majority of users when we changed the resolver.
    const projectRoot = path.join(tmpRoot, 'flat-npm-rn79');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });
    makeCioPkg(path.join(projectRoot, 'node_modules', 'customerio-reactnative'));
    makeRnPkg(projectRoot, '0.79.5');

    expect(getRelativePathToRNSDK(iosPath)).toBe(
      path.join('..', 'node_modules', 'customerio-reactnative')
    );
  });

  it('pnpm + RN <0.80: returns the symlink path (matches @react-native-community/cli)', () => {
    const projectRoot = path.join(tmpRoot, 'pnpm-rn79');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    const realDir = path.join(
      projectRoot,
      'node_modules',
      '.pnpm',
      'customerio-reactnative@6.4.0_abc',
      'node_modules',
      'customerio-reactnative'
    );
    makeCioPkg(realDir);

    const symlinkDir = path.join(projectRoot, 'node_modules', 'customerio-reactnative');
    fs.symlinkSync(realDir, symlinkDir, 'dir');
    makeRnPkg(projectRoot, '0.79.5');

    const resolved = getRelativePathToRNSDK(iosPath);

    // The fix the plan was originally designed for: under RN 0.79 community
    // CLI, autolinking emits the symlink path. We must too.
    expect(resolved).toBe(
      path.join('..', 'node_modules', 'customerio-reactnative')
    );
    expect(resolved).not.toContain('.pnpm');
  });

  it('pnpm + RN >=0.80: returns the .pnpm realpath (matches expo-modules-autolinking)', () => {
    const projectRoot = path.join(tmpRoot, 'pnpm-rn81');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    const realDir = path.join(
      projectRoot,
      'node_modules',
      '.pnpm',
      'customerio-reactnative@6.4.0_abc',
      'node_modules',
      'customerio-reactnative'
    );
    makeCioPkg(realDir);

    const symlinkDir = path.join(projectRoot, 'node_modules', 'customerio-reactnative');
    fs.symlinkSync(realDir, symlinkDir, 'dir');
    makeRnPkg(projectRoot, '0.81.4');

    const resolved = getRelativePathToRNSDK(iosPath);

    // Modern expo-modules-autolinking realpaths; we must too, otherwise
    // CocoaPods sees two :path values for the same pod.
    expect(resolved).toContain('.pnpm');
    expect(resolved).toBe(path.relative(iosPath, realDir));
  });

  it('yarn classic workspace: resolves to the hoisted parent node_modules', () => {
    const wsRoot = path.join(tmpRoot, 'yarn-ws');
    const appPath = path.join(wsRoot, 'apps', 'mobile');
    const iosPath = path.join(appPath, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    makeCioPkg(path.join(wsRoot, 'node_modules', 'customerio-reactnative'));
    fs.mkdirSync(path.join(appPath, 'node_modules'), { recursive: true });
    // RN hoisted to ws root too; modern Expo path here.
    makeRnPkg(wsRoot, '0.81.4');

    expect(getRelativePathToRNSDK(iosPath)).toBe(
      path.join('..', '..', '..', 'node_modules', 'customerio-reactnative')
    );
  });

  it('RN version unknown: defaults to realpath (modern behavior)', () => {
    const projectRoot = path.join(tmpRoot, 'no-rn');
    const iosPath = path.join(projectRoot, 'ios');
    fs.mkdirSync(iosPath, { recursive: true });

    const realDir = path.join(
      projectRoot,
      'node_modules',
      '.pnpm',
      'customerio-reactnative@6.4.0_abc',
      'node_modules',
      'customerio-reactnative'
    );
    makeCioPkg(realDir);
    fs.symlinkSync(
      realDir,
      path.join(projectRoot, 'node_modules', 'customerio-reactnative'),
      'dir'
    );
    // Deliberately no react-native fixture.

    const resolved = getRelativePathToRNSDK(iosPath);
    expect(resolved).toContain('.pnpm');
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
