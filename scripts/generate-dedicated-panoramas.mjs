import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supplementalWorldGuides } from '../server/supplemental-guides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, 'public', 'assets', 'panoramas');
const width = Number(process.env.EDU_PANORAMA_WIDTH || 4096);
const height = Math.floor(width / 2);

mkdirSync(outDir, { recursive: true });

function main() {
  for (const guide of supplementalWorldGuides) {
    const scene = sceneForGuide(guide);
    const filePath = path.join(outDir, `${guide.gameId}_main.png`);
    const image = renderPanorama(scene, guide);
    writeFileSync(filePath, encodePng(width, height, image));
    console.log(`[panorama] ${guide.source} -> ${path.relative(appRoot, filePath)}`);
  }
}

function renderPanorama(scene, guide) {
  const data = Buffer.alloc(width * height * 4);
  const seed = seedFrom(guide.gameId);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let color = baseColor(scene, u, v, seed);
      color = applyMountains(color, scene, u, v, seed);
      color = applyGroundOrWater(color, scene, u, v, seed);
      color = applyAtmosphere(color, scene, u, v, seed);
      setPixel(data, x, y, color);
    }
  }
  drawSceneObjects(data, scene, guide);
  return data;
}

function sceneForGuide(guide) {
  const key = guide.source;
  const base = {
    key,
    title: guide.source,
    tone: guide.visualTone,
    motifs: guide.hotspots,
    sky: ['#14213d', '#3f5f78', '#f2cf91'],
    ground: '#304f42',
    water: '#356f8f',
    mountain: '#243c48',
    mist: '#dce4df',
    accent: '#f4d06f',
    night: false,
    moon: false,
    sun: false,
    waterMode: 'river',
    terrain: 'mountain',
    features: [],
  };
  const table = {
    静夜思: { sky: ['#071225', '#1d3150', '#c6c7ca'], night: true, moon: true, terrain: 'courtyard', waterMode: 'floor', features: ['window', 'frost', 'village'] },
    古朗月行: { sky: ['#102142', '#4b6fa1', '#f7dba0'], night: true, moon: true, terrain: 'cloud', waterMode: 'cloud', features: ['jadeMoon', 'cloudMirror'] },
    春晓: { sky: ['#5f8e85', '#b4c77f', '#f5d9a8'], ground: '#567a45', terrain: 'garden', waterMode: 'grass', features: ['birds', 'rain', 'flowers'] },
    登鹳雀楼: { sky: ['#26364b', '#c77d38', '#ffd690'], sun: true, terrain: 'riverTower', waterMode: 'river', features: ['tower', 'yellowRiver'] },
    凉州词: { sky: ['#24344d', '#b6793e', '#e7c285'], terrain: 'desertPass', waterMode: 'sand', features: ['loneCity', 'fluteWind'] },
    使至塞上: { sky: ['#20324d', '#bb7840', '#f0c171'], sun: true, terrain: 'desert', waterMode: 'sand', features: ['straightSmoke', 'longRiver'] },
    山居秋暝: { sky: ['#10213a', '#365b63', '#d2c7a1'], night: true, moon: true, terrain: 'pineMountain', waterMode: 'stream', features: ['pines', 'springStream'] },
    鹿柴: { sky: ['#13271f', '#355642', '#d8ba74'], terrain: 'forest', waterMode: 'moss', features: ['deepForest', 'lightBeam', 'moss'] },
    送元二使安西: { sky: ['#53636d', '#9ba995', '#e1c58f'], terrain: 'rainInn', waterMode: 'road', features: ['willow', 'inn', 'rain'] },
    望岳: { sky: ['#182c42', '#53718a', '#e8c88d'], terrain: 'highPeak', waterMode: 'cloud', features: ['taishanPeak', 'birds'] },
    春望: { sky: ['#58665e', '#9fa77d', '#e2c28e'], terrain: 'ruinedCity', waterMode: 'grass', features: ['cityWall', 'flowers', 'beacon'] },
    绝句: { sky: ['#3e75a0', '#8fc0d1', '#f7d79d'], terrain: 'riverGarden', waterMode: 'river', features: ['willow', 'orioles', 'egrets', 'boat', 'snowRidge'] },
    赋得古原草送别: { sky: ['#315b66', '#88a76a', '#edd39a'], terrain: 'grassland', waterMode: 'grass', features: ['wildfire', 'oldRoad', 'springWind'] },
    钱塘湖春行: { sky: ['#5b87a0', '#afd1c7', '#f1d6a2'], terrain: 'lakeSpring', waterMode: 'lake', features: ['orioles', 'swallows', 'flowers', 'shallowGrass'] },
    江雪: { sky: ['#aebdca', '#d7e0e6', '#f4f2e8'], ground: '#e8eef1', terrain: 'snowRiver', waterMode: 'coldRiver', features: ['snow', 'loneBoat'] },
    枫桥夜泊: { sky: ['#061121', '#1d3146', '#7d6c5a'], night: true, moon: true, terrain: 'nightRiver', waterMode: 'river', features: ['maple', 'temple', 'boat', 'bells'] },
    泊船瓜洲: { sky: ['#1b3150', '#5e8c9c', '#e6c48e'], night: true, moon: true, terrain: 'springRiver', waterMode: 'river', features: ['greenBank', 'boat', 'moonRoad'] },
    题西林壁: { sky: ['#34495d', '#879d9b', '#e3c997'], terrain: 'multiPeaks', waterMode: 'mist', features: ['layeredPeaks', 'cloudMist'] },
    饮湖上初晴后雨: { sky: ['#4d7388', '#a2beb6', '#e8cfa2'], terrain: 'westLake', waterMode: 'lake', features: ['rainMist', 'lakeLight', 'distantHill'] },
    水调歌头: { sky: ['#071124', '#253e65', '#c4b687'], night: true, moon: true, terrain: 'moonPalace', waterMode: 'cloud', features: ['greatMoon', 'palaceCloud', 'wineCup'] },
    游山西村: { sky: ['#4f7c72', '#9dbb78', '#ebd19c'], terrain: 'villagePath', waterMode: 'field', features: ['village', 'willow', 'flowers', 'windingPath'] },
    '破阵子·为陈同甫赋壮词以寄之': { sky: ['#172137', '#674d3a', '#c08c55'], terrain: 'battlefield', waterMode: 'earth', features: ['campFlags', 'sword', 'torches'] },
    '西江月·夜行黄沙道中': { sky: ['#081426', '#243d55', '#a9976a'], night: true, moon: true, terrain: 'ruralNight', waterMode: 'field', features: ['magpies', 'rice', 'frogs', 'lightRain'] },
    观沧海: { sky: ['#071225', '#18435e', '#b88b57'], night: false, sun: true, terrain: 'openSea', waterMode: 'sea', features: ['islands', 'waves', 'stars'] },
    敕勒歌: { sky: ['#386d92', '#8ab8c7', '#e6d69c'], terrain: 'grassDome', waterMode: 'grass', features: ['skyDome', 'sheep', 'windGrass'] },
  };
  return { ...base, ...(table[key] || {}) };
}

