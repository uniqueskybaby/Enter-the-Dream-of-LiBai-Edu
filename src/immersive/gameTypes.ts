export type HotspotState = 'available' | 'locked' | 'hidden';

export interface ViewState {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PoemMeta {
  poet: string;
  line: string;
  source: string;
}

export interface WorldMeta {
  worldName: string;
  visualTone: string;
  spaceRules: string[];
}

export interface HotspotConfig {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  radius?: number;
  state: HotspotState;
  storyId: string;
  icon?: string;
  effect?: string;
}

export interface PanoramaNode {
  id: string;
  type: 'panorama';
  title: string;
  subtitle?: string;
  panoramaUrl: string;
  initialView: ViewState;
  ambientLine?: string;
  hotspots: HotspotConfig[];
}

export interface StoryChoice {
  id: string;
  text: string;
  tone: string;
  nextNodeId: string;
}

export interface StoryBlock {
  id: string;
  speaker: string;
  text: string;
  choices: StoryChoice[];
}

export interface DynamicPuzzle {
  id: string;
  motif: string;
  clueName: string;
  clueText: string;
  hint: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface PanoramaGameConfig {
  gameId: string;
  title: string;
  poem: PoemMeta;
  world: WorldMeta;
  startNodeId: string;
  nodes: PanoramaNode[];
  stories: Record<string, StoryBlock>;
  puzzles?: Record<string, DynamicPuzzle>;
  puzzleOrder?: string[];
  imagePrompts?: Record<string, string>;
  meta?: {
    origin?: 'built-in' | 'player-ai';
    savedAt?: string;
  };
}
