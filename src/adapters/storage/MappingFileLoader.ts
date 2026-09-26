import * as fs from 'fs';
import * as path from 'path';

export class MappingFileLoader {
  static loadFromFile(filePath: string): string | undefined {
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      return undefined;
    }
    return fs.readFileSync(resolved, 'utf-8');
  }
}
