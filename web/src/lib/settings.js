// Rapor signature settings — server-side (admin-editable), cached locally so
// PDF export works offline. Defaults match the club's official rapor.
import { apiFetch } from "./api.js";

const CACHE_KEY = "simdik_rapor_settings";

export const DEFAULT_RAPOR_SETTINGS = {
  rapor_penguji_nama: "Dewan Pembina KB",
  rapor_ketua_nama: "Kapten Pratama",
  rapor_ketua_nim: "2020011099",
  rapor_pembimbing_nama: "Dr. Ir. Heru Prasetyo, M.T.",
  rapor_pembimbing_nidn: "0412087501",
};

export function getRaporSettings() {
  try {
    return { ...DEFAULT_RAPOR_SETTINGS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_RAPOR_SETTINGS };
  }
}

export function cacheRaporSettings(settings) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...getRaporSettings(), ...settings }));
}

export async function fetchRaporSettings() {
  const settings = await apiFetch("/settings");
  cacheRaporSettings(settings);
  return getRaporSettings();
}