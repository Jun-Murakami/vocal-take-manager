/**
 * Generate src/version.ts from package.json.
 * Keeps app version consistent across UI and builds.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);

// Read package.json and extract version string.
const packageJsonPath = join(repoRoot, 'package.json');
const packageJsonText = await readFile(packageJsonPath, 'utf8');
const packageJson = JSON.parse(packageJsonText);
const version = String(packageJson.version || '0.0.0');

// Write version module used by the UI.
const versionFilePath = join(repoRoot, 'src', 'version.ts');
const versionFileContent = `/**
 * Generated file. Do not edit manually.
 * The value is sourced from package.json at build time.
 */
export const appVersion = '${version}';
`;

await writeFile(versionFilePath, versionFileContent, 'utf8');
