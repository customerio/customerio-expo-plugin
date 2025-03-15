import type { ExpoConfig } from '@expo/config-types';
import * as fs from 'fs-extra';
import * as path from 'path';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import type { CustomerIOPluginOptions } from './types/cio-types';

// Get required version from peer dependencies
function getRequiredSDKVersion() {
  try {
    // Use direct path relative to __dirname to be consistent with postInstallHelper
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.peerDependencies['customerio-reactnative'];
  } catch (error) {
    console.warn('Could not determine required SDK version:', error);
    return null;
  }
}

// Entry point for config plugin
function withCustomerIOPlugin(
  config: ExpoConfig,
  props: CustomerIOPluginOptions
) {
  // Validate dependency during configuration
  // Even if validation fails, we continue with the configuration
  try {
    validateDependencies();
  } catch (error) {
    // If validation fails for any reason, log it but continue
    console.warn('Version validation failed, but continuing with configuration:', error);
  }
  
  if (props.ios) {
    config = withCIOIos(config, props.ios);
  }

  if (props.android) {
    config = withCIOAndroid(config, props.android);
  }

  return config;
}

export function validateDependencies() {
  try {
    // Use Node's own resolution algorithm instead of hardcoded paths
    let sdkPath;
    try {
      sdkPath = require.resolve('customerio-reactnative/package.json');
    } catch (e) {
      console.warn('\x1b[33m%s\x1b[0m', 
        `Warning: customerio-reactnative is not installed! Please install version ${getRequiredSDKVersion() || 'specified in peer dependencies'}.`
      );
      return;
    }
    
    const sdkPkg = JSON.parse(fs.readFileSync(sdkPath, 'utf8'));
    const requiredVersion = getRequiredSDKVersion();
    
    // Compare versions
    if (requiredVersion && sdkPkg.version !== requiredVersion) {
      console.warn('\x1b[33m%s\x1b[0m', 
        `Warning: customerio-expo-plugin requires customerio-reactnative ${requiredVersion}, but found ${sdkPkg.version}.`
      );
    }
  } catch (error) {
    console.warn('Could not validate dependencies:', error);
  }
}

export default withCustomerIOPlugin;