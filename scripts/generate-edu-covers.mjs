import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const dataDir = path.join(appRoot, 'public', 'data');
const manifestPath = path.join(dataDir, 'dreams_manifest.json');
const coverDir = path.join(appRoot, 'public', 'assets', 'edu-covers');

mkdirSync(coverDir, { recursive: true });

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const updatedManifest = manifest.map((entry, index) => {
  const configPath = path.join(dataDir, `${entry.gameId}.json`);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const coverPath = path.join(coverDir, `${entry.gameId}.svg`);
  writeFileSync(coverPath, buildCoverSvg(entry, config, index));
  return {
    ...entry,
    coverUrl: `/assets/edu-covers/${entry.gameId}.svg`,
  };
});

writeFileSync(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);
console.log(`[edu-covers] 已生成 ${updatedManifest.length} 张按诗境绑定的封面。`);

function buildCoverSvg(entry, config, index) {
  const poem = config.poem || {};
  const hotspots = getMainHotspots(config);
  const motifs = hotspots.length ? hotspots : splitText(entry.theme || config.world?.worldName || entry.source, 3);
  const palette = paletteFor(index, entry.source, motifs.join(''));
  const source = entry.source || poem.source || titleSuffix(entry.title);
  const author = poem.poet || authorFromTitle(entry.title);
  const line = entry.poemLine || poem.line || '';
  const worldName = entry.worldName || config.world?.worldName || '';
  const escapedSource = escapeXml(source);
  const escapedAuthor = escapeXml(author);
  const escapedLine = escapeXml(line);
  const escapedWorldName = escapeXml(worldName);
  const escapedMotifs = motifs.slice(0, 3).map(escapeXml);
  const mountainPath = mountainPathFor(index);
  const wavePath = wavePathFor(index);
  const stars = Array.from({ length: 22 }, (_, starIndex) => star(starIndex, index)).join('\n');
  const motifNodes = escapedMotifs
    .map((motif, motifIndex) => {
      const x = [156, 480, 804][motifIndex] || 480;
      const y = [318, 286, 330][motifIndex] || 316;
      const opacity = [0.95, 0.82, 0.74][motifIndex] || 0.78;
      return `
        <g transform="translate(${x} ${y})">
          <circle r="${62 - motifIndex * 5}" fill="${palette.orb}" opacity="${opacity}" filter="url(#softGlow)" />
          <circle r="${52 - motifIndex * 4}" fill="none" stroke="${palette.ink}" stroke-width="2" opacity="0.42" />
          <text text-anchor="middle" dominant-baseline="central" class="motif" fill="${palette.text}">${motif}</text>
        </g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${escapedSource} 封面">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.skyA}" />
      <stop offset="48%" stop-color="${palette.skyB}" />
      <stop offset="100%" stop-color="${palette.skyC}" />
    </linearGradient>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffdf2" />
      <stop offset="60%" stop-color="${palette.moon}" />
      <stop offset="100%" stop-color="${palette.moon}" stop-opacity="0" />
    </radialGradient>
    <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <style>
      text { font-family: "Noto Serif SC", "Songti SC", "STSong", serif; }
      .source { font-size: 58px; font-weight: 700; letter-spacing: 0; }
      .meta { font-size: 24px; font-weight: 600; letter-spacing: 0; }
      .line { font-size: 28px; font-weight: 600; letter-spacing: 0; }
      .world { font-size: 20px; font-weight: 600; letter-spacing: 0; }
      .motif { font-size: 25px; font-weight: 700; letter-spacing: 0; }
    </style>
  </defs>
  <rect width="960" height="540" fill="url(#sky)" />
  <rect width="960" height="540" fill="${palette.wash}" opacity="0.22" />
  <circle cx="${128 + (index % 4) * 42}" cy="${92 + (index % 3) * 18}" r="96" fill="url(#moon)" opacity="0.92" />
  ${stars}
  <path d="${mountainPath}" fill="${palette.mountain}" opacity="0.72" />
  <path d="${wavePath}" fill="none" stroke="${palette.water}" stroke-width="8" opacity="0.62" stroke-linecap="round" />
  <path d="${wavePathFor(index + 5)}" fill="none" stroke="${palette.ink}" stroke-width="3" opacity="0.28" stroke-linecap="round" />
  <path d="M42 430 C174 390 254 460 382 416 C500 376 636 452 918 388" fill="none" stroke="${palette.accent}" stroke-width="4" opacity="0.56" stroke-linecap="round" />
  ${motifNodes}
  <g transform="translate(58 62)">
    <text class="meta" fill="${palette.muted}">${escapedAuthor} · ${escapedWorldName}</text>
    <text y="76" class="source" fill="${palette.text}">${escapedSource}</text>
    <text y="130" class="line" fill="${palette.text}">${escapedLine}</text>
  </g>
  <g transform="translate(58 466)">
    <rect width="330" height="44" rx="22" fill="${palette.plate}" opacity="0.78" />
    <text x="24" y="29" class="world" fill="${palette.text}">诗境热点 · ${escapedMotifs.join(' · ')}</text>
  </g>
</svg>
`;
}

function getMainHotspots(config) {
  const node = (config.nodes || []).find((item) => Array.isArray(item.hotspots) && item.hotspots.length);
  return (node?.hotspots || [])
    .map((hotspot) => hotspot.label)
    .filter(Boolean)
    .slice(0, 3);
}

function paletteFor(index, source, motifKey) {
  const key = `${source}${motifKey}`;
  if (/月|夜|霜|婵娟|星|银河/.test(key)) {
    return {
      skyA: '#17223c',
      skyB: '#2f4d68',
      skyC: '#d1c7a3',
      wash: '#10243f',
      moon: '#f5ddb1',
      mountain: '#1f3443',
      water: '#b9d8e6',
      ink: '#f4dc9a',
      accent: '#f5c46f',
      orb: '#eff4ff',
      text: '#fff9e9',
      muted: '#e8d8af',
      plate: '#111a26',
    };
  }
  if (/黄河|长河|大漠|边|沙|瀑|庐山|泰山|高楼|山/.test(key)) {
    return {
      skyA: '#20364d',
      skyB: '#b98042',
      skyC: '#f3d8a6',
      wash: '#3d2b1a',
      moon: '#ffe8b6',
      mountain: '#293c2f',
      water: '#e9bd62',
      ink: '#47351e',
      accent: '#f6d274',
      orb: '#ffe0a3',
      text: '#fff8e8',
      muted: '#f4d99b',
      plate: '#231b12',
    };
  }
  if (/春|花|柳|草|莺|燕|西湖|江南/.test(key)) {
    return {
      skyA: '#3a5d54',
      skyB: '#88a970',
      skyC: '#f1d8a8',
      wash: '#d7e6bf',
      moon: '#fff6c4',
      mountain: '#375d4e',
      water: '#d9eab8',
      ink: '#2b5a4b',
      accent: '#ffd27d',
      orb: '#f6f5c3',
      text: '#fff9e9',
      muted: '#f4e6bd',
      plate: '#24392f',
    };
  }
  return [
    {
      skyA: '#173b45',
      skyB: '#547c86',
      skyC: '#f0d5a4',
      wash: '#e0f0ef',
      moon: '#fff0c2',
      mountain: '#27484e',
      water: '#bfe5e4',
      ink: '#1f3a40',
      accent: '#ffce7a',
      orb: '#ecf7f4',
      text: '#fff8e9',
      muted: '#f4dfb4',
      plate: '#1a2b2f',
    },
    {
      skyA: '#31283e',
      skyB: '#746083',
      skyC: '#f1c8a0',
      wash: '#f1d7da',
      moon: '#fff2c6',
      mountain: '#3a2d42',
      water: '#d9bddf',
      ink: '#f0d089',
      accent: '#f5b879',
      orb: '#f6e7ff',
      text: '#fff9ed',
      muted: '#f3d9b7',
      plate: '#261e30',
    },
  ][index % 2];
}

function mountainPathFor(index) {
  const offset = (index % 5) * 8;
  return `M0 410 L0 324 C68 292 94 260 142 286 C194 236 234 254 292 312 C360 238 420 238 494 322 C560 272 610 286 660 330 C730 260 806 246 960 330 L960 540 L0 540 Z`;
}

function wavePathFor(index) {
  const lift = (index % 4) * 6;
  return `M40 ${382 - lift} C178 ${338 + lift} 262 ${414 - lift} 408 ${366 + lift} C540 ${322 - lift} 626 ${404 + lift} 916 ${344 - lift}`;
}

function star(starIndex, seed) {
  const x = 58 + ((starIndex * 73 + seed * 37) % 852);
  const y = 32 + ((starIndex * 41 + seed * 29) % 174);
  const r = 1.2 + ((starIndex + seed) % 3) * 0.7;
  const opacity = 0.25 + ((starIndex + seed) % 5) * 0.12;
  return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="#fff7d8" opacity="${opacity.toFixed(2)}" />`;
}

function splitText(value, max) {
  return String(value || '')
    .split(/[、，·\s]+/)
    .filter(Boolean)
    .slice(0, max);
}

function titleSuffix(title) {
  return String(title || '').split('：').pop() || title;
}

function authorFromTitle(title) {
  const match = String(title || '').match(/^入梦([^：]+)：/);
  return match ? match[1] : '诗人';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
