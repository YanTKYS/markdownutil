// vendor-manifest.test.js
// vendor/manifest.jsonを「MarkdownUtilが現在同梱している外部ライブラリとバージョンの正本」
// として、各vendor/配下・README.md・LICENSES/THIRD_PARTY_NOTICES.mdとの不一致を検出する。
// 将来vendor更新時に、1箇所だけ更新して他が古いままになる状態を検知するためのテスト。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('vendor/manifest.json', ROOT), 'utf8'));
const README = readFileSync(new URL('README.md', ROOT), 'utf8');
const NOTICES = readFileSync(new URL('LICENSES/THIRD_PARTY_NOTICES.md', ROOT), 'utf8');

const EXPECTED_IDS = ['anydoc', 'markdown-it', 'marp', 'docx'];

function libraryOf(id) {
  const lib = manifest.libraries.find((l) => l.id === id);
  assert.ok(lib, `vendor/manifest.jsonに${id}が無い`);
  return lib;
}

test('vendor/manifest.json: 管理対象の4ライブラリが揃っている', () => {
  assert.ok(Array.isArray(manifest.libraries));
  const ids = manifest.libraries.map((l) => l.id);
  for (const id of EXPECTED_IDS) {
    assert.ok(ids.includes(id), `manifestに${id}が無い`);
  }
  for (const lib of manifest.libraries) {
    assert.ok(lib.version && lib.version.trim() !== '', `${lib.id}のversionが空`);
    assert.ok(lib.path, `${lib.id}のpathが無い`);
    assert.ok(existsSync(new URL(lib.path + '/', ROOT)), `${lib.path} ディレクトリが存在しない`);
  }
});

for (const id of ['anydoc', 'markdown-it', 'docx']) {
  test(`vendor/manifest.json: ${id}はvendor配下のpackage.jsonとバージョンが一致する`, () => {
    const lib = libraryOf(id);
    const pkg = JSON.parse(readFileSync(new URL(`${lib.path}/package.json`, ROOT), 'utf8'));

    assert.equal(pkg.name, lib.npmPackage, `${id}: package.jsonの名前がmanifestのnpmPackageと不一致`);
    assert.equal(pkg.version, lib.version, `${id}: package.jsonのversionがmanifestと不一致`);
  });
}

test('vendor/manifest.json: marpはバンドル先頭のバージョン表記と一致する（package.jsonを持たないため）', () => {
  const lib = libraryOf('marp');
  const bundle = readFileSync(new URL(`${lib.path}/marp-core.bundle.mjs`, ROOT), 'utf8', { flag: 'r' });
  // ファイル全体を読まず先頭だけで足りるが、node:fsに範囲読み込みは無いためutf8で先頭を切り出す。
  const head = bundle.slice(0, 200);
  const m = head.match(/@marp-team\/marp-core \(v([\d.]+), MIT\)/);

  assert.ok(m, 'marp-core.bundle.mjs先頭にバージョン表記のコメントが無い');
  assert.equal(m[1], lib.version, 'marp-core.bundle.mjsのバージョンコメントがmanifestと不一致');
});

test('LICENSES/THIRD_PARTY_NOTICES.md: 各ライブラリのバージョン表記がmanifestと一致する', () => {
  for (const lib of manifest.libraries) {
    const section = NOTICES.split(new RegExp(`^## ${lib.npmPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))[1];
    assert.ok(section, `THIRD_PARTY_NOTICES.mdに"## ${lib.npmPackage}"の見出しが無い`);
    const versionLine = section.split(/^## /m)[0];
    assert.match(
      versionLine,
      new RegExp(`\\| バージョン \\| ${lib.version.replace(/\./g, '\\.')} \\|`),
      `${lib.id}: THIRD_PARTY_NOTICES.mdのバージョンがmanifestの${lib.version}と不一致`,
    );
  }
});

test('README.md: 同梱ライブラリの表がmanifestとバージョン一致する', () => {
  for (const lib of manifest.libraries) {
    const row = new RegExp(`\\| ${lib.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| ${lib.version.replace(/\./g, '\\.')} \\|`);
    assert.match(README, row, `README.mdの${lib.displayName}のバージョンがmanifestの${lib.version}と不一致`);
  }
});
