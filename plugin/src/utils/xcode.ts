import type { XcodeProject } from "@expo/config-plugins";
import path from 'path';
import { FileManagement } from "../helpers/utils/fileManagement";

/**
 * Gets an existing CustomerIO group or creates a new one in the Xcode project
 * @param xcodeProject The Xcode project instance
 * @param projectName The iOS project name
 * @returns The CustomerIO group reference
 */
export function getOrCreateCustomerIOGroup(
  xcodeProject: XcodeProject,
  projectName: string,
): XcodeProject['pbxCreateGroup'] {
  // Check if CustomerIO group already exists
  let customerIOGroup = xcodeProject.pbxGroupByName('CustomerIO');
  if (customerIOGroup) {
    return customerIOGroup;
  }

  // Create new CustomerIO group and add it to the project
  customerIOGroup = xcodeProject.pbxCreateGroup('CustomerIO');
  const projectGroupKey = xcodeProject.findPBXGroupKey({ name: projectName });
  xcodeProject.addToPbxGroup(customerIOGroup, projectGroupKey);
  return customerIOGroup;
}

/**
 * Copies template file to iOS project, applies transformations, and registers with Xcode
 * @param params.xcodeProject Xcode project instance
 * @param params.iosProjectRoot iOS project root path
 * @param params.projectName iOS project name
 * @param params.sourceFilePath Source template file path
 * @param params.targetFileName Target file name
 * @param params.transform Content transformation function
 * @param params.customerIOGroup CustomerIO group (auto-created if not provided)
 * @returns Destination file path
 */
export function copyFileToXcode({
  xcodeProject,
  iosProjectRoot,
  projectName,
  sourceFilePath,
  targetFileName,
  transform,
  customerIOGroup = getOrCreateCustomerIOGroup(xcodeProject, projectName),
}: {
  xcodeProject: XcodeProject;
  iosProjectRoot: string;
  projectName: string;
  sourceFilePath: string;
  targetFileName: string;
  transform: (content: string) => string;
  customerIOGroup?: XcodeProject['pbxCreateGroup'];
}): string {
  // Construct the full destination path within the iOS project directory
  const destinationPath = path.join(
    iosProjectRoot,
    projectName,
    targetFileName
  );

  try {
    // Read template, apply transformations, and write to project
    const content = transform(FileManagement.readFile(sourceFilePath));
    FileManagement.writeFile(destinationPath, content);
    // Register file with Xcode project
    xcodeProject.addSourceFile(`${projectName}/${targetFileName}`, null, customerIOGroup);
    return destinationPath;
  } catch (error) {
    console.warn(`Failed to add ${targetFileName} to Xcode project:`, error);
    throw error;
  }
}
