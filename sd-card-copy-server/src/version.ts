import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The release version from the root package.json, which is two folders up from both src/version.ts and dist/server/version.js
 */
export const version: string = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')).version;
