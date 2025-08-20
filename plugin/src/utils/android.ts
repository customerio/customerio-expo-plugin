import type { ExportedConfigWithProps } from '@expo/config-plugins';
import type { ApplicationProjectFile } from '@expo/config-plugins/build/android/Paths';
import path from 'path';
import { FileManagement } from '../helpers/utils/fileManagement';
import { getAndroidNativeFilesPath } from './plugin';

// Generic utility to add import to Kotlin files
export const addImportToFile = (content: string, importStatement: string): string => {
  if (content.includes(importStatement)) {
    return content;
  }

  const importRegex = /^import\s+[^\s\n]+.*$/gm;
  const imports = [...content.matchAll(importRegex)];

  if (imports.length === 0) {
    const packageRegex = /package\s+[^\s;]+[;\s]*\n/;
    const packageMatch = content.match(packageRegex);
    if (!packageMatch) return content;

    const insertPosition = (packageMatch.index ?? 0) + packageMatch[0].length;
    return content.substring(0, insertPosition) + `\n${importStatement}\n` + content.substring(insertPosition);
  }

  const lastImport = imports[imports.length - 1];
  const insertPosition = (lastImport.index ?? 0) + lastImport[0].length;
  return content.substring(0, insertPosition) + `\n\n${importStatement}` + content.substring(insertPosition);
};

// Find matching bracket position (simplified version inspired by the library method)
const findMatchingBracketPosition = (content: string, bracket: string, startPos: number): number => {
  const openBracket = bracket;
  const closeBracket = bracket === '{' ? '}' : bracket === '(' ? ')' : ']';

  let depth = 0;
  let foundOpen = false;

  for (let i = startPos; i < content.length; i++) {
    const char = content[i];
    if (char === openBracket) {
      foundOpen = true;
      depth++;
    } else if (char === closeBracket) {
      depth--;
      if (foundOpen && depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

// Generic utility to add code to end of a method (before closing brace)
export const addCodeToMethod = (content: string, methodRegex: RegExp, codeToAdd: string): string => {
  const methodMatch = content.match(methodRegex);
  if (!methodMatch || methodMatch.index === undefined) return content;

  const methodStart = methodMatch.index;
  const methodContent = methodMatch[0];

  // Find the opening brace position within the method match
  const openBraceIndex = methodContent.indexOf('{');
  if (openBraceIndex === -1) return content;

  // Find the matching closing brace
  const absoluteOpenBracePos = methodStart + openBraceIndex;
  const closeBracePos = findMatchingBracketPosition(content, '{', absoluteOpenBracePos);
  if (closeBracePos === -1) return content;

  // Insert code just before the closing brace
  return content.substring(0, closeBracePos) + codeToAdd + '\n  ' + content.substring(closeBracePos);
};

// Copy template file to Android project with content transformation
export const copyTemplateFile = (
  expoConfig: ExportedConfigWithProps<ApplicationProjectFile>,
  filename: string,
  classPackage: string,
  patchContent: (content: string) => string,
): void => {
  const projectRoot = expoConfig.modRequest.projectRoot;
  const mainSourceDir = path.join(projectRoot, 'android/app/src/main/java');
  const packagePath = path.join(mainSourceDir, classPackage.replace(/\./g, '/'));

  try {
    FileManagement.mkdir(packagePath, { recursive: true });
    const sourcePath = path.join(getAndroidNativeFilesPath(), filename);
    const content = patchContent(FileManagement.readFile(sourcePath));
    const destinationPath = path.join(packagePath, filename);
    FileManagement.writeFile(destinationPath, content);
  } catch (error) {
    console.warn(`Failed to copy ${filename} to Android project:`, error);
    throw error;
  }
};