function baseColor(scene, u, v, seed) {
  const skyT = clamp(v / 0.64, 0, 1);
  let color = mixColor(hex(scene.sky[0]), hex(scene.sky[1]), smoothstep(0, 0.72, skyT));
  color = mixColor(color, hex(scene.sky[2]), smoothstep(0.5, 1, skyT) * 0.48);
  if (scene.night) {
    const glow = radial(u, v, 0.24, 0.18, 0.32) + radial(u, v, 0.76, 0.22, 0.25) * 0.35;
    color = mixColor(color, hex('#f2e4b3'), glow * 0.32);
  }
  const grain = (noise(u * 18 + seed, v * 18 - seed) - 0.5) * 8;
  return addColor(color, grain);
}

function applyMountains(color, scene, u, v, seed) {
  const p1 = 0.48 + periodicNoise(u, seed, 1.4) * 0.12;
  const p2 = 0.56 + periodicNoise(u + 0.17, seed + 9, 2.2) * 0.09;
  if (v > p1 && v < 0.78) color = mixColor(color, hex(scene.mountain), 0.58);
  if (v > p2 && v < 0.82) color = mixColor(color, addColor(hex(scene.mountain), -20), 0.64);
  if (scene.terrain.includes('desert') && v > 0.55) color = mixColor(color, hex('#b98a4d'), 0.38);
  if (scene.terrain.includes('snow') && v > p1) color = mixColor(color, hex('#e9eef1'), 0.78);
  if (scene.terrain.includes('forest') && v > 0.42) color = mixColor(color, hex('#203c2c'), 0.5);
  return color;
}

