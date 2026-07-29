/**
 * WIP (inbox): pins the Customer.io iOS pods to the native base feature branch.
 *
 * The app depends on customerio-reactnative from a git branch whose podspec requires
 * `CustomerIOMessagingInbox`, and the native Visual Inbox is not published yet, so a plain
 * `pod install` cannot resolve it.
 *
 * This runs as a prebuild mod rather than as a step in setup-test-app-pnpm-monorepo.sh, because the
 * script was the only path that applied it: `prebuild:ios` runs `expo prebuild --clean` (which
 * installs pods immediately, against an unpinned Podfile) and EAS's `eas-build-post-install` prebuilds
 * with `--no-install` and then installs pods itself. As a mod, every prebuild — local, scripted, or on
 * EAS — writes the pins before pods are installed.
 *
 * DELETE this plugin and its app.json entry once the native inbox publishes.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BRANCH = process.env.CIO_IOS_BRANCH || 'feat/overlay-inbox';
const MARKER = 'install_non_production_ios_sdk_git_branch';

// The override helper is fetched from customerio-ios `main`, whose pod list does not include the
// inbox yet, so the inbox pod is added explicitly. Jist resolves on its own, because
// CustomerIOMessagingInbox.podspec on the branch depends on the published `Jist 0.1.0`.
const header = [
  '# WIP (inbox): unreleased native Visual Inbox — see plugins/with-cio-inbox-pods.js',
  "require 'open-uri'",
  "IO.copy_stream(URI.open('https://raw.githubusercontent.com/customerio/customerio-ios/main/scripts/cocoapods_override_sdk.rb'), '/tmp/override_cio_sdk.rb')",
  "load '/tmp/override_cio_sdk.rb'",
  '',
  '',
].join('\n');

const podLines = (branch) =>
  [
    '',
    `  install_non_production_ios_sdk_git_branch(branch_name: '${branch}', is_app_extension: false, push_service: 'apn')`,
    `  pod 'CustomerIOMessagingInbox', :git => 'https://github.com/customerio/customerio-ios.git', :branch => '${branch}'`,
    `  pod 'CustomerIOTrackingMigration', :git => 'https://github.com/customerio/customerio-ios.git', :branch => '${branch}'`,
    '',
  ].join('\n');

module.exports = function withCioInboxPods(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes(MARKER)) {
        return cfg;
      }

      const targetMatch = contents.match(/^target ['"][^'"]+['"] do\n/m);
      if (!targetMatch) {
        throw new Error(
          '[with-cio-inbox-pods] could not find a target block in the generated Podfile'
        );
      }

      const insertAt = targetMatch.index + targetMatch[0].length;
      const patched =
        header +
        contents.slice(0, insertAt) +
        podLines(BRANCH) +
        contents.slice(insertAt);

      fs.writeFileSync(podfile, patched);
      // eslint-disable-next-line no-console
      console.log(`[with-cio-inbox-pods] pinned CIO iOS pods to ${BRANCH}`);
      return cfg;
    },
  ]);
};
