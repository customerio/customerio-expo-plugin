const {
  templatePackageName,
  parseTemplateCandidates,
  selectTemplateVersion,
  chooseStableExpoVersion,
  describeTemplateResolutionFailure,
  pinnedExactVersion,
} = require('../../scripts/utils/expo-template');

// Real `npm view 'expo-template-default@>=57.0.0 <58.0.0' version dependencies.expo --json`
// output, captured 2026-08-14. Each template pins the `expo` release from two
// patches earlier, which is what makes the newest template unusable while
// `expo@latest` catches up.
const TEMPLATES_57 = [
  { version: '57.0.0', expoRange: '~57.0.0-preview.0' },
  { version: '57.0.1', expoRange: '~57.0.0-preview.1' },
  { version: '57.0.2', expoRange: '~57.0.0' },
  { version: '57.0.3', expoRange: '~57.0.1' },
  { version: '57.0.4', expoRange: '~57.0.2' },
  { version: '57.0.5', expoRange: '~57.0.3' },
  { version: '57.0.6', expoRange: '~57.0.4' },
  { version: '57.0.7', expoRange: '~57.0.5' },
  { version: '57.0.8', expoRange: '~57.0.6' },
  { version: '57.0.9', expoRange: '~57.0.7' },
  { version: '57.0.10', expoRange: '~57.0.8' },
  { version: '57.0.11', expoRange: '~57.0.9' },
  { version: '57.0.12', expoRange: '~57.0.10' },
  { version: '57.0.13', expoRange: '~57.0.11' },
  { version: '57.0.14', expoRange: '~57.0.12' },
  { version: '57.0.15', expoRange: '~57.0.13' },
];

// Tail of the same query for major 54. `sdk-54` points at 54.0.62; 54.0.63 is
// published but carries no dist-tag.
const TEMPLATES_54 = [
  { version: '54.0.59', expoRange: '~54.0.32' },
  { version: '54.0.60', expoRange: '~54.0.33' },
  { version: '54.0.61', expoRange: '~54.0.34' },
  { version: '54.0.62', expoRange: '~54.0.35' },
  { version: '54.0.63', expoRange: '~54.0.36' },
];

