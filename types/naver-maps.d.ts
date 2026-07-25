// Minimal ambient types for the NAVER Maps JavaScript API v3 subset this app
// uses. The SDK is loaded at runtime via <script src="...maps.js?ncpKeyId=...">
// (see lib/naver-maps-loader.ts) — there is no official npm type package.
declare namespace naver.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    extend(latlng: LatLng): void;
    hasLatLng(latlng: LatLng): boolean;
  }

  type MapEventName = "click" | "idle" | "bounds_changed" | "zoom_changed" | "dragend";

  class Map {
    constructor(element: HTMLElement | string, options: MapOptions);
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setZoom(zoom: number, effect?: boolean): void;
    getZoom(): number;
    getBounds(): LatLngBounds;
    panTo(latlng: LatLng, options?: { duration: number }): void;
    destroy(): void;
  }

  interface MapOptions {
    center: LatLng;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomControl?: boolean;
    zoomControlOptions?: { position?: number };
    scaleControl?: boolean;
    logoControl?: boolean;
    mapDataControl?: boolean;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(latlng: LatLng): void;
    setIcon(icon: unknown): void;
    setZIndex(zIndex: number): void;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    title?: string;
    icon?: unknown;
    zIndex?: number;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, marker?: Marker | LatLng): void;
    close(): void;
  }

  interface InfoWindowOptions {
    content: string | HTMLElement;
    borderWidth?: number;
    disableAnchor?: boolean;
    backgroundColor?: string;
    pixelOffset?: Point;
  }

  class Point {
    constructor(x: number, y: number);
  }

  class Size {
    constructor(width: number, height: number);
  }

  interface HtmlIcon {
    content: string;
    size?: Size;
    anchor?: Point;
  }

  // Opaque handle returned by Event.addListener; callers only pass it back
  // to removeListener, never inspect its shape.
  type MapEventListener = symbol;

  const Event: {
    addListener(target: Map | Marker, eventName: MapEventName, handler: (...args: unknown[]) => void): MapEventListener;
    removeListener(listener: MapEventListener): void;
    clearListeners(target: Map | Marker, eventName: MapEventName): void;
  };

  const Position: { TOP_RIGHT: number; TOP_LEFT: number; BOTTOM_RIGHT: number; BOTTOM_LEFT: number };
}

interface Window {
  naver?: { maps: typeof naver.maps };
}
