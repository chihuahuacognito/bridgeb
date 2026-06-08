const missing = new Set();

export const assets = {
  markMissing(key) { missing.add(key); },
  has(key)         { return !missing.has(key); },
  missingList()    { return [...missing]; },
  _reset()         { missing.clear(); },
};