describe('selectTemplateVersion', () => {
  // The regression test for this whole change. On 2026-08-14 `expo@latest` was
  // 57.0.12 while the `sdk-57` template tag pointed at 57.0.15, which pins
  // ~57.0.13 — a `next`-channel expo whose expo-file-system was unpublished.
  // Hardcoding @sdk-<major> took that template and turned every Expo PR red.
  it('walks back from the tagged template when it pins an unreleased expo', () => {
    const selected = selectTemplateVersion(TEMPLATES_57, '57.0.12', '57.0.15');

    expect(selected).toEqual({ version: '57.0.14', expoRange: '~57.0.12' });
  });

  it('takes the tagged template once stable latest catches up', () => {
    // Same table, one `expo` patch later: the tag becomes usable again, so the
    // selection returns to it on its own. This is not a pin.
    const selected = selectTemplateVersion(TEMPLATES_57, '57.0.13', '57.0.15');

    expect(selected).toEqual({ version: '57.0.15', expoRange: '~57.0.13' });
  });

  // `sdk-54` is the curated template for that SDK. 54.0.63 is newer and also
  // satisfiable, but carries no dist-tag — taking it would mean trusting an
  // unblessed publish on a leg of the matrix that was never broken.
  it('prefers the curated dist-tag over a newer untagged template', () => {
    const selected = selectTemplateVersion(TEMPLATES_54, '54.0.36', '54.0.62');

    expect(selected).toEqual({ version: '54.0.62', expoRange: '~54.0.35' });
  });

  it('falls back to the newest satisfiable template when the tag is unknown', () => {
    expect(selectTemplateVersion(TEMPLATES_54, '54.0.36', null)).toEqual({
      version: '54.0.63',
      expoRange: '~54.0.36',
    });
  });

  it('ignores a tagged version that is absent from the candidate list', () => {
    expect(selectTemplateVersion(TEMPLATES_54, '54.0.36', '54.0.99')).toEqual({
      version: '54.0.63',
      expoRange: '~54.0.36',
    });
  });

  it('returns the newest satisfiable template regardless of input order', () => {
    const shuffled = [TEMPLATES_57[2], TEMPLATES_57[15], TEMPLATES_57[13], TEMPLATES_57[7]];

    expect(selectTemplateVersion(shuffled, '57.0.12', '57.0.15')).toEqual({
      version: '57.0.13',
      expoRange: '~57.0.11',
    });
  });

  it('returns null when no template in the major is satisfiable', () => {
    // Every template ahead of stable latest: the "upstream registry
    // inconsistent" case, which must be reported as such rather than as a
    // plugin regression.
    expect(selectTemplateVersion(TEMPLATES_57.slice(-2), '57.0.11', '57.0.15')).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(selectTemplateVersion([], '57.0.13', '57.0.15')).toBeNull();
  });

  it('ignores prerelease template versions even when satisfiable', () => {
    const withCanary = [
      ...TEMPLATES_57.slice(0, 14),
      { version: '58.0.0-canary-20260812-27f94d4', expoRange: '~57.0.12' },
    ];

    expect(selectTemplateVersion(withCanary, '57.0.12', null)).toEqual({
      version: '57.0.13',
      expoRange: '~57.0.11',
    });
  });

  it('skips candidates with no expo pin instead of throwing', () => {
    const withGap = [...TEMPLATES_57.slice(0, 15), { version: '57.0.15', expoRange: undefined }];

    expect(selectTemplateVersion(withGap, '57.0.12', '57.0.15')).toEqual({
      version: '57.0.14',
      expoRange: '~57.0.12',
    });
  });

  it('skips candidates with an unparseable expo range', () => {
    const withJunk = [...TEMPLATES_57.slice(0, 15), { version: '57.0.15', expoRange: 'workspace:*' }];

    expect(selectTemplateVersion(withJunk, '57.0.12', '57.0.15')).toEqual({
      version: '57.0.14',
      expoRange: '~57.0.12',
    });
  });
});

// The template only decides which `expo` *range* lands in package.json. npm
// resolves a `~` range to the highest published version, ignoring dist-tags, so
// `~57.0.12` still installs 57.0.13 when that release exists on `next` only.
// Closing the channel requires writing an exact version into the generated app.
describe('pinnedExactVersion', () => {
  it('recognises an exact version', () => {
    expect(pinnedExactVersion('57.0.12')).toBe('57.0.12');
  });

  it('rejects ranges, which are what let a next-channel release back in', () => {
    expect(pinnedExactVersion('~57.0.12')).toBeNull();
    expect(pinnedExactVersion('^57.0.12')).toBeNull();
    expect(pinnedExactVersion('>=57.0.0 <58.0.0')).toBeNull();
    expect(pinnedExactVersion('*')).toBeNull();
  });

  it('rejects absent or non-semver values', () => {
    expect(pinnedExactVersion(undefined)).toBeNull();
    expect(pinnedExactVersion('')).toBeNull();
    expect(pinnedExactVersion('file:../local')).toBeNull();
  });
});

