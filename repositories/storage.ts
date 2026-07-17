export function readCollection<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
export function writeCollection<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(`car-master:${key}`));
}
export function subscribeToStorage(key: string, listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const storageListener = (event: StorageEvent) => { if (event.key === key) listener(); };
  const customListener = () => listener();
  window.addEventListener("storage", storageListener); window.addEventListener(`car-master:${key}`, customListener);
  return () => { window.removeEventListener("storage", storageListener); window.removeEventListener(`car-master:${key}`, customListener); };
}
