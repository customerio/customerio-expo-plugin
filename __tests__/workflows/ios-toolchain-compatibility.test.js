const fs = require('fs');
const path = require('path');

const workflowPath = path.join(
  __dirname,
  '../../.github/workflows/ios-toolchain-compatibility.yml'
);

describe('Xcode 27 preview workflow', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  it('uses the repository Node version and launches the generated app', () => {
    expect(workflow).toContain("NODE_VERSION: '24'");
    expect(workflow).toContain('-showBuildSettings');
    expect(workflow).toContain('WRAPPER_EXTENSION');
    expect(workflow).toContain('APP_PRODUCT_PATH=');
    expect(workflow).toContain('build-settings-private.json');
    expect(workflow).toContain('trap \'rm -f "$private_settings_json"\' EXIT');
    expect(workflow).toContain('"TARGET_BUILD_DIR",');
    expect(workflow).toContain('"WRAPPER_NAME",');
    expect(workflow).not.toContain(
      '${{ runner.temp }}/${{ matrix.ios-push-provider }}-build-settings-private.json'
    );
    expect(workflow).toContain(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@'
    );
    expect(workflow).toContain('workspaces=("$APP_PATH"/ios/*.xcworkspace)');
    expect(workflow).not.toContain('$APP_NAME.xcworkspace');
    expect(workflow).toContain('stale_executables.append(executable)');
    expect(workflow).toContain("expected-ios-major: '27'");
    expect(workflow).toContain('steps.launch.outputs.failure-reason');
    expect(workflow).toContain('simulator-infrastructure-unavailable');
    expect(workflow).toContain('**Classification:** launch-passed');
    expect(workflow).toContain("if: steps.launch.outcome == 'success'");
    expect(workflow).not.toContain('**Result:** ${{ job.status }}');
    expect(workflow).toContain(
      'launch-simulator-app/v1@8e270bbad1fa659379755aec99c5ad80ac23a7a4'
    );
  });
});
