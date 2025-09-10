import type { MakeDirectoryOptions } from 'fs';
import {
  appendFile,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFile,
  readFileSync,
  writeFile,
  writeFileSync,
} from 'fs';
import { logger } from '../../utils/logger';

export class FileManagement {
  static async read(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      readFile(path, 'utf8', (err, data) => {
        if (err || !data) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  static async write(path: string, contents: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      writeFile(path, contents, 'utf8', (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  static async append(path: string, contents: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      appendFile(path, contents, 'utf8', (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  static exists(path: string) {
    return existsSync(path);
  }

  static copyFile(src: string, dest: string) {
    try {
      copyFileSync(src, dest);
    } catch (err) {
      logger.error(`Error copying file from ${src} to ${dest}: `, err);
    }
  }

  static mkdir(path: string, options: MakeDirectoryOptions) {
    try {
      mkdirSync(path, options);
    } catch (err) {
      logger.error(`Error creating directory ${path}: `, err);
    }
  }

  static writeFile(path: string, data: string) {
    try {
      writeFileSync(path, data);
    } catch (err) {
      logger.error(`Error writing to file ${path}: `, err);
    }
  }

  static readFile(path: string) {
    try {
      return readFileSync(path, 'utf-8');
    } catch (err) {
      logger.error(`Error reading file ${path}: `, err);
    }

    return '';
  }
}
