import type { ConfigPlugin } from '@expo/config-plugins';
import { withXcodeProject } from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

import {
  injectCIOPodfileCode,
  type InjectCIOPodfileOptions,
} from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

export type WithCioXcodeProjectOptions = {
  /** Options for Podfile host app snippet (location subspec, etc.) */
  podfileOptions?: InjectCIOPodfileOptions;
};

/** Props for the CIO Xcode project mod; push options are optional when only location is enabled. */
export type WithCioXcodeProjectProps = Partial<CustomerIOPluginOptionsIOS> &
  WithCioXcodeProjectOptions;

const PUSH_HANDLER_FILENAME = 'CioSdkAppDelegateHandler.swift';

/**
 * The generated push handler imports the selected push module. Removing that pod while leaving the
 * source in an incrementally generated project makes the host app fail to compile. Expo owns native
 * project regeneration, so require its clean path instead of trying to remove Xcode and host-source
 * state piecemeal.
 */
export function assertPushRemovalIsSafe(
  iosPath: string,
  projectName: string | undefined,
  hasPush: boolean | undefined
): void {
  if (hasPush !== false || !projectName) return;

  const generatedHandlerPath = path.join(
    iosPath,
    projectName,
    PUSH_HANDLER_FILENAME
  );
  if (!fs.existsSync(generatedHandlerPath)) return;

  throw new Error(
    'Removing Customer.io push notifications from an existing iOS project requires a clean prebuild. ' +
      'Run `npx expo prebuild --clean --platform ios` so Expo removes the generated push handler and related build references.'
  );
}

export const withCioXcodeProject: ConfigPlugin<WithCioXcodeProjectProps> = (
  config,
  cioProps
) => {
  return withXcodeProject(config, async (props) => {
    const iosPath = props.modRequest.platformProjectRoot;
    const podfileOptions = cioProps?.podfileOptions;

    assertPushRemovalIsSafe(
      iosPath,
      props.modRequest.projectName,
      podfileOptions?.hasPush
    );

    await injectCIOPodfileCode(
      iosPath,
      isFcmPushProvider(cioProps as CustomerIOPluginOptionsIOS | undefined),
      podfileOptions
    );

    return props;
  });
};
