import { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import type { HotspotConfig, PanoramaNode, ViewState } from './gameTypes';
import { clampPitch, findHotspotNearView } from './geometry';
import { PannellumAdapter } from './viewer/PannellumAdapter';

interface PanoramaStageProps {
  node: PanoramaNode;
  locked: boolean;
  onHotspotClick: (hotspotId: string) => void;
  onViewChange: (view: ViewState) => void;
  onViewerReady?: (adapter: PannellumAdapter) => void;
  onCloseModal?: () => void;
}

type MotionControlState = 'unsupported' | 'idle' | 'requesting' | 'calibrating' | 'active' | 'denied';
type DeviceOrientationPermission = 'default' | 'denied' | 'granted';
type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<DeviceOrientationPermission>;
};

interface MotionBaseline {
  alpha: number;
  beta: number;
  yaw: number;
  pitch: number;
}

function getDeviceOrientationConstructor(): DeviceOrientationEventConstructor | undefined {
  if (typeof DeviceOrientationEvent === 'undefined') return undefined;
  return DeviceOrientationEvent as DeviceOrientationEventConstructor;
}

function supportsDeviceOrientation(): boolean {
  return Boolean(getDeviceOrientationConstructor());
}

function normalizeAngle(angle: number): number {
  return ((angle + 540) % 360) - 180;
}