describe('chooseStableExpoVersion', () => {
  // Helper that records which sources were consulted, so the tests can assert
  // the current major never falls back to the published-version list.
  function sources({ latest = null, sdkTag = null, newestStableInMajor = null } = {}) {
    const calls = [];
    return {
      calls,
      latest: () => {
        calls.push('latest');
        return latest;
      },
      sdkTag: (major) => {
        calls.push(`sdkTag:${major}`);
        return sdkTag;
      },
      newestStableInMajor: (major) => {
        calls.push(`newestStableInMajor:${major}`);
        return newestStableInMajor;
      },
    };
  }

  it('uses the latest dist-tag for the current major', () => {
    const src = sources({ latest: '57.0.13' });

    expect(chooseStableExpoVersion(57, src)).toBe('57.0.13');
    expect(src.calls).toEqual(['latest']);
  });

  // The load-bearing detail. During the outage, 57.0.13 was already published
  // as a plain, non-prerelease semver version — it was just tagged `next`
  // rather than `latest`. Gating on "newest non-prerelease version in the
  // major" would have resolved 57.0.13, found template 57.0.15's ~57.0.13
  // satisfied, and reproduced the outage exactly. Channel, not version string,
  // is what makes a release usable.
  it('never falls back to the published version list for the current major', () => {
    const src = sources({ latest: '57.0.12', newestStableInMajor: '57.0.13' });

    expect(chooseStableExpoVersion(57, src)).toBe('57.0.12');
    expect(src.calls).toEqual(['latest']);
    expect(src.calls).not.toContain('newestStableInMajor:57');
  });

  it('uses the sdk-<major> dist-tag for an older major', () => {
    const src = sources({ latest: '57.0.13', sdkTag: '54.0.36' });

    expect(chooseStableExpoVersion(54, src)).toBe('54.0.36');
    expect(src.calls).toEqual(['latest', 'sdkTag:54']);
  });

  it('falls back to the newest stable release for a major with no sdk tag', () => {
    // `expo` prunes old channel tags: sdk-52 is the oldest that still exists,
    // so `--expo-version=50` has to come from the version list. Safe there —
    // `next` and `canary` never point at a superseded major.
    const src = sources({ latest: '57.0.13', sdkTag: null, newestStableInMajor: '50.0.21' });

    expect(chooseStableExpoVersion(50, src)).toBe('50.0.21');
    expect(src.calls).toEqual(['latest', 'sdkTag:50', 'newestStableInMajor:50']);
  });

  it('returns null for a major with no stable release yet', () => {
    const src = sources({ latest: '57.0.13' });

    expect(chooseStableExpoVersion(58, src)).toBeNull();
  });

  // A major ahead of `latest` is where the `next` channel lives, so the version
  // list is exactly the wrong source there: 58.0.0 can be published, entirely
  // non-prerelease, months before it is blessed as `latest`. The list is only
  // safe for majors already superseded.
  it('never consults the version list for a major ahead of latest', () => {
    const src = sources({ latest: '57.0.13', newestStableInMajor: '58.0.0' });

    expect(chooseStableExpoVersion(58, src)).toBeNull();
    expect(src.calls).not.toContain('newestStableInMajor:58');
  });

  it('rejects a prerelease sdk dist-tag', () => {
    const src = sources({ latest: '57.0.13', sdkTag: '55.0.3-canary-20260429-a5e59cf' });

    expect(chooseStableExpoVersion(55, src)).toBeNull();
  });

  it('rejects a prerelease latest dist-tag', () => {
    const src = sources({ latest: '58.0.0-canary-20260812-27f94d4' });

    expect(chooseStableExpoVersion(58, src)).toBeNull();
  });

  it('ignores an sdk dist-tag from the wrong major', () => {
    const src = sources({ latest: '57.0.13', sdkTag: '54.0.36', newestStableInMajor: '53.0.27' });

    expect(chooseStableExpoVersion(53, src)).toBe('53.0.27');
  });
});

describe('parseTemplateCandidates', () => {
  it('parses the multi-match array shape', () => {
    const raw = [
      { 'version': '57.0.14', 'dependencies.expo': '~57.0.12' },
      { 'version': '57.0.15', 'dependencies.expo': '~57.0.13' },
    ];

    expect(parseTemplateCandidates(raw)).toEqual([
      { version: '57.0.14', expoRange: '~57.0.12' },
      { version: '57.0.15', expoRange: '~57.0.13' },
    ]);
  });

  it('parses the single-match object shape', () => {
    // `npm view` collapses a one-result range query to a bare object.
    const raw = { 'version': '57.0.15', 'dependencies.expo': '~57.0.13' };

    expect(parseTemplateCandidates(raw)).toEqual([{ version: '57.0.15', expoRange: '~57.0.13' }]);
  });

  it('keeps entries whose expo pin is absent so they can be skipped downstream', () => {
    const raw = [{ 'version': '57.0.15' }];

    expect(parseTemplateCandidates(raw)).toEqual([{ version: '57.0.15', expoRange: undefined }]);
  });

  it('returns an empty list for empty registry output', () => {
    expect(parseTemplateCandidates(null)).toEqual([]);
    expect(parseTemplateCandidates(undefined)).toEqual([]);
    expect(parseTemplateCandidates([])).toEqual([]);
  });
});

