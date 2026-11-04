/*
 * Small wrappers around localStorage. Storage can be blocked (private mode,
 * strict privacy settings), so every call is wrapped in try/catch and the app
 * keeps working without it.
 */
export function getItem(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
