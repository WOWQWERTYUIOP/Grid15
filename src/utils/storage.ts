import { CarCustomization } from '../types/game';

export const DEFAULT_CAR_CONFIG: CarCustomization = {
  driverName: 'APEX RACER',
  carNumber: 15,
  bodyStyle: 'AERO_APEX',
  primaryColor: '#ff2a5f',
  secondaryColor: '#00f0ff',
  accentColor: '#39ff14',
  wheelStyle: 'FORGED_SPOKE',
  wheelColor: '#ffd700',
  helmetColor: '#ffffff',
};

const STORAGE_KEY = 'grid15_customization_v1';

export function loadSavedCustomization(): CarCustomization {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return { ...DEFAULT_CAR_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.warn('Failed to load customization from storage:', e);
  }
  return DEFAULT_CAR_CONFIG;
}

export function saveCustomization(config: CarCustomization) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save customization:', e);
  }
}

export function formatTimeMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms === Infinity || isNaN(ms)) return '--:--.---';
  const totalSecs = ms / 1000;
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  const millis = Math.floor(ms % 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}
