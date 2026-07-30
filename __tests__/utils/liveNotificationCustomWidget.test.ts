import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  installCustomLiveActivityWidget,
  resolveCustomLiveActivityWidget,
} from '../../plugin/src/helpers/utils/liveNotificationCustomWidget';
import type { LiveNotificationCustomWidget } from '../../plugin/src/types/cio-types';

// These tests run against a real project tree: the resolver's whole job is deciding what is safe to
// copy into the generated widget target, and that depends on what is actually on disk.

const RESERVED = [
  'CIOLiveActivityWidgetBundle.swift',
  'CIOLiveActivityWidget-Info.plist',
  'Assets.xcassets',
];

const WIDGET_SOURCE = `import CioLiveActivities_Attributes
import SwiftUI
import WidgetKit

struct RideshareLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CIOCustomAttributes.self) { context in
            Text(context.state.data["status"] ?? "")
        } dynamicIsland: { _ in DynamicIsland {} }
    }
}
`;

let projectRoot: string;
let warn: jest.SpyInstance;

/**
 * Splits the test's combined shape into the two config surfaces the resolver now reads:
 * `customType` is SDK config, `customWidget` is a build-time option.
 */
const resolve = (
  input:
    | { customType?: string; customWidget?: LiveNotificationCustomWidget }
    | undefined,
  autoInitializes = true
) =>
  resolveCustomLiveActivityWidget({
    liveNotifications: input?.customType ? { customType: input.customType } : undefined,
    buildOptions: input?.customWidget ? { customWidget: input.customWidget } : undefined,
    autoInitializes,
    projectRoot,
    reservedFilenames: RESERVED,
  });

const writeProjectFile = (relativePath: string, contents = WIDGET_SOURCE): string => {
  const absolute = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return absolute;
};

beforeEach(() => {
  projectRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cio-custom-widget-'))
  );
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('resolveCustomLiveActivityWidget()', () => {
  test('resolves a relative path against the project root', () => {
    const absolute = writeProjectFile('ios-widgets/RideshareLiveActivity.swift');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.swift',
          structName: 'RideshareLiveActivity',
        },
      })
    ).toEqual({
      sourceFiles: [absolute],
      filenames: ['RideshareLiveActivity.swift'],
      structName: 'RideshareLiveActivity',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test('accepts an absolute path and several files', () => {
    const widget = writeProjectFile('widgets/RideshareLiveActivity.swift');
    const views = writeProjectFile('widgets/RideshareViews.swift', 'struct RideshareViews {}');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: [widget, './widgets/RideshareViews.swift'],
          structName: 'RideshareLiveActivity',
        },
      })
    ).toEqual({
      sourceFiles: [widget, views],
      filenames: ['RideshareLiveActivity.swift', 'RideshareViews.swift'],
      structName: 'RideshareLiveActivity',
    });
  });

  test('returns nothing when no custom widget is configured', () => {
    expect(resolve({})).toBeNull();
    expect(resolve(undefined)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  test('warns when a custom type has no widget to render it', () => {
    expect(resolve({ customType: 'com.myapp.rideshare' })).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('customType "com.myapp.rideshare" is set without')
    );
  });

  // Legitimate when the app registers the identifier from JavaScript at initialize, a mistake
  // otherwise — the widget still compiles either way, so this only warns.
  test('warns but still resolves when the custom type is missing', () => {
    writeProjectFile('ios-widgets/RideshareLiveActivity.swift');

    expect(
      resolve({
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.swift',
          structName: 'RideshareLiveActivity',
        },
      })
    ).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('config.liveNotifications.customType is not set')
    );
  });

  test('skips a missing file rather than failing prebuild', () => {
    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/Missing.swift',
          structName: 'RideshareLiveActivity',
        },
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found at'));
  });

  test('skips a path that is not a .swift file', () => {
    writeProjectFile('ios-widgets/RideshareLiveActivity.m');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.m',
          structName: 'RideshareLiveActivity',
        },
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('is not a .swift file'));
  });

  test('skips when structName is missing, since the bundle entry cannot be inferred', () => {
    writeProjectFile('ios-widgets/RideshareLiveActivity.swift');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.swift',
          structName: '  ',
        },
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('structName is required'));
  });

  // Everything is flattened into the widget directory, so two files can't share a name — and none of
  // them may shadow a file the plugin itself writes there.
  test('refuses two sources with the same file name', () => {
    writeProjectFile('a/RideshareViews.swift');
    writeProjectFile('b/RideshareViews.swift');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: ['./a/RideshareViews.swift', './b/RideshareViews.swift'],
          structName: 'RideshareViews',
        },
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('already copied from another sourceFile entry')
    );
  });

  test.each(RESERVED.filter((filename) => filename.endsWith('.swift')))(
    'refuses a source that would shadow %s',
    (reserved) => {
      writeProjectFile(`ios-widgets/${reserved}`);

      expect(
        resolve({
          customType: 'com.myapp.rideshare',
          customWidget: {
            sourceFile: `./ios-widgets/${reserved}`,
            structName: 'RideshareLiveActivity',
          },
        })
      ).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('generated by the plugin'));
    }
  );

  test('refuses a name that only differs in case, which is the same file on APFS', () => {
    writeProjectFile('ios-widgets/cioliveactivitywidgetbundle.swift');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/cioliveactivitywidgetbundle.swift',
          structName: 'RideshareLiveActivity',
        },
      })
    ).toBeNull();
  });

  // A struct name that matches nothing fails at the Xcode build ("cannot find … in scope"), so it is
  // worth surfacing at prebuild — but only as a warning, since the check is textual.
  test('warns when structName is not declared in the sources, and still resolves', () => {
    writeProjectFile('ios-widgets/RideshareLiveActivity.swift');

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.swift',
          structName: 'TypoedName',
        },
      })
    ).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('structName "TypoedName" was not found')
    );
  });

  test('accepts a struct declared with modifiers', () => {
    writeProjectFile(
      'ios-widgets/RideshareLiveActivity.swift',
      '@available(iOS 16.2, *)\npublic struct RideshareLiveActivity: Widget {}\n'
    );

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customWidget: {
          sourceFile: './ios-widgets/RideshareLiveActivity.swift',
          structName: 'RideshareLiveActivity',
        },
      })
    ).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('installCustomLiveActivityWidget()', () => {
  test('copies every source into the widget directory and reports the names to register', () => {
    writeProjectFile('ios-widgets/RideshareLiveActivity.swift');
    writeProjectFile('ios-widgets/RideshareViews.swift', 'struct RideshareViews {}');
    const resolved = resolve({
      customType: 'com.myapp.rideshare',
      customWidget: {
        sourceFile: [
          './ios-widgets/RideshareLiveActivity.swift',
          './ios-widgets/RideshareViews.swift',
        ],
        structName: 'RideshareLiveActivity',
      },
    });

    const widgetPath = path.join(projectRoot, 'ios', 'CIOLiveActivityWidget');
    fs.mkdirSync(widgetPath, { recursive: true });

    expect(installCustomLiveActivityWidget(resolved!, widgetPath)).toEqual([
      'RideshareLiveActivity.swift',
      'RideshareViews.swift',
    ]);
    expect(fs.readFileSync(path.join(widgetPath, 'RideshareLiveActivity.swift'), 'utf8')).toEqual(
      WIDGET_SOURCE
    );
    expect(fs.existsSync(path.join(widgetPath, 'RideshareViews.swift'))).toBe(true);
  });
});