function applyGroundOrWater(color, scene, u, v, seed) {
  if (v < 0.62) return color;
  const wave = Math.sin((u * Math.PI * 2) * 7 + seed) * 0.012 + Math.sin((u * Math.PI * 2) * 17) * 0.005;
  const t = clamp((v - 0.62) / 0.38, 0, 1);
  let base = hex(scene.water);
  if (['grass', 'field', 'moss'].includes(scene.waterMode)) base = hex(scene.ground);
  if (['sand', 'earth', 'road'].includes(scene.waterMode)) base = hex('#a87946');
  if (scene.waterMode === 'cloud' || scene.waterMode === 'mist') base = hex('#c6d4d6');
  if (scene.waterMode === 'coldRiver') base = hex('#8faab6');
  let mixed = mixColor(base, addColor(base, scene.night ? -38 : -18), t);
  if (['river', 'lake', 'sea', 'stream', 'coldRiver'].includes(scene.waterMode)) {
    const shine = Math.max(0, 1 - Math.abs(u - 0.5) * 3.2) * Math.max(0, 1 - Math.abs(v - 0.72 + wave) * 12);
    mixed = mixColor(mixed, hex(scene.accent), shine * 0.35);
  }
  if (scene.waterMode === 'grass' || scene.waterMode === 'field') {
    const grass = Math.max(0, Math.sin((u * 128 + seed) * Math.PI) * 0.5 + 0.5) * (v > 0.72 ? 0.16 : 0.05);
    mixed = mixColor(mixed, hex('#c5d37b'), grass);
  }
  return mixColor(color, mixed, 0.92);
}

function applyAtmosphere(color, scene, u, v, seed) {
  if (scene.night && v < 0.5) {
    const star = starNoise(u, v, seed);
    color = mixColor(color, hex('#fff7d4'), star);
  }
  const mist = Math.max(0, 1 - Math.abs(v - 0.58) * 10) * (0.12 + noise(u * 8, seed) * 0.08);
  color = mixColor(color, hex(scene.mist), mist);
  return color;
}

function drawSceneObjects(data, scene, guide) {
  if (scene.moon) drawMoon(data, scene.key === '水调歌头' ? 0.28 : 0.22, scene.key === '古朗月行' ? 0.18 : 0.2, scene.key === '水调歌头' ? 92 : 70);
  if (scene.sun) drawSun(data, scene.key === '登鹳雀楼' ? 0.22 : 0.78, 0.24, 74);
  for (const feature of scene.features) drawFeature(data, feature, scene, guide);
  drawSubtleVignette(data);
}

