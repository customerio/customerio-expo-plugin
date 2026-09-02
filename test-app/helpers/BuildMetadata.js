import Constants from 'expo-constants';

const expoConfig = Constants.expoConfig;
const extras = expoConfig?.extra || {};

const BuildMetadata = {
  sdkVersion: getSdkVersion('customerio-reactnative'),
  pluginVersion: getSdkVersion('customerio-expo-plugin'),
  appVersion: resolveValidOrElse(expoConfig?.version),
  buildDate: formatBuildDateWithRelativeTime(extras.buildTimestamp),
  gitMetadata: `${resolveValidOrElse(
    extras.branchName,
    () => 'development build'
  )}-${resolveValidOrElse(extras.commitHash, () => 'untracked')}`,
  defaultWorkspace: resolveValidOrElse(extras.workspaceName),
  language: 'JavaScript',
  uiFramework: 'Expo (React Native)',
  sdkIntegration: 'npm',

  toString() {
    const cdpApiKey = resolveValidOrElse(extras.cdpApiKey, () => 'Failed to load!');
    const siteId = resolveValidOrElse(extras.siteId, () => 'Failed to load!');

    return `
      CDP API Key: ${cdpApiKey}
      Site ID: ${siteId}
      Plugin Version: ${this.pluginVersion}
      RN SDK Version: ${this.sdkVersion}
      App Version: ${this.appVersion}
      Build Date: ${this.buildDate}
      Branch: ${this.gitMetadata}
      Default Workspace: ${this.defaultWorkspace}
      Language: ${this.language}
      UI Framework: ${this.uiFramework}
      SDK Integration: ${this.sdkIntegration}
    `;
  },
};

function resolveValidOrElse(value, fallback = () => 'unknown') {
  return value && value.trim() && !value.startsWith("@") ? value : fallback();
}

function formatBuildDateWithRelativeTime(timestamp) {
  if (!timestamp) return 'unavailable';
  const parsedTimestamp = parseInt(timestamp, 10);
  if (isNaN(parsedTimestamp)) return 'invalid timestamp';

  const buildDate = new Date(parsedTimestamp * 1000);
  const now = new Date();
  const daysAgo = Math.floor((now - buildDate) / (1000 * 60 * 60 * 24));

  return `${buildDate.toLocaleString()} ${
    daysAgo === 0 ? '(Today)' : `(${daysAgo} days ago)`
  }`;
}

function getSdkVersion(sdkPackageName) {
  try {
    // The installed manifest is the source of truth for what is actually
    // running. Both plugin install paths use `npm install --no-save`, so the
    // plugin never reaches the lockfile — and that install can also move
    // customerio-reactnative within its range without the lockfile recording
    // it, which would otherwise report a stale version here.
    //
    // The lockfile is still consulted, but only for the `file:` marker that
    // says the dependency was built from source rather than published.
    const installed = getInstalledManifest(sdkPackageName);
    const lockEntry = getSdkMetadataFromPackageLock(sdkPackageName);

    if (!installed && !lockEntry) {
      console.warn(
        `${sdkPackageName} not found in node_modules or package-lock.json`
      );
      return undefined;
    }

    const version = resolveValidOrElse((installed || lockEntry).version);
    const isBuiltFromSource = Boolean(
      lockEntry && lockEntry.resolved && lockEntry.resolved.startsWith('file:')
    );
    if (isBuiltFromSource) {
      return `${version}-${resolveValidOrElse(
        extras.commitsAheadCount,
        () => 'as-source'
      )}`;
    }

    return version;
  } catch (error) {
    console.warn(
      `Failed to read ${sdkPackageName} sdk version: ${error.message}`
    );
    return undefined;
  }
}

// Static requires: the bundler resolves these at build time, so the specifier
// cannot be built from a variable.
function getInstalledManifest(packageName) {
  try {
    if (packageName === 'customerio-expo-plugin') {
      return require('customerio-expo-plugin/package.json');
    }
    if (packageName === 'customerio-reactnative') {
      return require('customerio-reactnative/package.json');
    }
  } catch (error) {
    console.warn(`Failed to read ${packageName}/package.json: ${error.message}`);
  }
  return undefined;
}

function getSdkMetadataFromPackageLock(packageName) {
  const packageLockPath = '../package-lock.json';
  try {
    const packageLock = require(packageLockPath);
    const packages = packageLock.packages || {};
    const resolvedPackageName = `node_modules/${packageName}`;
    const sdkPackage = packages[resolvedPackageName];
    if (sdkPackage) {
      return sdkPackage;
    }
  } catch (error) {
    console.warn(`Failed to read ${packageLockPath}: ${error.message}`);
  }
  return undefined;
}

export { BuildMetadata };
