const fs = require('fs');
const path = require('path');
const { parse } = require('yaml');

const workflowsDir = path.join(__dirname, '../../.github/workflows');

const SUCCESS_NOTIFICATIONS = [
  'Notify team of git tag being created',
  'Notify team of successful deployment',
];

// Every step that posts to Slack through slackapi/slack-github-action, keyed by
// "<workflow file> > <step name>" so a failure names the step.
function slackSteps() {
  const found = [];
  for (const file of fs.readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const definition = parse(
      fs.readFileSync(path.join(workflowsDir, file), 'utf8')
    );
    for (const job of Object.values(definition.jobs || {})) {
      for (const step of job.steps || []) {
        if ((step.uses || '').startsWith('slackapi/slack-github-action@')) {
          found.push([`${file} > ${step.name}`, step]);
        }
      }
    }
  }
  return found;
}

describe('Slack notification steps', () => {
  const steps = slackSteps();

  it('finds the deploy and nightly notifications', () => {
    expect(steps.length).toBeGreaterThanOrEqual(5);
  });

  it('share one pinned action version', () => {
    const pins = new Set(steps.map(([, step]) => step.uses.split(' ')[0]));
    expect(pins.size).toBe(1);
    expect([...pins][0]).toMatch(/^slackapi\/slack-github-action@[0-9a-f]{40}$/);
  });

  it('pin a release that runs on Node 24', () => {
    // YAML parsing drops the `# vX.Y.Z` comment that names the pinned SHA, so
    // read it from the raw files. v3.0.0 is the first Node 24 release; v1 and
    // v2 run on the removed Node 20 runtime.
    const versions = [];
    for (const file of fs.readdirSync(workflowsDir)) {
      if (!/\.ya?ml$/.test(file)) continue;
      const raw = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      for (const match of raw.matchAll(
        /uses:\s*slackapi\/slack-github-action@[0-9a-f]{40}(?:\s*#\s*v(\d+)\S*)?/g
      )) {
        versions.push([file, match[1] && Number(match[1])]);
      }
    }
    expect(versions).toHaveLength(steps.length);
    for (const [file, major] of versions) {
      expect({ file, major }).toEqual({ file, major: expect.any(Number) });
      expect(major).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(steps)('%s posts through the incoming webhook', (_, step) => {
    // v2+ of the action ignores the v1 SLACK_WEBHOOK_* environment variables.
    expect(step.env?.SLACK_WEBHOOK_URL).toBeUndefined();
    expect(step.env?.SLACK_WEBHOOK_TYPE).toBeUndefined();
    expect(step.with.webhook).toBe('${{ secrets.SLACK_WEBHOOK_URL }}');
    expect(step.with['webhook-type']).toBe('incoming-webhook');
    // Success posts are non-fatal so a Slack outage or a missing secret cannot
    // fail a release that worked; failure posts fail loudly (`errors: true`).
    if (SUCCESS_NOTIFICATIONS.includes(step.name)) {
      expect(step['continue-on-error']).toBe(true);
      expect(step.with.errors).toBeUndefined();
    } else {
      expect(step.with.errors).toBe(true);
    }
  });

  it.each(steps)('%s sends a JSON payload', (_, step) => {
    // GitHub expressions are substituted before the action parses the
    // payload, and every expression here sits inside a JSON string.
    expect(() => JSON.parse(step.with.payload)).not.toThrow();
  });
});
