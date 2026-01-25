/**
 * Decompress kuromoji dictionary files
 * Vite serves .gz files with automatic decompression, but kuromoji expects to decompress them itself
 * So we decompress them beforehand and use uncompressed files
 */

import { createReadStream, createWriteStream, readdirSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join } from 'node:path';

const dictDir = 'public/dict';

console.log('Decompressing kuromoji dictionary files...');

const files = readdirSync(dictDir).filter(f => f.endsWith('.dat.gz'));

for (const file of files) {
  const inputPath = join(dictDir, file);
  const outputPath = join(dictDir, file.replace('.gz', ''));

  console.log(`Decompressing ${file}...`);

  const gunzip = createGunzip();
  const input = createReadStream(inputPath);
  const output = createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    input.pipe(gunzip).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
  });
}

console.log('Decompression complete!');
