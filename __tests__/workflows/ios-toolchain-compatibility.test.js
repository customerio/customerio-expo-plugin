const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('yaml');

const workflowPath = path.join(
  __dirname,
  '../../.github/workflows/ios-toolchain-compatibility.yml'
);

describe('Xcode 27 preview workflow', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const resolver = fs.readFileSync(
    path.join(
      __dirname,
      '../../scripts/compatibility/resolve_simulator_app.py'
    ),
    'utf8'
  );
  const definition = parse(workflow);
  const steps = definition.jobs.preview.steps;
  const step = (name) => steps.find((candidate) => candidate.name === name);

  it('uses the scene-enabled Expo canary and launches the generated app', () => {
    expect(definition.env.NODE_VERSION).toBe('24');
    expect(definition.env.EXPO_CANARY_VERSION).toBe(
      '58.0.0-canary-20260812-27f94d4'
    );
    expect(workflow).toContain(
      '--template "expo-template-default@$EXPO_CANARY_VERSION"'
    );
    expect(workflow).toContain('"dependencies.expo=$EXPO_CANARY_VERSION"');
    expect(workflow).toContain(
      '--template "expo-template-bare-minimum@$EXPO_CANARY_VERSION"'
    );
    expect(workflow).toContain(
      '--ios-push-provider=${{ matrix.ios-push-provider }}'
    );
    expect(workflow).toContain('npm_config_foreground_scripts=true');
    expect(step('Complete FCM fixture metadata').if).toBe(
      "matrix.ios-push-provider == 'fcm'"
    );
    expect(workflow).toContain("-c 'Add :PROJECT_ID string test-project'");
    expect(workflow).toContain(
      'echo "IOS_APP_NAME=$(basename "${workspaces[0]}" .xcworkspace)"'
    );
    expect(workflow).toContain('TEST_APP_NAME="$IOS_APP_NAME"');
    expect(workflow).toContain('-showBuildSettings');
    expect(resolver).toContain('"WRAPPER_EXTENSION"');
    expect(workflow).toContain('APP_PRODUCT_PATH=');
    expect(workflow).toContain('build-settings-private.json');
    expect(workflow).toContain('trap \'rm -f "$private_settings_json"\' EXIT');
    expect(workflow).toContain(
      'scripts/compatibility/resolve_simulator_app.py'
    );
    expect(workflow).toContain('--sanitized-settings-json "$settings_json"');
    expect(workflow).toContain('xcodebuild_status="$?"');
    expect(workflow).toContain('if [[ "$xcodebuild_status" -ne 0 ]]');
    expect(workflow).toContain(
      'xcodebuild -showBuildSettings failed with exit code $xcodebuild_status'
    );
    expect(
      step('Upload compatibility logs').with.path.trim().split('\n')
    ).toEqual([
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-launch.log',
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-build-settings.json',
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-build-start-epoch',
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-crash-reports',
    ]);
    expect(workflow).toContain(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@'
    );
    expect(workflow).toContain('workspaces=("$APP_PATH"/ios/*.xcworkspace)');
    expect(workflow).not.toContain('$APP_NAME.xcworkspace');
    expect(workflow).toContain("expected-ios-major: '27'");
    expect(step('Install and launch generated app').uses).toBe(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@main'
    );
    expect(step('Upload compatibility logs').if).toBe('always()');
    expect(step('Collect crash reports').if).toBe('failure()');
    expect(workflow).toContain('Library/Logs/DiagnosticReports');
    expect(step('Upload compatibility logs').with['if-no-files-found']).toBe(
      'error'
    );
    expect(workflow).not.toContain('steps.launch.outputs.failure-reason');
    expect(workflow).not.toContain('Record compatibility result');
    expect(workflow).not.toContain('Record launch failure');
    expect(workflow).not.toContain('Record unclassified failure');
  });

  it('executes the generated-app resolver behavior suite', () => {
    try {
      execFileSync(
        'python3',
        [
          '-m',
          'unittest',
          'scripts/compatibility/test_resolve_simulator_app.py',
        ],
        { cwd: path.join(__dirname, '../..'), stdio: 'pipe' }
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
