import fs from 'fs';
import os from 'os';
import path from 'path';

// The postinstall helper is plain CommonJS that reads INIT_CWD and writes
// expoVersion into customerio-reactnative/package.json. These tests build
// real fixture trees and verify the value lands in the right file under
// flat-npm, pnpm, and yarn-workspace layouts — and that no exception escapes
// when the package is missing.

const HELPER_PATH = '../plugin/src/postInstallHelper';

const INITIAL_RN_PKG = {
  name: 'customerio-reactnative',
  version: '6.4.0',
};

function makeRNPkgJson(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(INITIAL_RN_PKG, null, 2)
  );
}

function readRNPkgJson(dir: string): { name: string; version: string; expoVersion?: string } {
  return JSON.parse(
    fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
  );
}

describe('postInstallHelper.runPostInstall', () => {
  let tmpRoot: string;
  let pluginVersion: string;
  let originalInitCwd: string | undefined;

  beforeAll(() => {
    pluginVersion = require('../package.json').version;
  });

  beforeEach(() => {
    // realpath needed on macOS because os.tmpdir() symlinks /var to /private/var.
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'cio-postinstall-'))
    );
    originalInitCwd = process.env.INIT_CWD;
    // Reload helper between tests so it picks up the new INIT_CWD.
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    if (originalInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = originalInitCwd;
    }
  });

  it('flat npm: writes expoVersion into <consumer>/node_modules/customerio-reactnative/package.json', () => {
    const consumerRoot = path.join(tmpRoot, 'flat-npm');
    const rnDir = path.join(consumerRoot, 'node_modules', 'customerio-reactnative');
    makeRNPkgJson(rnDir);

    process.env.INIT_CWD = consumerRoot;
    const { runPostInstall } = require(HELPER_PATH);
    runPostInstall();

    expect(readRNPkgJson(rnDir).expoVersion).toBe(pluginVersion);
  });

  it('pnpm: writes through the symlinked path (real file ends up updated)', () => {
    const consumerRoot = path.join(tmpRoot, 'pnpm-app');
    const realDir = path.join(
      consumerRoot,
      'node_modules',
      '.pnpm',
      'customerio-reactnative@6.4.0_abc',
      'node_modules',
      'customerio-reactnative'
    );
    makeRNPkgJson(realDir);

    const symlinkDir = path.join(
      consumerRoot,
      'node_modules',
      'customerio-reactnative'
    );
    fs.mkdirSync(path.dirname(symlinkDir), { recursive: true });
    fs.symlinkSync(realDir, symlinkDir, 'dir');

    process.env.INIT_CWD = consumerRoot;
    const { runPostInstall } = require(HELPER_PATH);
    runPostInstall();

    // Writing through the symlink updates the real file.
    expect(readRNPkgJson(realDir).expoVersion).toBe(pluginVersion);
    expect(readRNPkgJson(symlinkDir).expoVersion).toBe(pluginVersion);
  });

  it('yarn classic workspace: walks up to the hoisted node_modules', () => {
    const wsRoot = path.join(tmpRoot, 'yarn-ws');
    const appPath = path.join(wsRoot, 'apps', 'mobile');
    fs.mkdirSync(path.join(appPath, 'node_modules'), { recursive: true });
    const rnDir = path.join(wsRoot, 'node_modules', 'customerio-reactnative');
    makeRNPkgJson(rnDir);

    process.env.INIT_CWD = appPath;
    const { runPostInstall } = require(HELPER_PATH);
    runPostInstall();

    expect(readRNPkgJson(rnDir).expoVersion).toBe(pluginVersion);
  });

  it('does not throw when customerio-reactnative is not installed', () => {
    const consumerRoot = path.join(tmpRoot, 'no-dep');
    fs.mkdirSync(consumerRoot, { recursive: true });

    process.env.INIT_CWD = consumerRoot;
    const { runPostInstall } = require(HELPER_PATH);

    expect(() => runPostInstall()).not.toThrow();
  });

  it('is idempotent — repeated runs do not rewrite when value matches', () => {
    const consumerRoot = path.join(tmpRoot, 'idem');
    const rnDir = path.join(consumerRoot, 'node_modules', 'customerio-reactnative');
    makeRNPkgJson(rnDir);

    process.env.INIT_CWD = consumerRoot;
    const { runPostInstall } = require(HELPER_PATH);
    runPostInstall();

    const pkgPath = path.join(rnDir, 'package.json');
    const firstMtime = fs.statSync(pkgPath).mtimeMs;

    // Spin briefly so a rewrite would be detectable via mtime.
    const start = Date.now();
    while (Date.now() - start < 20) { /* noop */ }

    runPostInstall();
    const secondMtime = fs.statSync(pkgPath).mtimeMs;

    expect(secondMtime).toBe(firstMtime);
  });
});