describe('describeTemplateResolutionFailure', () => {
  // Misattributing an upstream registry state to a plugin regression is what
  // actually cost the time on 2026-08-14, so the diagnosis has to name the
  // versions that disagree rather than just failing.
  it('reports the template channel running ahead of the stable expo release', () => {
    const report = describeTemplateResolutionFailure({
      major: 57,
      templatePackage: 'expo-template-default',
      stableExpoVersion: '57.0.12',
      candidates: TEMPLATES_57,
    }).join('\n');

    expect(report).toContain('Stable `expo` for SDK 57: 57.0.12');
    expect(report).toContain('Newest `expo-template-default`: 57.0.15, pins expo ~57.0.13 — unsatisfied');
    expect(report).toContain('Checked 16 template version(s)');
    expect(report).toContain('template channel is ahead of the stable expo release');
  });

  it('identifies the newest template by version, not by registry ordering', () => {
    const report = describeTemplateResolutionFailure({
      major: 57,
      templatePackage: 'expo-template-default',
      stableExpoVersion: '57.0.11',
      candidates: [TEMPLATES_57[14], TEMPLATES_57[15], TEMPLATES_57[13]],
    }).join('\n');

    expect(report).toContain('Newest `expo-template-default`: 57.0.15');
  });

  it('reports a major with no stable expo release', () => {
    const report = describeTemplateResolutionFailure({
      major: 58,
      templatePackage: 'expo-template-default',
      stableExpoVersion: null,
      candidates: [],
    }).join('\n');

    expect(report).toContain('No stable `expo` release published for SDK 58');
    expect(report).toContain('`sdk-58`');
  });

  // The count and the "newest" it names must describe the templates actually
  // evaluated. Reporting unevaluated entries — or printing `pins expo undefined`
  // — undermines the one job this message has: closing the "is this us?"
  // question on sight.
  it('counts only the candidates the selector could evaluate', () => {
    const report = describeTemplateResolutionFailure({
      major: 57,
      templatePackage: 'expo-template-default',
      stableExpoVersion: '57.0.11',
      candidates: [
        { version: '57.0.14', expoRange: '~57.0.12' },
        { version: '57.0.15', expoRange: undefined },
        { version: '58.0.0-canary-20260812-27f94d4', expoRange: '~57.0.11' },
      ],
    }).join('\n');

    expect(report).toContain('Newest `expo-template-default`: 57.0.14, pins expo ~57.0.12');
    expect(report).toContain('Checked 1 template version(s)');
    expect(report).not.toContain('undefined');
    expect(report).not.toContain('canary');
  });

  it('reports a major with no stable template published', () => {
    const report = describeTemplateResolutionFailure({
      major: 57,
      templatePackage: 'expo-template-default',
      stableExpoVersion: '57.0.13',
      candidates: [],
    }).join('\n');

    expect(report).toContain('No usable `expo-template-default` version published for SDK 57');
  });
});

describe('templatePackageName', () => {
  it('expands create-expo-app template shorthand to the npm package name', () => {
    expect(templatePackageName('default')).toBe('expo-template-default');
    expect(templatePackageName('blank')).toBe('expo-template-blank');
  });

  it('leaves an already-qualified package name alone', () => {
    expect(templatePackageName('expo-template-default')).toBe('expo-template-default');
  });
});
