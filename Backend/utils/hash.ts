import crypto from 'crypto';
import fs from 'fs';

export function hashFile(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
