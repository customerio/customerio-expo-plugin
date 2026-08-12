const fs = require('fs');
const path = require('path');
const {
  assertSafeContainedPath,
  PROBE_MODULE_DIR_NAME,
  removeRejectedProbePluginFromAppJson,
} = require('./lib');

// Installs the MBL-2232 lifecycle probe into a generated Expo fixture app:
//
//   1. copies lifecycle-fixture/probe-module/ to <app>/modules/cio-lifecycle-probe/
//      (Expo autolinking picks local modules up from `modules/`), and
//   2. removes the rejected subscriber-era config plugin if an older fixture
//      run left it in app.json. Harness context, including provider, is
//      injected explicitly and is never inferred from Expo config.
//
// Run before `expo prebuild`. Re-runnable: the copy is replaced wholesale and
// the app.json edit is idempotent.
//
// Usage:
//   node lifecycle-fixture/scripts/install-probe.js --app-path=ci-test-apps/LifecycleFixture_Expo57

const REPO_ROOT = path.resolve(__dirname, '../..');
const GENERATED_FIXTURE_ROOT = path.join(REPO_ROOT, 'ci-test-apps');
const PROBE_MODULE_SOURCE = path.join(__dirname, '../probe-module');
const JAVASCRIPT_SOURCE = path.join(
  __dirname,
  '../javascript/LifecycleReceipts.ts'
);

function getArgValue(name) {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function main() {
  const appPathArg = getArgValue('--app-path');
  if (!appPathArg) {
    console.error('Missing required --app-path=<generated expo app>');
    process.exit(1);
  }
  const requestedAppPath = path.resolve(REPO_ROOT, appPathArg);
  let appPath;
  let generatedFixtureRoot;
  try {
    assertSafeContainedPath(REPO_ROOT, GENERATED_FIXTURE_ROOT, {
      label: 'generated fixture root',
    });
    assertSafeContainedPath(REPO_ROOT, PROBE_MODULE_SOURCE, {
      label: 'probe module source',
    });
    assertSafeContainedPath(REPO_ROOT, JAVASCRIPT_SOURCE, {
      label: 'JavaScript receipt source',
    });
    appPath = fs.realpathSync(requestedAppPath);
    generatedFixtureRoot = fs.realpathSync(GENERATED_FIXTURE_ROOT);
  } catch {
    console.error(`Fixture app path does not exist: ${requestedAppPath}`);
    process.exit(1);
  }
  const relativeAppPath = path.relative(generatedFixtureRoot, appPath);
  if (
    relativeAppPath === '' ||
    relativeAppPath === '..' ||
    relativeAppPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeAppPath)
  ) {
    console.error(
      `Refusing app path outside ${path.relative(
        REPO_ROOT,
        generatedFixtureRoot
      )}`
    );
    process.exit(1);
  }
  if (!fs.existsSync(path.join(appPath, 'app.json'))) {
    console.error(`No app.json found at ${appPath} — not an Expo app root.`);
    process.exit(1);
  }

  const moduleDest = path.join(appPath, 'modules', PROBE_MODULE_DIR_NAME);
  assertSafeContainedPath(appPath, moduleDest, {
    allowMissing: true,
    label: 'probe module destination',
  });
  fs.rmSync(moduleDest, { recursive: true, force: true });
  assertSafeContainedPath(appPath, moduleDest, {
    allowMissing: true,
    label: 'probe module destination',
  });
  fs.mkdirSync(path.dirname(moduleDest), { recursive: true });
  assertSafeContainedPath(appPath, moduleDest, {
    allowMissing: true,
    label: 'probe module destination',
  });
  fs.cpSync(PROBE_MODULE_SOURCE, moduleDest, { recursive: true });

  const javascriptDest = path.join(
    appPath,
    'src/lifecycle/LifecycleReceipts.ts'
  );
  assertSafeContainedPath(appPath, javascriptDest, {
    allowMissing: true,
    label: 'JavaScript receipt destination',
  });
  fs.mkdirSync(path.dirname(javascriptDest), { recursive: true });
  assertSafeContainedPath(appPath, javascriptDest, {
    allowMissing: true,
    label: 'JavaScript receipt destination',
  });
  fs.copyFileSync(JAVASCRIPT_SOURCE, javascriptDest);

  const appJsonPath = assertSafeContainedPath(
    appPath,
    path.join(appPath, 'app.json'),
    { label: 'generated app.json' }
  );
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  removeRejectedProbePluginFromAppJson(appJson);
  assertSafeContainedPath(appPath, appJsonPath, {
    label: 'generated app.json',
  });
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

  console.log(`Probe installed at ${path.relative(REPO_ROOT, moduleDest)}`);
  console.log(
    `Lifecycle JS receipts installed at ${path.relative(
      REPO_ROOT,
      javascriptDest
    )}`
  );
  console.log('Next: npx expo prebuild --clean --platform=ios inside the app.');
}

main();