function drawFeature(data, feature, scene) {
  switch (feature) {
    case 'window':
      drawRect(data, 390, 575, 520, 410, '#1a1d22', 0.62);
      drawRect(data, 440, 620, 420, 310, '#d9e3ee', 0.2);
      drawLine(data, 650, 590, 650, 980, '#d8c08f', 4, 0.7);
      break;
    case 'frost':
      for (let i = 0; i < 34; i += 1) drawLine(data, 200 + i * 100, 1500 + (i % 5) * 18, 340 + i * 100, 1518 + (i % 7) * 10, '#e9edf1', 2, 0.48);
      break;
    case 'village':
      drawVillage(data, 0.62, 0.63);
      break;
    case 'jadeMoon':
      drawCircle(data, 2750, 360, 140, '#fff8d8', 0.92);
      drawCircle(data, 2750, 360, 178, '#b9d9ff', 0.12);
      break;
    case 'cloudMirror':
      drawEllipse(data, 2750, 770, 260, 40, '#dfe8f1', 0.42);
      break;
    case 'birds':
    case 'orioles':
      drawBirds(data, feature === 'orioles' ? '#ffd14d' : '#1f2b2b', 11, 0.33);
      break;
    case 'egrets':
      drawBirds(data, '#edf6ff', 9, 0.25, 0.62);
      break;
    case 'rain':
    case 'lightRain':
      drawRain(data, feature === 'lightRain' ? 80 : 150);
      break;
    case 'flowers':
      drawFlowers(data, '#e78c91');
      break;
    case 'tower':
      drawTower(data, 3040, 1120, 230, 540);
      break;
    case 'yellowRiver':
    case 'longRiver':
      drawRiverRibbon(data, '#e5b05a');
      break;
    case 'loneCity':
      drawCityGate(data, 2850, 1160, '#6b5438');
      break;
    case 'fluteWind':
    case 'springWind':
      drawWind(data);
      break;
    case 'straightSmoke':
      drawSmokeColumn(data, 2480, 1040);
      break;
    case 'pines':
    case 'deepForest':
      drawPines(data, feature === 'deepForest' ? 26 : 14);
      break;
    case 'springStream':
      drawStream(data);
      break;
    case 'lightBeam':
      drawLightBeam(data);
      break;
    case 'moss':
      drawMoss(data);
      break;
    case 'willow':
      drawWillow(data, 620, 1120);
      drawWillow(data, 3480, 1140);
      break;
    case 'inn':
      drawHouse(data, 2860, 1200, '#7e5a36');
      break;
    case 'taishanPeak':
      drawPeak(data);
      break;
    case 'cityWall':
      drawCityWall(data);
      break;
    case 'beacon':
      drawSmokeColumn(data, 3300, 1060, '#3c3028');
      break;
    case 'boat':
      drawBoat(data, 2920, 1450, 180, '#2b2620');
      break;
    case 'snowRidge':
      drawSnowRidge(data);
      break;
    case 'wildfire':
      drawWildfire(data);
      break;
    case 'oldRoad':
    case 'windingPath':
      drawPath(data);
      break;
    case 'swallows':
      drawBirds(data, '#27342e', 8, 0.31, 0.72);
      break;
    case 'shallowGrass':
    case 'windGrass':
      drawGrass(data);
      break;
    case 'snow':
      drawSnow(data);
      break;
    case 'loneBoat':
      drawBoat(data, 2048, 1430, 230, '#2a2c2f');
      drawLine(data, 2048, 1300, 2048, 1440, '#202326', 5, 0.9);
      break;
    case 'maple':
      drawMaple(data);
      break;
    case 'temple':
      drawTemple(data, 3060, 1160);
      break;
    case 'bells':
      drawCircle(data, 3100, 1030, 24, '#d8b46b', 0.68);
      break;
    case 'greenBank':
      drawGrass(data, '#8ac46a');
      break;
    case 'moonRoad':
      drawRiverRibbon(data, '#d9d8b4', 0.28);
      break;
    case 'layeredPeaks':
      drawPeak(data, 0.48);
      drawPeak(data, 0.72);
      break;
    case 'cloudMist':
    case 'rainMist':
      drawMistBands(data);
      break;
    case 'lakeLight':
      drawRiverRibbon(data, '#f4d59b', 0.22);
      break;
    case 'distantHill':
      drawLine(data, 0, 1040, 4095, 1060, '#49685e', 8, 0.32);
      break;
    case 'greatMoon':
      drawMoon(data, 0.5, 0.18, 135);
      break;
    case 'palaceCloud':
      drawTemple(data, 2048, 830, 0.68);
      break;
    case 'wineCup':
      drawCup(data, 840, 1410);
      break;
    case 'campFlags':
      drawFlags(data);
      break;
    case 'sword':
      drawLine(data, 2450, 1320, 2800, 980, '#d9d2c2', 9, 0.75);
      drawLine(data, 2470, 1300, 2560, 1390, '#9a7040', 7, 0.8);
      break;
    case 'torches':
      for (const x of [700, 1120, 3150, 3500]) drawTorch(data, x, 1360);
      break;
    case 'magpies':
      drawBirds(data, '#eef1f0', 5, 0.22, 0.36);
      break;
    case 'rice':
      drawRiceFields(data);
      break;
    case 'frogs':
      drawEllipse(data, 3140, 1560, 52, 22, '#567f43', 0.8);
      drawEllipse(data, 880, 1610, 46, 18, '#567f43', 0.8);
      break;
    case 'islands':
      drawIslands(data);
      break;
    case 'waves':
      drawWaves(data);
      break;
    case 'stars':
      drawStars(data);
      break;
    case 'skyDome':
      drawDome(data);
      break;
    case 'sheep':
      drawSheep(data);
      break;
  }
}

