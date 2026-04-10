import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let initialized = false;

export function initMapsAPI(): void {
  if (initialized) return;
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    v: 'weekly',
    libraries: ['visualization', 'marker'],
  });
  initialized = true;
}

export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  initMapsAPI();
  return importLibrary('maps');
}

export async function loadMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  initMapsAPI();
  return importLibrary('marker');
}

export async function loadVisualizationLibrary(): Promise<google.maps.VisualizationLibrary> {
  initMapsAPI();
  return importLibrary('visualization');
}
