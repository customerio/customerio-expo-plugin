import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  installAndroidCustomLiveNotificationRenderer,
  resolveCustomLiveNotificationRenderer,
} from '../../plugin/src/helpers/utils/liveNotificationCustomRenderer';
import type { LiveNotificationCustomRenderer } from '../../plugin/src/types/cio-types';

// Like the widget resolver's tests, these run against a real project tree: the resolver's whole job
// is deciding what is safe to copy into the app, which depends on what is actually on disk.

const RENDERER_SOURCE = `package com.myapp.livenotifications

import android.app.Notification
import android.content.Context
import io.customer.messagingpush.data.communication.CustomerIOLiveNotificationsCallback
import io.customer.messagingpush.data.model.CustomerIOParsedPushPayload

class RideshareLiveNotificationCallback : CustomerIOLiveNotificationsCallback {
    override fun createLiveNotification(
        payload: CustomerIOParsedPushPayload,
        context: Context,
    ): Notification? = null
}
`;

let projectRoot: string;
let warn: jest.SpyInstance;

const resolve = (
  input:
    | { customType?: string; customRenderer?: LiveNotificationCustomRenderer }
    | undefined,
  silent = false
) =>
  resolveCustomLiveNotificationRenderer({
    liveNotifications: input?.customType ? { customType: input.customType } : undefined,
    buildOptions: input?.customRenderer
      ? { customRenderer: input.customRenderer }
      : undefined,
    projectRoot,
    silent,
  });

const writeProjectFile = (relativePath: string, contents = RENDERER_SOURCE): string => {
  const absolute = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return absolute;
};

beforeEach(() => {
  projectRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cio-custom-renderer-'))
  );
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('resolveCustomLiveNotificationRenderer()', () => {
  test('resolves a relative path and reads the package from the file', () => {
    const absolute = writeProjectFile(
      'android-renderers/RideshareLiveNotification.kt'
    );

    expect(
      resolve({
        customType: 'com.myapp.rideshare',
        customRenderer: {
          sourceFile: './android-renderers/RideshareLiveNotification.kt',
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toEqual({
      sourceFiles: [absolute],
      packages: ['com.myapp.livenotifications'],
      className: 'RideshareLiveNotificationCallback',
      classPackage: 'com.myapp.livenotifications',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test('takes the class package from the file that declares it, not the first file', () => {
    const helpers = writeProjectFile(
      'renderers/Helpers.kt',
      'package com.myapp.helpers\n\nobject Helpers\n'
    );
    const renderer = writeProjectFile('renderers/Rideshare.kt');

    expect(
      resolve({
        customRenderer: {
          sourceFile: ['./renderers/Helpers.kt', './renderers/Rideshare.kt'],
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toEqual({
      sourceFiles: [helpers, renderer],
      packages: ['com.myapp.helpers', 'com.myapp.livenotifications'],
      className: 'RideshareLiveNotificationCallback',
      // The declaring file's package, so the generated import compiles.
      classPackage: 'com.myapp.livenotifications',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test('warns when customType is set with no renderer to draw it', () => {
    expect(resolve({ customType: 'com.myapp.rideshare' })).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('customRenderer'),
      ...[]
    );
  });

  test('skips a file that declares no Kotlin package', () => {
    writeProjectFile('renderers/Rideshare.kt', 'class RideshareLiveNotificationCallback\n');

    expect(
      resolve({
        customRenderer: {
          sourceFile: './renderers/Rideshare.kt',
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('declares no Kotlin package'),
      ...[]
    );
  });

  test('skips a missing file, a non-Kotlin file, and a missing className', () => {
    expect(
      resolve({
        customRenderer: {
          sourceFile: './renderers/Missing.kt',
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toBeNull();

    writeProjectFile('renderers/Rideshare.swift', RENDERER_SOURCE);
    expect(
      resolve({
        customRenderer: {
          sourceFile: './renderers/Rideshare.swift',
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toBeNull();

    writeProjectFile('renderers/Rideshare.kt');
    expect(
      resolve({
        customRenderer: { sourceFile: './renderers/Rideshare.kt', className: '  ' },
      })
    ).toBeNull();

    expect(warn).toHaveBeenCalledTimes(3);
  });

  test('still resolves when the class is not found, warning about the assumed package', () => {
    writeProjectFile(
      'renderers/Rideshare.kt',
      'package com.myapp.livenotifications\n\nclass SomethingElse\n'
    );

    expect(
      resolve({
        customRenderer: {
          sourceFile: './renderers/Rideshare.kt',
          className: 'RideshareLiveNotificationCallback',
        },
      })
    ).toMatchObject({ classPackage: 'com.myapp.livenotifications' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('was not found in any configured'),
      ...[]
    );
  });

  test('silent suppresses warnings but reaches the same verdict', () => {
    // The copying mod and the code-generating mod both resolve; only one reports.
    expect(resolve({ customType: 'com.myapp.rideshare' }, true)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('installAndroidCustomLiveNotificationRenderer()', () => {
  test('copies each file under the package it declares', () => {
    writeProjectFile('renderers/Rideshare.kt');
    writeProjectFile(
      'renderers/Helpers.kt',
      'package com.myapp.helpers\n\nobject Helpers\n'
    );
    const renderer = resolve({
      customRenderer: {
        sourceFile: ['./renderers/Rideshare.kt', './renderers/Helpers.kt'],
        className: 'RideshareLiveNotificationCallback',
      },
    });
    const androidPath = path.join(projectRoot, 'android');

    expect(installAndroidCustomLiveNotificationRenderer(renderer!, androidPath)).toBe(2);

    const source = path.join(androidPath, 'app/src/main/java');
    expect(
      fs.existsSync(
        path.join(source, 'com/myapp/livenotifications/Rideshare.kt')
      )
    ).toBe(true);
    expect(
      fs.existsSync(path.join(source, 'com/myapp/helpers/Helpers.kt'))
    ).toBe(true);
  });
});
