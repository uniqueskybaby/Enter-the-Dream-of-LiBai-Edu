/// <reference types="vite/client" />

interface Window {
  pannellum: {
    viewer: (container: HTMLElement, config: Record<string, unknown>) => Record<string, unknown>;
  };
}