function drawMoon(data, ux, vy, r) {
  const cx = Math.floor(width * ux);
  const cy = Math.floor(height * vy);
  drawCircle(data, cx, cy, r * 2.6, '#f5e7bd', 0.08);
  drawCircle(data, cx, cy, r, '#fff7d5', 0.94);
  drawCircle(data, cx + r * 0.28, cy - r * 0.12, r * 0.18, '#d7cba5', 0.18);
  drawCircle(data, cx - r * 0.18, cy + r * 0.22, r * 0.12, '#d7cba5', 0.16);
}

function drawSun(data, ux, vy, r) {
  const cx = Math.floor(width * ux);
  const cy = Math.floor(height * vy);
  drawCircle(data, cx, cy, r * 2.2, '#ffb866', 0.12);
  drawCircle(data, cx, cy, r, '#ffd486', 0.9);
}

function drawVillage(data, ux, vy) {
  for (let i = 0; i < 6; i += 1) drawHouse(data, Math.floor(width * (ux + (i - 3) * 0.03)), Math.floor(height * (vy + (i % 2) * 0.02)), '#45382a');
}

function drawHouse(data, x, y, color = '#3b3025') {
  drawRect(data, x - 70, y - 70, 140, 85, color, 0.75);
  drawTriangle(data, x - 92, y - 70, x, y - 145, x + 92, y - 70, '#28231e', 0.82);
}

function drawTower(data, x, y, w, h) {
  for (let i = 0; i < 4; i += 1) {
    const yy = y - i * h * 0.22;
    const ww = w * (1 - i * 0.12);
    drawRect(data, x - ww / 2, yy - 46, ww, 58, '#46311f', 0.86);
    drawTriangle(data, x - ww * 0.62, yy - 46, x, yy - 92, x + ww * 0.62, yy - 46, '#2b221b', 0.9);
  }
  drawRect(data, x - 34, y - h * 0.88, 68, h * 0.88, '#3a2b21', 0.86);
}

function drawCityGate(data, x, y, color) {
  drawRect(data, x - 210, y - 150, 420, 155, color, 0.8);
  drawRect(data, x - 55, y - 92, 110, 96, '#272018', 0.7);
  drawTriangle(data, x - 260, y - 150, x, y - 235, x + 260, y - 150, '#392d21', 0.9);
}

function drawCityWall(data) {
  drawRect(data, 250, 1250, 1200, 110, '#625341', 0.65);
  for (let x = 270; x < 1450; x += 110) drawRect(data, x, 1210, 58, 45, '#574737', 0.72);
}

function drawTemple(data, x, y, scale = 1) {
  drawRect(data, x - 120 * scale, y - 80 * scale, 240 * scale, 95 * scale, '#463524', 0.75);
  drawTriangle(data, x - 170 * scale, y - 80 * scale, x, y - 155 * scale, x + 170 * scale, y - 80 * scale, '#2d241b', 0.86);
  drawRect(data, x - 26 * scale, y - 40 * scale, 52 * scale, 55 * scale, '#191713', 0.62);
}

function drawPeak(data, ux = 0.52) {
  const x = width * ux;
  drawTriangle(data, x - 760, 1510, x, 540, x + 740, 1510, '#202d33', 0.72);
  drawTriangle(data, x - 230, 830, x, 540, x + 210, 850, '#d7e1e0', 0.38);
}

