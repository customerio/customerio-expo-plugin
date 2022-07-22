import { IOSConfig, withXcodeProject } from '@expo/config-plugins';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const { getAppDelegateFilePath } = IOSConfig.Paths;

// Copy over AppDelegate.swift and cioconfigplugin-Bridging-Header.h files
export function withCustomerIOReactBridge(config, props) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const { projectName, projectRoot } = cfg.modRequest;

    // Get the Xcode project "key" that the new file entries will be added to

    const group = xcodeProject.pbxGroupByName(projectName);
    const key = xcodeProject.findPBXGroupKey({
      name: group.name,
      path: group.path,
    });

    // The directory where new source files should be copied to
    const sourceDir = dirname(getAppDelegateFilePath(projectRoot));

    // A helper function to copy files into the project
    const addSourceFile = (name) => {
      const src = resolve(__dirname, 'ios', name);
      const dst = resolve(sourceDir, name);
      writeFileSync(dst, readFileSync(src, 'utf-8'));
      // Update the Xcode project data stored in the cfg object
      xcodeProject.addSourceFile(`${projectName}/${name}`, null, key);
    };

    const files = [
      'CustomerioReactnative.m',
      'CustomerioReactnative-Bridging-Header.h',
      'CustomerioReactnative.swift',
      'CustomerioUtils.swift',
    ];

    files.forEach((filename) => {
      addSourceFile(filename);
    });

    return cfg;
  });
}
