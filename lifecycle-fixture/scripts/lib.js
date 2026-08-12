// Pure transforms for the MBL-2232 probe installer, kept side-effect free so
// the scenario suite can exercise them directly (see
// __tests__/scenarios/ios/lifecycleFixture.test.ts).

const fs = require('fs');
const path = require('path');

const PROBE_MODULE_DIR_NAME = 'cio-lifecycle-probe';
const REJECTED_PROBE_PLUGIN_APP_JSON_PATH = `./modules/${PROBE_MODULE_DIR_NAME}/app.plugin.js`;

function removeRejectedProbePluginFromAppJson(appJson) {
  if (!appJson.expo) {
    throw new Error('app.json has no `expo` key');
  }
  if (Array.isArray(appJson.expo.plugins)) {
    appJson.expo.plugins = appJson.expo.plugins.filter(
      (entry) => entry !== REJECTED_PROBE_PLUGIN_APP_JSON_PATH
    );
  }
  return appJson;
}

function isOutside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

/**
 * Resolves a fixture path without following descendant symlinks.
 *
 * The generated app is disposable, but its directories are still attacker-
 * controlled filesystem input. Checking only the app root is insufficient:
 * `modules`, `src`, `ios`, or a pinned-output parent could be a symlink that
 * redirects a recursive delete or write outside the fixture. Call this again
 * immediately before every mutation to narrow the check-to-use boundary.
 */
function assertSafeContainedPath(
  rootPath,
  targetPath,
  { allowMissing = false, label = 'fixture path' } = {}
) {
  let rootStat;
  try {
    rootStat = fs.lstatSync(rootPath);
  } catch {
    throw new Error(`${label}: containment root does not exist`);
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`${label}: containment root must be a real directory`);
  }

  const requestedRoot = path.resolve(rootPath);
  const requestedTarget = path.resolve(targetPath);
  const relative = path.relative(requestedRoot, requestedTarget);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    const root = fs.realpathSync(rootPath);
    throw new Error(`${label}: path escapes ${root}`);
  }

  // `/var` is a system symlink to `/private/var` on macOS. Preserve the
  // already-validated relative suffix while walking from the real root so a
  // trusted ancestor alias does not look like an escape.
  const root = fs.realpathSync(rootPath);
  const target = path.join(root, relative);
  let current = root;
  let missingComponent = false;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    if (missingComponent) continue;
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissing) {
        missingComponent = true;
        continue;
      }
      throw new Error(`${label}: path component does not exist: ${current}`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label}: refusing symbolic-link component: ${current}`);
    }
  }

  if (!missingComponent) {
    const realTarget = fs.realpathSync(target);
    if (isOutside(root, realTarget)) {
      throw new Error(`${label}: resolved path escapes ${root}`);
    }
  }
  return target;
}

module.exports = {
  assertSafeContainedPath,
  PROBE_MODULE_DIR_NAME,
  removeRejectedProbePluginFromAppJson,
};