function drawPines(data, count) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(((i * 377) % width));
    const y = 1260 + (i % 5) * 65;
    drawLine(data, x, y - 250, x, y + 120, '#1b241d', 10, 0.78);
    for (let j = 0; j < 4; j += 1) {
      drawTriangle(data, x - 80 + j * 10, y - 190 + j * 62, x, y - 320 + j * 55, x + 80 - j * 10, y - 190 + j * 62, '#203c2b', 0.75);
    }
  }
}

function drawWillow(data, x, y) {
  drawLine(data, x, y - 350, x - 30, y + 150, '#3c3423', 14, 0.82);
  for (let i = -8; i <= 8; i += 1) {
    drawLine(data, x, y - 320 + Math.abs(i) * 10, x + i * 34, y + 100 + (i % 3) * 30, '#89b46a', 5, 0.58);
  }
}

function drawMaple(data) {
  drawLine(data, 620, 950, 570, 1520, '#35241c', 16, 0.82);
  for (let i = 0; i < 80; i += 1) drawCircle(data, 500 + (i * 37) % 300, 860 + (i * 53) % 260, 14 + (i % 4) * 3, '#b94b37', 0.58);
}

function drawBoat(data, x, y, size, color) {
  drawEllipse(data, x, y, size, size * 0.18, color, 0.86);
  drawTriangle(data, x - size * 0.25, y - size * 0.14, x + size * 0.1, y - size * 0.72, x + size * 0.18, y - size * 0.12, '#ded8c6', 0.7);
}

function drawCup(data, x, y) {
  drawEllipse(data, x, y, 70, 24, '#d6c49a', 0.82);
  drawRect(data, x - 54, y, 108, 70, '#9b7650', 0.68);
  drawEllipse(data, x, y + 70, 42, 12, '#6c5138', 0.72);
}

function drawSmokeColumn(data, x, y, color = '#ebe0c9') {
  for (let i = 0; i < 13; i += 1) drawCircle(data, x + Math.sin(i * 0.8) * 34, y - i * 70, 32 + i * 5, color, 0.09);
  drawLine(data, x, y, x + 30, y - 780, color, 9, 0.36);
}

function drawTorch(data, x, y) {
  drawLine(data, x, y - 100, x, y + 90, '#37271d', 8, 0.82);
  drawCircle(data, x, y - 120, 34, '#ffb34e', 0.75);
  drawCircle(data, x, y - 135, 20, '#ffe28a', 0.8);
}

function drawFlags(data) {
  for (const [x, y] of [[720, 1130], [1120, 1060], [3330, 1110], [3600, 1020]]) {
    drawLine(data, x, y - 230, x, y + 190, '#2a211b', 9, 0.9);
    drawTriangle(data, x, y - 230, x + 190, y - 180, x, y - 118, '#77342e', 0.8);
  }
}

function drawRiverRibbon(data, color, opacity = 0.35) {
  for (let i = 0; i < 7; i += 1) {
    const y = 1320 + i * 74;
    drawSineLine(data, y, 80 + i * 8, color, 4, opacity * (1 - i * 0.08));
  }
}

function drawStream(data) {
  drawSineLine(data, 1360, 120, '#c6e5e5', 8, 0.45);
  drawSineLine(data, 1480, 80, '#e8f7f1', 4, 0.32);
}

function drawWind(data) {
  for (let i = 0; i < 5; i += 1) drawSineLine(data, 710 + i * 120, 60 + i * 16, '#e6d6a4', 3, 0.25);
}

function drawPath(data) {
  drawTriangle(data, 1700, 2047, 2070, 1130, 2390, 2047, '#c2a16b', 0.34);
  drawSineLine(data, 1500, 210, '#d7bf82', 8, 0.28);
}

function drawWildfire(data) {
  for (let x = 500; x < 3600; x += 80) {
    const y = 1450 + Math.sin(x * 0.01) * 45;
    drawCircle(data, x, y, 22, '#ffb548', 0.55);
    drawCircle(data, x + 14, y - 22, 16, '#e05b2e', 0.45);
  }
}

function drawRiceFields(data) {
  for (let i = 0; i < 12; i += 1) drawSineLine(data, 1320 + i * 52, 24, '#b8ca66', 3, 0.28);
}

