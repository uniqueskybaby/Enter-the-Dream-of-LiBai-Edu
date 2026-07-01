import type { HotspotConfig, ViewState } from './gameTypes';

function normalizeYaw(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}

export function angularDistance(view: ViewState, hotspot: HotspotConfig): number {
  const yawDelta = normalizeYaw(view.yaw - hotspot.yaw);
  const pitchDelta = view.pitch - hotspot.pitch;
  return Math.sqrt(yawDelta * yawDelta + pitchDelta * pitchDelta);
}

export function findHotspotNearView(
  view: ViewState,
  hotspots: HotspotConfig[],
): HotspotConfig | undefined {
  return hotspots
    .filter((hotspot) => hotspot.state !== 'hidden')
    .map((hotspot) => ({
      hotspot,
      distance: angularDistance(view, hotspot),
      radius: hotspot.radius ?? 10,
    }))
    .filter((entry) => entry.distance <= entry.radius)
    .sort((a, b) => a.distance - b.distance)[0]?.hotspot;
}

export function clampPitch(pitch: number): number {
  return Math.max(-78, Math.min(78, pitch));
}