export function PanoramaStage({
  node,
  locked,
  onHotspotClick,
  onViewChange,
  onViewerReady,
  onCloseModal,
}: PanoramaStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<PannellumAdapter | null>(null);
  const nodeRef = useRef(node);
  const lockedRef = useRef(locked);
  const hotspotIdsRef = useRef<string[]>([]);
  const sceneLoadedRef = useRef(false);
  const hotspotCycleRef = useRef(0);
  const motionBaselineRef = useRef<MotionBaseline | null>(null);
  const motionViewRef = useRef<ViewState | null>(null);
  const motionFrameRef = useRef<number | null>(null);
  const pendingMotionViewRef = useRef<ViewState | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [motionControl, setMotionControl] = useState<MotionControlState>(() => (
    supportsDeviceOrientation() ? 'idle' : 'unsupported'
  ));

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const adapter = new PannellumAdapter();
    adapterRef.current = adapter;
    adapter.onHotspotClick(onHotspotClick);
    adapter.onViewChange(onViewChange);
    adapter.mount(container, { scene: node }).then(() => {
      hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
      sceneLoadedRef.current = true;
      onViewerReady?.(adapter);
    });

    return () => adapter.destroy();
  }, []);

  useEffect(() => {
    adapterRef.current?.onHotspotClick(onHotspotClick);
  }, [onHotspotClick]);

  useEffect(() => {
    adapterRef.current?.onViewChange(onViewChange);
  }, [onViewChange]);

  useEffect(() => {
    if (!sceneLoadedRef.current) return;
    adapterRef.current?.loadScene(node, { mode: 'no-direct-flash' }).then(() => {
      hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
    });
  }, [node.id]);

  useEffect(() => {
    motionBaselineRef.current = null;
    motionViewRef.current = null;
    pendingMotionViewRef.current = null;
  }, [node.id]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !sceneLoadedRef.current) return;
    adapter.removeHotspots(hotspotIdsRef.current);
    adapter.addHotspots(node.hotspots);
    hotspotIdsRef.current = node.hotspots.map((hotspot) => hotspot.id);
  }, [node.hotspots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const adapter = adapterRef.current;
      if (!adapter || lockedRef.current) return;

      const key = event.key.toLowerCase();
      const view = adapter.getView();
      const step = event.shiftKey ? 12 : 7;

      const preventKeys = ['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', 'arrowdown', 's', ' ', 'e', 'tab', 'r', 'h', 'f'];
      if (preventKeys.includes(key) || /^[1-3]$/.test(key)) {
        event.preventDefault();
      }

      if (key === 'arrowleft' || key === 'a') {
        adapter.setView({ yaw: view.yaw - step }, true);
      }
      if (key === 'arrowright' || key === 'd') {
        adapter.setView({ yaw: view.yaw + step }, true);
      }
      if (key === 'arrowup' || key === 'w') {
        adapter.setView({ pitch: clampPitch(view.pitch + step * 0.6) }, true);
      }
      if (key === 'arrowdown' || key === 's') {
        adapter.setView({ pitch: clampPitch(view.pitch - step * 0.6) }, true);
      }
      if (key === ' ' || key === 'e') {
        const hotspot = findHotspotNearView(view, nodeRef.current.hotspots);
        if (hotspot) {
          onHotspotClick(hotspot.id);
        }
      }
      if (key === 'tab') {
        const available = nodeRef.current.hotspots.filter((h) => h.state === 'available');
        if (available.length > 0) {
          hotspotCycleRef.current = (hotspotCycleRef.current + 1) % available.length;
          const target = available[hotspotCycleRef.current];
          adapter.setView({ yaw: target.yaw, pitch: target.pitch }, true);
        }
      }
      if (key === 'r') {
        const initial = nodeRef.current.initialView;
        adapter.setView({ yaw: initial.yaw, pitch: initial.pitch }, true);
      }
      if (key === 'h') {
        setShowHelp((prev) => !prev);
      }
      if (/^[1-3]$/.test(key)) {
        const index = parseInt(key) - 1;
        const hotspots = nodeRef.current.hotspots;
        if (index < hotspots.length) {
          adapter.setView({ yaw: hotspots[index].yaw, pitch: hotspots[index].pitch }, true);
        }
      }
      if (key === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
      if (key === 'escape') {
        onCloseModal?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onHotspotClick, onCloseModal]);

  useEffect(() => {
    if (motionControl !== 'active' && motionControl !== 'calibrating') return;

    const applyMotionView = () => {
      const adapter = adapterRef.current;
      const nextView = pendingMotionViewRef.current;
      motionFrameRef.current = null;
      pendingMotionViewRef.current = null;
      if (!adapter || lockedRef.current || !nextView) return;
      adapter.setView(nextView);
    };

    const scheduleMotionView = (nextView: ViewState) => {
      pendingMotionViewRef.current = nextView;
      if (motionFrameRef.current !== null) return;
      motionFrameRef.current = window.requestAnimationFrame(applyMotionView);
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const adapter = adapterRef.current;
      if (!adapter || lockedRef.current || event.alpha === null || event.beta === null) return;

      const currentView = adapter.getView();
      if (!motionBaselineRef.current) {
        motionBaselineRef.current = {
          alpha: event.alpha,
          beta: event.beta,
          yaw: currentView.yaw,
          pitch: currentView.pitch,
        };
        motionViewRef.current = currentView;
        setMotionControl('active');
        return;
      }

      const baseline = motionBaselineRef.current;
      const yawDelta = normalizeAngle(event.alpha - baseline.alpha);
      const pitchDelta = (baseline.beta - event.beta) * 0.7;
      const targetView: ViewState = {
        yaw: baseline.yaw + yawDelta,
        pitch: clampPitch(baseline.pitch + pitchDelta),
        fov: currentView.fov,
      };

      const previousView = motionViewRef.current ?? currentView;
      const smoothedView: ViewState = {
        yaw: previousView.yaw + normalizeAngle(targetView.yaw - previousView.yaw) * 0.22,
        pitch: previousView.pitch + (targetView.pitch - previousView.pitch) * 0.22,
        fov: currentView.fov,
      };
      motionViewRef.current = smoothedView;
      scheduleMotionView(smoothedView);
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
        motionFrameRef.current = null;
      }
      pendingMotionViewRef.current = null;
    };
  }, [motionControl]);

  const toggleMotionControl = async () => {
    if (motionControl === 'active' || motionControl === 'calibrating') {
      motionBaselineRef.current = null;
      motionViewRef.current = null;
      setMotionControl('idle');
      return;
    }

    const DeviceOrientation = getDeviceOrientationConstructor();
    if (!DeviceOrientation) {
      setMotionControl('unsupported');
      return;
    }

    setMotionControl('requesting');
    try {
      if (typeof DeviceOrientation.requestPermission === 'function') {
        const permission = await DeviceOrientation.requestPermission();
        if (permission !== 'granted') {
          setMotionControl('denied');
          return;
        }
      }
      motionBaselineRef.current = null;
      motionViewRef.current = null;
      setMotionControl('calibrating');
    } catch {
      setMotionControl('denied');
    }
  };

  return (
    <div className="panorama-stage" aria-label={node.title}>
      <div ref={containerRef} className="panorama-stage__viewer" />
      <Crosshair hotspots={node.hotspots} />
      {motionControl !== 'unsupported' && (
        <MotionControlButton state={motionControl} onClick={toggleMotionControl} />
      )}
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function Crosshair({ hotspots }: { hotspots: HotspotConfig[] }) {
  const hasAvailable = hotspots.some((hotspot) => hotspot.state === 'available');
  return (
    <div className={`crosshair ${hasAvailable ? 'is-awake' : ''}`} aria-hidden="true">
      <span />
    </div>
  );
}

function MotionControlButton({ state, onClick }: { state: Exclude<MotionControlState, 'unsupported'>; onClick: () => void }) {
  const active = state === 'active' || state === 'calibrating';
  const labels: Record<Exclude<MotionControlState, 'unsupported'>, string> = {
    idle: '体感',
    requesting: '授权',
    calibrating: '校准',
    active: '体感',
    denied: '受限',
  };
  const title = state === 'denied'
    ? '传感器权限未开启'
    : active
      ? '关闭手机体感控制'
      : '开启手机体感控制';

  return (
    <button
      className={`motion-button ${active ? 'is-active' : ''} ${state === 'denied' ? 'is-denied' : ''}`}
      type="button"
      aria-label={title}
      title={title}
      disabled={state === 'requesting'}
      onClick={onClick}
    >
      <Compass size={22} />
      <span>{labels[state]}</span>
    </button>
  );
}

const keyBindings = [
  ['W/A/S/D', '移动视角'],
  ['Shift+方向', '快速移动'],
  ['Space/E', '交互热点'],
  ['Tab', '切换热点'],
  ['1/2/3', '跳转热点'],
  ['R', '重置视角'],
  ['F', '全屏'],
  ['H', '显示/隐藏帮助'],
  ['Esc', '关闭面板'],
];

function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="keyboard-help" onClick={onClose}>
      <div className="keyboard-help__card">
        <h3>快捷键</h3>
        <dl>
          {keyBindings.map(([key, desc]) => (
            <div key={key}>
              <dt><kbd>{key}</kbd></dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <small>按 H 关闭</small>
      </div>
    </div>
  );
}