function drawGrass(data, color = '#9bbd68') {
  for (let i = 0; i < 520; i += 1) {
    const x = (i * 97) % width;
    const y = 1510 + (i * 53) % 470;
    drawLine(data, x, y, x + ((i % 7) - 3) * 4, y - 28 - (i % 12), color, 2, 0.38);
  }
}

function drawMoss(data) {
  for (let i = 0; i < 140; i += 1) drawEllipse(data, (i * 157) % width, 1500 + (i * 37) % 390, 38, 12, '#6c8b54', 0.28);
}

function drawFlowers(data, color) {
  for (let i = 0; i < 170; i += 1) {
    const x = (i * 211) % width;
    const y = 1380 + (i * 89) % 520;
    drawCircle(data, x, y, 8 + (i % 3) * 2, color, 0.5);
  }
}

function drawBirds(data, color, count, yBase = 0.28, xBase = 0.5) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(width * (xBase + (i - count / 2) * 0.032 + Math.sin(i) * 0.015));
    const y = Math.floor(height * (yBase + Math.cos(i * 1.7) * 0.035));
    drawLine(data, x - 24, y, x, y - 13, color, 4, 0.72);
    drawLine(data, x, y - 13, x + 24, y, color, 4, 0.72);
  }
}

function drawRain(data, count) {
  for (let i = 0; i < count; i += 1) {
    const x = (i * 131) % width;
    const y = (i * 283) % height;
    drawLine(data, x, y, x - 22, y + 72, '#d8e5e5', 2, 0.18);
  }
}

function drawSnow(data) {
  for (let i = 0; i < 480; i += 1) drawCircle(data, (i * 113) % width, (i * 229) % height, 2 + (i % 4), '#fffdf4', 0.45);
}

function drawMistBands(data) {
  for (let i = 0; i < 6; i += 1) drawSineLine(data, 850 + i * 115, 120, '#e3e8df', 12, 0.12);
}

function drawLightBeam(data) {
  drawTriangle(data, 2520, 420, 2280, 1380, 2940, 1360, '#f4d99a', 0.12);
}

function drawSnowRidge(data) {
  drawTriangle(data, 760, 980, 1180, 520, 1580, 980, '#dfe8ed', 0.42);
}

function drawIslands(data) {
  for (const x of [660, 3020]) drawTriangle(data, x - 280, 1090, x, 840, x + 330, 1090, '#283b3f', 0.68);
}

function drawWaves(data) {
  for (let i = 0; i < 12; i += 1) drawSineLine(data, 1180 + i * 70, 30, '#c3e1e3', 3, 0.22);
}

function drawStars(data) {
  for (let i = 0; i < 110; i += 1) drawCircle(data, (i * 173) % width, 110 + (i * 229) % 530, 2 + (i % 3), '#fff6d7', 0.45);
}

function drawDome(data) {
  drawEllipse(data, width / 2, 900, 1600, 520, '#c9dfdb', 0.12);
}

function drawSheep(data) {
  for (let i = 0; i < 20; i += 1) {
    const x = 480 + (i * 173) % 3100;
    const y = 1420 + (i * 47) % 380;
    drawEllipse(data, x, y, 38, 20, '#f0ead8', 0.72);
    drawCircle(data, x + 36, y - 6, 12, '#4c4036', 0.7);
  }
}

function drawSineLine(data, y, amp, color, thickness, opacity) {
  let last = null;
  for (let x = 0; x <= width; x += 14) {
    const yy = y + Math.sin((x / width) * Math.PI * 2 * 2.0) * amp * 0.55 + Math.sin((x / width) * Math.PI * 2 * 5.0) * amp * 0.2;
    if (last) drawLine(data, last.x, last.y, x, yy, color, thickness, opacity);
    last = { x, y: yy };
  }
}

function drawSubtleVignette(data) {
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const edge = Math.max(0, Math.abs(u - 0.5) * 1.55 - 0.45) + Math.max(0, Math.abs(v - 0.5) * 1.5 - 0.35);
      if (edge > 0) blendPixel(data, x, y, [0, 0, 0], Math.min(0.22, edge * 0.18));
    }
  }
}

