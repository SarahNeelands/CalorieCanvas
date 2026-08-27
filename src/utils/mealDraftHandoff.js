const HANDOFF_KEY = "calorie-canvas:meal-draft-handoff";

export function saveMealDraftHandoff(handoff) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
}

export function loadMealDraftHandoff() {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearMealDraftHandoff() {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.removeItem(HANDOFF_KEY);
}
