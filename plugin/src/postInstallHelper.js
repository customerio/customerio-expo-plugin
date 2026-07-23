const fs = require('fs');
const path = require('path');

const RN_SDK_PACKAGE = 'customerio-reactnative';

// Locate customerio-reactnative/package.json from a postinstall context.
//
// `INIT_CWD` is set by npm, pnpm, and yarn during lifecycle scripts to point
// at the consumer's project root. That makes it the most reliable starting
// point — the plugin's own __dirname can be deep inside `.pnpm/...` under pnpm.
//
// We probe `${INIT_CWD}/node_modules/customerio-reactnative/package.json` first
// so we agree with the symlinked layout React Native autolinking expects, then
// fall back to resolve-from from the consumer root, then to the legacy
// __dirname-relative walk-up for environments where INIT_CWD is missing.
function findRNSDKPackageJson() {
  const candidates = [];

  if (process.env.INIT_CWD) {
    candidates.push(
      path.join(process.env.INIT_CWD, 'node_modules', RN_SDK_PACKAGE, 'package.json')
    );
  }

  // Legacy flat-npm layout fallback: plugin lives at
  // <consumer>/node_modules/customerio-expo-plugin/plugin/src and the SDK at
  // <consumer>/node_modules/customerio-reactnative.
  candidates.push(path.join(__dirname, '..', '..', '..', RN_SDK_PACKAGE, 'package.json'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Final fallback: resolve-from from INIT_CWD. This walks up node_modules
  // and handles yarn classic workspaces where the dep is hoisted.
  if (process.env.INIT_CWD) {
    try {
      const resolveFrom = require('resolve-from');
      const resolved = resolveFrom.silent(
        process.env.INIT_CWD,
        `${RN_SDK_PACKAGE}/package.json`
      );
      if (resolved) return resolved;
    } catch (_) {
      // resolve-from missing or unable to resolve — fall through to null.
    }
  }

  return null;
}

function runPostInstall() {
  const expoPackageJsonFile = path.join(__dirname, '..', '..', 'package.json');

  try {
    const reactNativePackageJsonFile = findRNSDKPackageJson();
    if (!reactNativePackageJsonFile) {
      // Not necessarily an error: the plugin may be installed without the RN
      // SDK (e.g., during a tooling-only install). The prebuild-time write
      // covers the common case anyway.
      return;
    }

    const expoPackageJson = require(expoPackageJsonFile);
    const reactNativePackage = JSON.parse(
      fs.readFileSync(reactNativePackageJsonFile, 'utf8')
    );

    if (reactNativePackage.expoVersion === expoPackageJson.version) {
      return;
    }

    reactNativePackage.expoVersion = expoPackageJson.version;
    // Write atomically: write to a temp file in the same directory, then rename
    // it into place. rename(2) is atomic on the same filesystem, so a concurrent
    // reader during npm's parallel install (notably customerio-reactnative's own
    // `node src/postInstall.js` reading this package.json at Node startup) always
    // sees either the old or the new complete manifest — never a half-written
    // one. A plain writeFileSync truncates-then-writes and can be observed
    // mid-write, which surfaces as `ERR_INVALID_PACKAGE_CONFIG` and
    // intermittently fails installs (e.g. EAS Workflow repack jobs).
    const tmpFile = path.join(
      path.dirname(reactNativePackageJsonFile),
      `.package.json.${process.pid}.${Date.now()}.tmp`
    );
    fs.writeFileSync(tmpFile, JSON.stringify(reactNativePackage, null, 2));
    fs.renameSync(tmpFile, reactNativePackageJsonFile);
  } catch (error) {
    console.warn(
      'customerio-expo-plugin postinstall: failed to write expoVersion into customerio-reactnative/package.json. ' +
        'The expo prebuild step will retry this. Original error:',
      error
    );
  }
}

exports.runPostInstall = runPostInstall;
exports.findRNSDKPackageJson = findRNSDKPackageJson;
