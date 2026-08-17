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
    expect(workflow).toContain(
      'customerio/mobile-ci-tools/github-actions/ios/launch-simulator-app/v1@'
    );
    expect(workflow).toContain('workspaces=("$APP_PATH"/ios/*.xcworkspace)');
    expect(workflow).not.toContain('$APP_NAME.xcworkspace');
    expect(workflow).toContain('built app executable is stale');
    expect(workflow).toContain("expected-ios-major: '27'");
    expect(workflow).toContain('**Classification:** launch-passed');
  });
});
