// Persisted display preferences.
//
// localStorage rather than a cookie: none of this ever needs to reach a server,
// and a cookie would be attached to every request for nothing. Every access is
// guarded - localStorage throws outright in some private-browsing modes, and a
// preference failing to save must never take the app down with it.

const KEY = 'rattle:prefs';
const DEFAULTS = {
  lineNumbers: true,
  logMin: false,
  hovers: true,
};

let cache = null;

function load() {
  if (cache) return cache;
  cache = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(cache, JSON.parse(raw));
    // carry over the older standalone key rather than silently losing it
    const legacy = localStorage.getItem('rattle:log-min');
    if (legacy !== null) {
      cache.logMin = legacy === '1';
      localStorage.removeItem('rattle:log-min');
      save();
    }
  } catch (_) {
    /* private mode, or corrupt JSON: fall back to defaults */
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (_) {
    /* nothing to do; the setting simply will not persist */
  }
}

export function getPref(key) {
  const p = load();
  return key in p ? p[key] : DEFAULTS[key];
}

export function setPref(key, value) {
  load();
  cache[key] = value;
  save();
}
