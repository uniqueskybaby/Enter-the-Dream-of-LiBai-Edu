import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { HotspotConfig, PanoramaNode, ViewState } from '../gameTypes';

export interface ViewerOptions {
  scene: PanoramaNode;
}

export interface SceneTransition {
  mode: 'no-direct-flash' | 'instant';
}

export interface PanoramaViewerAdapter {
  mount(container: HTMLElement, options: ViewerOptions): Promise<void>;
  loadScene(scene: PanoramaNode, transition?: SceneTransition): Promise<void>;
  addHotspots(hotspots: HotspotConfig[]): void;
  removeHotspots(ids?: string[]): void;
  setView(view: Partial<ViewState>, animated?: boolean): void;
  getView(): ViewState;
  onHotspotClick(handler: (hotspotId: string) => void): void;
  onViewChange(handler: (view: ViewState) => void): void;
  destroy(): void;
}

type PannellumViewer = {
  destroy?: () => void;
  getYaw?: () => number;
  getPitch?: () => number;
  getHfov?: () => number;
  setYaw?: (yaw: number) => void;
  setPitch?: (pitch: number) => void;
  setHfov?: (hfov: number) => void;
  lookAt?: (pitch: number, yaw: number, hfov?: number, animated?: number | boolean) => void;
  addHotSpot?: (hotspot: Record<string, unknown>) => void;
  removeHotSpot?: (id: string) => void;
  on?: (eventName: string, handler: () => void) => void;
};

export class PannellumAdapter implements PanoramaViewerAdapter {
  private container?: HTMLElement;
  private viewer?: PannellumViewer;
  private scene?: PanoramaNode;
  private viewHandler?: (view: ViewState) => void;
  private hotspotHandler?: (hotspotId: string) => void;
  private frameId?: number;

  async mount(container: HTMLElement, options: ViewerOptions): Promise<void> {
    this.container = container;
    await this.loadScene(options.scene, { mode: 'instant' });
  }

  async loadScene(scene: PanoramaNode, _transition?: SceneTransition): Promise<void> {
    if (!this.container) {
      throw new Error('Panorama viewer container is not mounted.');
    }

    this.destroyViewer();
    this.scene = scene;
    this.container.innerHTML = '';

    this.viewer = window.pannellum.viewer(this.container, {
      type: 'equirectangular',
      panorama: scene.panoramaUrl,
      autoLoad: true,
      showControls: false,
      showZoomCtrl: false,
      keyboardZoom: false,
      mouseZoom: true,
      compass: false,
      draggable: true,
      yaw: scene.initialView.yaw,
      pitch: scene.initialView.pitch,
      hfov: scene.initialView.fov,
      minHfov: 48,
      maxHfov: 118,
      hotSpotDebug: false,
      hotSpots: this.toPannellumHotspots(scene.hotspots),
    });

    this.startViewLoop();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
  }

  addHotspots(hotspots: HotspotConfig[]): void {
    hotspots.forEach((hotspot) => this.viewer?.addHotSpot?.(this.toPannellumHotspot(hotspot)));
  }

  removeHotspots(ids?: string[]): void {
    const targets = ids ?? this.scene?.hotspots.map((hotspot) => hotspot.id) ?? [];
    targets.forEach((id) => this.viewer?.removeHotSpot?.(id));
  }

  setView(view: Partial<ViewState>, animated = false): void {
    if (!this.viewer) return;

    const current = this.getView();
    const next = {
      yaw: view.yaw ?? current.yaw,
      pitch: view.pitch ?? current.pitch,
      fov: view.fov ?? current.fov,
    };

    if (this.viewer.lookAt) {
      this.viewer.lookAt(next.pitch, next.yaw, next.fov, animated ? 450 : 0);
      return;
    }

    this.viewer.setYaw?.(next.yaw);
    this.viewer.setPitch?.(next.pitch);
    this.viewer.setHfov?.(next.fov);
  }

  getView(): ViewState {
    return {
      yaw: this.viewer?.getYaw?.() ?? this.scene?.initialView.yaw ?? 0,
      pitch: this.viewer?.getPitch?.() ?? this.scene?.initialView.pitch ?? 0,
      fov: this.viewer?.getHfov?.() ?? this.scene?.initialView.fov ?? 80,
    };
  }

  onHotspotClick(handler: (hotspotId: string) => void): void {
    this.hotspotHandler = handler;
  }

  onViewChange(handler: (view: ViewState) => void): void {
    this.viewHandler = handler;
  }

  destroy(): void {
    this.destroyViewer();
    this.container = undefined;
  }

  private destroyViewer(): void {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = undefined;
    }
    this.viewer?.destroy?.();
    this.viewer = undefined;
  }

  private startViewLoop(): void {
    const tick = () => {
      this.viewHandler?.(this.getView());
      this.frameId = window.requestAnimationFrame(tick);
    };
    this.frameId = window.requestAnimationFrame(tick);
  }

  private toPannellumHotspots(hotspots: HotspotConfig[]): Record<string, unknown>[] {
    return hotspots
      .filter((hotspot) => hotspot.state !== 'hidden')
      .map((hotspot) => this.toPannellumHotspot(hotspot));
  }

  private toPannellumHotspot(hotspot: HotspotConfig): Record<string, unknown> {
    return {
      id: hotspot.id,
      pitch: hotspot.pitch,
      yaw: hotspot.yaw,
      type: 'custom',
      cssClass: `dream-hotspot-marker is-${hotspot.state}`,
      createTooltipFunc: this.createHotspotElement,
      createTooltipArgs: hotspot,
      clickHandlerFunc: (_event: MouseEvent, args: HotspotConfig) => {
        this.hotspotHandler?.(args.id);
      },
      clickHandlerArgs: hotspot,
    };
  }

  private createHotspotElement(hotSpotDiv: HTMLElement, args: HotspotConfig): void {
    hotSpotDiv.classList.add('dream-hotspot');
    hotSpotDiv.classList.add(`dream-hotspot--${args.state}`);
    hotSpotDiv.setAttribute('aria-label', args.label);
    hotSpotDiv.innerHTML = `
      <span class="dream-hotspot__aura"></span>
      <span class="dream-hotspot__ring"></span>
      <span class="dream-hotspot__label">${args.label}</span>
      <span class="dream-hotspot__tag">${args.state === 'locked' ? '未解' : '探究'}</span>
    `;
  }
}