function drawCircle(data, cx, cy, r, color, opacity) {
  const [cr, cg, cb] = hex(color);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(width - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= rr) blendPixel(data, x, y, [cr, cg, cb], opacity * smoothstep(1, 0.78, d / rr));
    }
  }
}

function drawEllipse(data, cx, cy, rx, ry, color, opacity) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) blendPixel(data, x, y, hex(color), opacity * smoothstep(1, 0.78, d));
    }
  }
}

function drawRect(data, x, y, w, h, color, opacity) {
  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(width - 1, Math.ceil(x + w));
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(height - 1, Math.ceil(y + h));
  const rgb = hex(color);
  for (let yy = y0; yy <= y1; yy += 1) for (let xx = x0; xx <= x1; xx += 1) blendPixel(data, xx, yy, rgb, opacity);
}

function drawTriangle(data, x1, y1, x2, y2, x3, y3, color, opacity) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2, x3)));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2, y3)));
  const rgb = hex(color);
  const area = edge(x1, y1, x2, y2, x3, y3);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = edge(x2, y2, x3, y3, x, y);
      const w2 = edge(x3, y3, x1, y1, x, y);
      const w3 = edge(x1, y1, x2, y2, x, y);
      if ((area >= 0 && w1 >= 0 && w2 >= 0 && w3 >= 0) || (area < 0 && w1 <= 0 && w2 <= 0 && w3 <= 0)) {
        blendPixel(data, x, y, rgb, opacity);
      }
    }
  }
}

function drawLine(data, x1, y1, x2, y2, color, thickness, opacity) {
  const rgb = hex(color);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i += 1) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    drawCircle(data, x, y, thickness, color, opacity);
  }
}

function edge(ax, ay, bx, by, cx, cy) {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function setPixel(data, x, y, [r, g, b]) {
  const idx = (y * width + x) * 4;
  data[idx] = clampByte(r);
  data[idx + 1] = clampByte(g);
  data[idx + 2] = clampByte(b);
  data[idx + 3] = 255;
}

function blendPixel(data, x, y, [r, g, b], opacity) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= width || y < 0 || y >= height || opacity <= 0) return;
  const idx = (y * width + x) * 4;
  const a = clamp(opacity, 0, 1);
  data[idx] = clampByte(data[idx] * (1 - a) + r * a);
  data[idx + 1] = clampByte(data[idx + 1] * (1 - a) + g * a);
  data[idx + 2] = clampByte(data[idx + 2] * (1 - a) + b * a);
}

function encodePng(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr(w, h)),
    chunk('IDAT', deflateSync(raw, { level: 7 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ihdr(w, h) {
  const out = Buffer.alloc(13);
  out.writeUInt32BE(w, 0);
  out.writeUInt32BE(h, 4);
  out[8] = 8;
  out[9] = 6;
  return out;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function hex(value) {
  const m = String(value).replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function mixColor(a, b, t) {
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}

function addColor(a, amount) {
  return [a[0] + amount, a[1] + amount, a[2] + amount];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function radial(u, v, cx, cy, r) {
  const dx = Math.min(Math.abs(u - cx), 1 - Math.abs(u - cx));
  const dy = v - cy;
  return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / r);
}

function noise(x, y) {
  return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
}

function periodicNoise(u, seed, freq) {
  const a = Math.sin(Math.PI * 2 * u * freq + seed) * 0.6;
  const b = Math.sin(Math.PI * 2 * u * (freq * 2.1) + seed * 0.37) * 0.3;
  const c = Math.sin(Math.PI * 2 * u * (freq * 3.7) + seed * 1.7) * 0.1;
  return a + b + c;
}

function starNoise(u, v, seed) {
  const cellX = Math.floor(u * 280);
  const cellY = Math.floor(v * 90);
  const n = noise(cellX + seed, cellY - seed);
  if (n > 0.992 && v < 0.45) return 0.65;
  if (n > 0.985 && v < 0.38) return 0.34;
  return 0;
}

function fract(value) {
  return value - Math.floor(value);
}

function seedFrom(value) {
  return Number.parseInt(createHash('sha1').update(value).digest('hex').slice(0, 6), 16) / 1000;
}

main();
