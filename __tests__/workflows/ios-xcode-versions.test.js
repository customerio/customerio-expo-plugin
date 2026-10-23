const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('yaml');

const root = path.join(__dirname, '../..');
const readYaml = (file) => parse(fs.readFileSync(path.join(root, file), 'utf8'));

const SMOKE = '.github/workflows/validate-plugin-compatibility.yml';
const MATRIX = '.github/workflows/validate-plugin-compatibility-matrix.yml';
const FULL = '.github/workflows/validate-plugin-compatibility-full.yml';
const SAMPLE_APPS = '.github/workflows/reusable_build_sample_apps.yml';
const LAUNCH_ACTION = '.github/actions/launch-generated-ios-app/action.yml';

const XCODE_27_LAUNCH = {
  'runs-on': 'xcode-27',
  'xcode-version': '27.0',
  'launch-ios-major': 27,
};

const iosRows = (rows) => rows.filter((row) => row.platform === 'ios');

// Expo SDK 58+ generates a UIScene host, the only kind of app the iOS 27 SDK can
// launch, so `latest` builds and launches on Xcode 27. SDK 54-57 hosts stay on
// Xcode 26, the newest toolchain they can launch with.
function expectXcodeSplit(rows) {
  for (const row of iosRows(rows)) {
    if (row['expo-version'] === 'latest' || row['expo-version'] >= 58) {
      expect(row).toEqual(expect.objectContaining(XCODE_27_LAUNCH));
    } else {
      expect(row['runs-on']).toBe('macos-26');
      expect(row['xcode-version']).toBeUndefined();
      expect(row['launch-ios-major']).toBeUndefined();
    }
  }
}

function expectLaunchWiring(workflow, launchActionPath) {
  const job = Object.values(workflow.jobs)[0];
  const steps = job.steps;
  const names = steps.map((step) => step.name);

  expect(workflow.env.XCODE_VERSION).toBe('26.6');
  const setupIos = steps.find((step) => step.name === 'Setup iOS');
  expect(setupIos.with['xcode-version']).toBe(
    '${{ matrix.xcode-version || env.XCODE_VERSION }}'
  );

  // The resolver rejects a product older than the build, so the epoch has to
  // be written before the build starts.
  const validate = steps.find((step) => step.name === 'Validate Plugin');
  expect(validate.run.trim().split('\n')[0]).toBe(
    'date +%s > "$RUNNER_TEMP/build-start-epoch"'
  );

  const launch = steps.find((step) => step.name === 'Launch generated iOS app');
  expect(launch.if).toBe('matrix.launch-ios-major');
  expect(launch.uses).toBe(launchActionPath);
  expect(launch.with['expected-ios-major']).toBe('${{ matrix.launch-ios-major }}');
  expect(names.indexOf('Validate Plugin')).toBeLessThan(
    names.indexOf('Launch generated iOS app')
  );

  const upload = steps.find((step) => step.name === 'Upload launch logs');
  expect(upload.if).toBe('failure() && matrix.launch-ios-major');
}

describe('iOS Xcode versions in compatibility CI', () => {
  it('builds and launches latest on Xcode 27 in the smoke workflow', () => {
    const smoke = readYaml(SMOKE);
    expectXcodeSplit(
      smoke.jobs.smoke.strategy.matrix.include.map((row) => ({
        'expo-version': 'latest',
        ...row,
      }))
    );
    expect(iosRows(smoke.jobs.smoke.strategy.matrix.include)).toHaveLength(1);
    // Smoke always checks out the PR revision, which carries the action.
    expectLaunchWiring(smoke, './.github/actions/launch-generated-ios-app');
  });

  it('splits the release matrix between Xcode 27 and Xcode 26', () => {
    const matrix = readYaml(MATRIX);
    const rows = JSON.parse(matrix.on.workflow_call.inputs.matrix.default);
    expectXcodeSplit(rows);
    expect(iosRows(rows).filter((row) => row['expo-version'] === 'latest')).toHaveLength(2);
    expect(iosRows(rows).filter((row) => row['runs-on'] === 'macos-26')).not.toHaveLength(0);
    expectLaunchWiring(
      matrix,
      './.ci-launch-check/.github/actions/launch-generated-ios-app'
    );
    // The matrix checks out `inputs.ref`, which may predate the launch check,
    // so the action comes from this workflow's own revision.
    const sideCheckout = matrix.jobs.validate.steps.find(
      (step) => step.name === 'Check out the launch check'
    );
    expect(sideCheckout.if).toBe('matrix.launch-ios-major');
    expect(sideCheckout.with.ref).toBe('${{ github.sha }}');
    expect(sideCheckout.with.path).toBe('.ci-launch-check');
  });

  it('splits the full PR lane the same way', () => {
    const full = readYaml(FULL);
    expectXcodeSplit(JSON.parse(full.jobs['full-compatibility'].with.matrix));
  });

  it('keeps the sample app, an Expo SDK 55 host, on Xcode 26', () => {
    const sampleApps = readYaml(SAMPLE_APPS);
    const setupIos = sampleApps.jobs['build-ios-app'].steps.find(
      (step) => step.uses && step.uses.includes('/ios/setup-ios/')
    );
    expect(sampleApps.jobs['build-ios-app']['runs-on']).toBe('macos-26');
    expect(setupIos.with['xcode-version']).toBe('${{ env.XCODE_VERSION }}');
    expect(sampleApps.jobs['build-ios-app'].env.XCODE_VERSION).toBe('26.6');
    const testApp = JSON.parse(
      fs.readFileSync(path.join(root, 'test-app/package.json'), 'utf8')
    );
    expect(testApp.dependencies.expo).toMatch(/^~?5[4-7]\./);
  });

  it('launches through the shared simulator action', () => {
    const action = readYaml(LAUNCH_ACTION);
    const steps = action.runs.steps;
    expect(action.runs.using).toBe('composite');
    // Relative to the action, so it comes from the same checkout.
    expect(steps[0].env.RESOLVER).toBe(
      '${{ github.action_path }}/../../../scripts/compatibility/resolve_simulator_app.py'
    );
    expect(steps[0].run).toContain('--build-start-epoch "$BUILD_START_EPOCH_FILE"');
    expect(steps[0].run).toContain('echo "app-product-path=$app_product_path" >> "$GITHUB_OUTPUT"');
    expect(steps[1].uses).toBe(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@main'
    );
    expect(steps[1].with['app-path']).toBe(
      '${{ steps.resolve.outputs.app-product-path }}'
    );
  });

  // The launch action trusts the resolver to pick the freshly built product,
  // so its Python behavior suite runs with the workflow tests.
  it('executes the generated-app resolver behavior suite', () => {
    try {
      execFileSync(
        'python3',
        [
          '-m',
          'unittest',
          'scripts/compatibility/test_resolve_simulator_app.py',
        ],
        { cwd: root, stdio: 'pipe' }
      );
    } catch (error) {
      throw new Error(
        `resolver behavior suite failed: ${error.message}\nstdout:\n${
          error.stdout ?? ''
        }\nstderr:\n${error.stderr ?? ''}`
      );
    }
  }, 60_000);
});
