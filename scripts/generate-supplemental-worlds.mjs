import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supplementalWorldGuides } from '../server/supplemental-guides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const dataDir = path.join(appRoot, 'public', 'data');
const manifestPath = path.join(dataDir, 'dreams_manifest.json');
const savedAt = '2026-07-01T00:00:00.000Z';
const safeHotspotYaw = [-52, 12, 96];
const safeHotspotPitch = [18, -12, 14];

const existingManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const supplementalIds = new Set(supplementalWorldGuides.map((guide) => guide.gameId));
const baseManifest = existingManifest.filter((entry) => entry.origin !== 'education-supplement' && !supplementalIds.has(entry.gameId));

for (const guide of supplementalWorldGuides) {
  if (!existsSync(path.join(appRoot, 'public', guide.panoramaUrl.replace(/^\//, '')))) {
    throw new Error(`缺少全景素材: ${guide.panoramaUrl}`);
  }
  const configPath = path.join(dataDir, `${guide.gameId}.json`);
  writeFileSync(configPath, `${JSON.stringify(buildWorldConfig(guide), null, 2)}\n`);
}

const supplementalManifest = supplementalWorldGuides.map((guide) => ({
  gameId: guide.gameId,
  title: guide.title,
  poemLine: guide.line,
  source: guide.source,
  worldName: guide.worldName,
  configUrl: `/data/${guide.gameId}.json`,
  coverUrl: `/assets/edu-covers/${guide.gameId}.svg`,
  theme: guide.themeLabel,
  origin: 'education-supplement',
  savedAt,
}));

writeFileSync(manifestPath, `${JSON.stringify([...baseManifest, ...supplementalManifest], null, 2)}\n`);

console.log(`[supplemental-worlds] 已生成 ${supplementalWorldGuides.length} 个教育版补充诗境。`);

function buildWorldConfig(guide) {
  const hotspotIds = guide.hotspots.map((label, index) => slug(`${guide.gameId}_${label}_${index + 1}`));
  const hotspotConfigs = guide.hotspots.map((label, index) => ({
    id: hotspotIds[index],
    label,
    yaw: safeHotspotYaw[index],
    pitch: safeHotspotPitch[index],
    radius: index === 1 ? 20 : 18,
    state: 'available',
    storyId: `story_${hotspotIds[index]}_locked`,
    effect: index === 2 ? 'moon.particles' : 'ui.inkRipple',
  }));
  const mainNode = {
    id: 'main_scene',
    type: 'panorama',
    title: guide.worldName,
    subtitle: '环顾 360 度诗境，按顺序点亮三枚学习意象。',
    panoramaUrl: guide.panoramaUrl,
    initialView: { yaw: 10, pitch: 0, fov: 105 },
    ambientLine: buildAmbientLine(guide),
    hotspots: hotspotConfigs,
    panoramaQuality: panoramaQualityGuide(),
  };
  const branchNodes = guide.hotspots.map((label, index) => ({
    id: `branch_${letter(index)}`,
    type: 'panorama',
    title: branchTitle(label, guide),
    subtitle: `顺着“${label}”进入这一重诗境。`,
    panoramaUrl: guide.panoramaUrl,
    initialView: { yaw: safeHotspotYaw[index], pitch: safeHotspotPitch[index], fov: 104 },
    ambientLine: branchAmbient(label, guide, index),
    hotspots: [],
    panoramaQuality: panoramaQualityGuide(),
  }));

  return {
    gameId: guide.gameId,
    title: guide.title,
    poem: {
      poet: guide.author,
      line: guide.line,
      source: guide.source,
    },
    world: {
      worldName: guide.worldName,
      visualTone: guide.visualTone,
      spaceRules: [
        '在 360 度全景中观察诗歌意象，保持原版沉浸式探索节奏。',
        '热点集中在中部视区，避开左右 180 度接缝，减少拼接错位感。',
        '用三道诗境题把画面、字词、情感和写法连起来。',
      ],
      panoramaSeamPolicy: panoramaQualityGuide(),
    },
    startNodeId: 'main_scene',
    nodes: [mainNode, ...branchNodes],
    stories: buildStories(guide, hotspotIds),
    endings: buildEndings(guide),
    puzzles: buildPuzzles(guide, hotspotIds),
    puzzleOrder: hotspotIds,
    imagePrompts: {
      main_scene: [
        `2:1 equirectangular panorama for ${guide.author}《${guide.source}》 line ${guide.line}`,
        guide.visualTone,
        'natural 360 panorama, seamless horizon, no visible left-right seam, no broken architecture, no duplicated obvious object at the wrap line, no text, no watermark',
      ].join('; '),
    },
    meta: {
      origin: 'education-supplement',
      savedAt,
      panoramaSeamPolicy: panoramaQualityGuide(),
    },
  };
}

function buildStories(guide, hotspotIds) {
  const stories = {};
  guide.hotspots.forEach((label, index) => {
    stories[`story_${hotspotIds[index]}_locked`] = {
      id: `story_${hotspotIds[index]}_locked`,
      speaker: index === 0 ? guide.author : '诗境',
      text:
        index === 0
          ? `先解开“${label}”之问，让“${guide.line}”的第一枚意象碎片归位。`
          : `“${label}”仍隔着一层梦雾。请按诗句脉络继续点亮前一枚碎片。`,
      choices: [],
    };
  });
  stories.story_gate = {
    id: 'story_gate',
    speaker: '星河诗阵',
    text: `三枚碎片已经照亮：“${guide.line}”在你眼前展开。选择一条路，把这幅诗境写成你的归宿。`,
    choices: guide.hotspots.map((label, index) => ({
      id: `branch_${letter(index)}`,
      text: branchTitle(label, guide),
      tone: ['清远', '沉思', '开阔'][index] || '诗心',
      nextNodeId: `branch_${letter(index)}`,
      endingId: `ending_${letter(index)}`,
    })),
  };
  return stories;
}

function buildEndings(guide) {
  return Object.fromEntries(
    guide.hotspots.map((label, index) => [
      `ending_${letter(index)}`,
      {
        id: `ending_${letter(index)}`,
        name: branchTitle(label, guide),
        rarity: ['清远结局', '沉思结局', '诗心结局'][index] || '诗心结局',
        text: `你循着“${label}”入梦，读懂了《${guide.source}》里跃出的这一笔。`,
        rewardTitle: '完成诗境学习',
        rewardText: branchTitle(label, guide),
        imageUrl: guide.panoramaUrl,
      },
    ]),
  );
}

function buildPuzzles(guide, hotspotIds) {
  const [first, second, third] = guide.hotspots;
  const firstLine = lineForHotspot(guide, first);
  const secondLine = lineForHotspot(guide, second);
  const thirdLine = lineForHotspot(guide, third);
  const writingFocus = guide.writingPoints.slice(0, 2).join('、');
  return {
    [hotspotIds[0]]: {
      id: hotspotIds[0],
      motif: first,
      clueName: `${first}意象`,
      clueText: `请把“${first}”放回《${guide.source}》的诗句画面中观察。`,
      hint: `先找它和“${firstLine}”之间的联系。`,
      rewardLine: `${first}亮起，诗境的第一层画面展开。`,
      relatedLine: firstLine,
      question: `在《${guide.source}》里，热点“${first}”应对应哪一句或哪一层画面？`,
      options: [
        `“${firstLine}”中的${first}画面`,
        `只对应“${second}”，与${first}无关`,
        `只对应“${third}”，不看诗句`,
        '与这首诗没有关系的装饰物',
      ],
      correctIndex: 0,
    },
    [hotspotIds[1]]: {
      id: hotspotIds[1],
      motif: second,
      clueName: `${second}之问`,
      clueText: `“${second}”让《${guide.source}》的空间和情绪继续推进。`,
      hint: `联系“${secondLine}”和主题“${guide.theme}”。`,
      rewardLine: `${second}归位，画面和诗心靠近了一步。`,
      relatedLine: secondLine,
      question: `观察“${second}”时，最应该把它和哪种情感或主题联系起来？`,
      options: [
        guide.theme,
        `只看${second}的颜色，不看全诗`,
        '现代广告口号',
        `与“${secondLine}”相反的热闹情绪`,
      ],
      correctIndex: 0,
    },
    [hotspotIds[2]]: {
      id: hotspotIds[2],
      motif: third,
      clueName: `${third}归位`,
      clueText: `最后观察“${third}”，把画面、字词和写法合拢。`,
      hint: `重点看${writingFocus}。`,
      rewardLine: `${third}照亮，诗境之门开启。`,
      relatedLine: thirdLine,
      question: `围绕“${third}”，《${guide.source}》最适合赏析哪种写法？`,
      options: [writingFocus, '倒叙、插叙', '说明顺序、列数字', '合同条款、报价说明'],
      correctIndex: 0,
    },
  };
}

function lineForHotspot(guide, label) {
  const candidates = String(guide.fullText || guide.line || '')
    .split(/[。！？；]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedLabel = label.replace(/[光杯影声]/g, '');
  const direct = candidates.find((item) => item.includes(label));
  if (direct) return direct;
  const fuzzy = candidates.find((item) => normalizedLabel && item.includes(normalizedLabel));
  if (fuzzy) return fuzzy;
  return guide.line;
}

function panoramaQualityGuide() {
  return {
    seamYaw: 180,
    safeYawRange: [-120, 120],
    hotspotYawRange: [-60, 100],
    guidance: '全景左右边缘作为低关注区，不放核心主体、文字、人物脸部、亭台楼阁硬直线和热点；核心意象放在中部视区，接缝处以天空、水面、云雾、山影或草地等连续纹理过渡。',
  };
}

function buildAmbientLine(guide) {
  return `${guide.worldName}展开，${guide.hotspots.join('、')}在四周浮现；重点句“${guide.line}”正等待被点亮。`;
}

function branchAmbient(label, guide, index) {
  const templates = [
    `靠近“${label}”，先把眼前景物读成诗中的画面线索。`,
    `停在“${label}”前，把字词、空间和情绪连起来。`,
    `顺着“${label}”回望全景，诗句的写法逐渐清楚。`,
  ];
  return templates[index] || `继续观察“${label}”。`;
}

function branchTitle(label, guide) {
  return `${label}${guide.theme.slice(0, 2)}`;
}

function letter(index) {
  return ['a', 'b', 'c'][index] || String(index + 1);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}
