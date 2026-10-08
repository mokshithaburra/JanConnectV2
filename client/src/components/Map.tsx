/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Advanced markers need a Map ID; Google's DEMO_MAP_ID is for development only.
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || (import.meta.env.PROD ? undefined : "DEMO_MAP_ID");

const MAPS_READY_CALLBACK = "__janconnectMapsReady";

// Shared across renders and route changes so the script is only injected once.
let mapScriptPromise: Promise<void> | null = null;

// With loading=async the namespaces fill in lazily, so wait for the libraries
// callers use directly (google.maps.Map, google.maps.marker.*).
async function importLibraries() {
  const maps = window.google?.maps;
  if (typeof maps?.importLibrary !== "function") return;
  await Promise.all([maps.importLibrary("maps"), maps.importLibrary("marker")]);
}

function loadMapScript() {
  if (mapScriptPromise) return mapScriptPromise;
  if (window.google?.maps) {
    mapScriptPromise = importLibraries();
    return mapScriptPromise;
  }

  mapScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // onload can fire before the API (and importLibrary) is initialized under
    // loading=async; Google invokes the callback once it is ready.
    (window as unknown as Record<string, unknown>)[MAPS_READY_CALLBACK] = () => {
      delete (window as unknown as Record<string, unknown>)[MAPS_READY_CALLBACK];
      script.remove();
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&libraries=marker,places,geometry&loading=async&callback=${MAPS_READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      script.remove();
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  })
    .then(importLibraries)
    .catch(error => {
      mapScriptPromise = null;
      throw error;
    });
  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
      mapId: GOOGLE_MAPS_MAP_ID,
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
