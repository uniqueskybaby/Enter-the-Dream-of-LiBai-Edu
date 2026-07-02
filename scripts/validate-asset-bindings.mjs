import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const dataDir = path.join(appRoot, 'public', 'data');
const manifest = JSON.parse(readFileSync(path.join(dataDir, 'dreams_manifest.json'), 'utf8'));
const errors = [];
const panoramaUsage = new Map();

for (const entry of manifest) {
  const configPath = path.join(dataDir, `${entry.gameId}.json`);
  if (!existsSync(configPath)) {
    errors.push(`${entry.gameId}: config missing`);
    continue;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.gameId !== entry.gameId) errors.push(`${entry.gameId}: config gameId mismatch`);
  if (config.poem?.source !== entry.source) {
    errors.push(`${entry.gameId}: source mismatch manifest=${entry.source} config=${config.poem?.source || 'missing'}`);
  }

  const mainNode = (config.nodes || []).find((node) => node.type === 'panorama' && node.panoramaUrl)
    || (config.nodes || []).find((node) => node.panoramaUrl);
  if (!mainNode?.panoramaUrl) {
    errors.push(`${entry.gameId}: main panorama missing`);
    continue;
  }

  if (entry.coverUrl !== mainNode.panoramaUrl) {
    errors.push(`${entry.gameId}: coverUrl must equal main panorama (${entry.coverUrl} !== ${mainNode.panoramaUrl})`);
  }

  const assetPath = path.join(appRoot, 'public', mainNode.panoramaUrl.replace(/^\//, ''));
  if (!existsSync(assetPath)) errors.push(`${entry.gameId}: panorama file missing ${mainNode.panoramaUrl}`);
  if (!Array.isArray(mainNode.hotspots) || mainNode.hotspots.length !== 3) {
    errors.push(`${entry.gameId}: main hotspot count must be 3`);
  }
  if (!config.puzzles || Object.keys(config.puzzles).length !== 3 || !Array.isArray(config.puzzleOrder) || config.puzzleOrder.length !== 3) {
    errors.push(`${entry.gameId}: puzzle binding must have exactly 3 questions and 3 puzzleOrder items`);
  }

  const binding = config.meta?.assetBinding || config.world?.assetBinding;
  if (!binding?.panoramaUrl || binding.panoramaUrl !== mainNode.panoramaUrl) {
    errors.push(`${entry.gameId}: assetBinding.panoramaUrl missing or mismatched`);
  }
  if (!binding?.coverUrl || binding.coverUrl !== entry.coverUrl) {
    errors.push(`${entry.gameId}: assetBinding.coverUrl missing or mismatched`);
  }

  if (entry.origin === 'education-supplement') {
    const expected = `/assets/panoramas/${entry.gameId}_main.png`;
    if (mainNode.panoramaUrl !== expected) {
      errors.push(`${entry.gameId}: supplement panorama must be dedicated (${mainNode.panoramaUrl} !== ${expected})`);
    }
    if (binding.status !== 'dedicated') errors.push(`${entry.gameId}: supplement assetBinding.status must be dedicated`);
    if (binding.gameId !== entry.gameId) errors.push(`${entry.gameId}: assetBinding.gameId mismatch`);
    if (binding.generationMethod !== 'image_gen') {
      errors.push(`${entry.gameId}: supplement panorama must be generated with image_gen`);
    }
    if (!String(binding.generationPolicy || '').includes('no hand-drawn SVG')) {
      errors.push(`${entry.gameId}: supplement generationPolicy must prohibit vector/procedural placeholders`);
    }
  }

  const usage = panoramaUsage.get(mainNode.panoramaUrl) || [];
  usage.push(entry.gameId);
  panoramaUsage.set(mainNode.panoramaUrl, usage);
}

for (const [url, gameIds] of panoramaUsage) {
  if (gameIds.length > 1) errors.push(`duplicate main panorama ${url}: ${gameIds.join(', ')}`);
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  poems: manifest.length,
  uniqueMainPanoramas: panoramaUsage.size,
  checked: ['config', 'manifest', 'coverUrl', 'main panorama', 'assetBinding', 'image_gen policy', 'hotspots', 'puzzles'],
}, null, 2));
