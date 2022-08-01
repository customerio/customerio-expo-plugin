import { readFile, writeFile, appendFile } from 'fs';

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
}
