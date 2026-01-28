#!/usr/bin/env node

const checker = require('license-checker');
const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(__dirname, '../public');
const outputFile = path.join(outputDir, 'licenses.json');

// public ディレクトリがない場合は作成
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

checker.init(
  {
    start: path.join(__dirname, '..'),
    production: true, // 本番依存のみ
    json: true,
  },
  (err, packages) => {
    if (err) {
      console.error('ライセンス情報の取得に失敗しました:', err);
      process.exit(1);
    }

    // 整形して出力
    const licenseInfo = Object.entries(packages).map(([name, info]) => ({
      name,
      version: info.version || 'unknown',
      license: info.licenses || 'unknown',
      repository: info.repository || '',
      publisher: info.publisher || '',
      url: info.url || '',
    }));

    fs.writeFileSync(outputFile, JSON.stringify(licenseInfo, null, 2));
    console.log(`ライセンス情報を ${outputFile} に出力しました (${licenseInfo.length} パッケージ)`);
  }
);

