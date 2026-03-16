/**
 * duplicate.js
 * Detects duplicate duas before submission using Arabic text
 * normalisation and Jaccard similarity on word sets.
 */

/* ── Text Normalisation ──────────────────────────────────────── */

/**
 * Strip tashkeel, tatweel, normalise alef variants, and collapse
 * whitespace to produce a canonical form for comparison.
 * @param {string} text
 * @returns {string}
 */
function normalizeDua(text) {
  if (!text) return '';
  return text
    // Remove tashkeel (diacritics)
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06DC\u0640]/g, '')
    // Normalise alef variants → plain alef
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // Normalise teh marbuta → heh
    .replace(/\u0629/g, '\u0647')
    // Normalise alef maqsura → yeh
    .replace(/\u0649/g, '\u064A')
    // Remove punctuation and decorative characters
    .replace(/[«»""''،؛؟!\-.:/\\@[\]`{}~]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── Similarity Scoring ──────────────────────────────────────── */

/**
 * Jaccard similarity on word sets (words longer than one character).
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
function duaSimilarity(a, b) {
  const na = normalizeDua(a), nb = normalizeDua(b);
  if (!na || !nb) return 0;

  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb = new Set(nb.split(' ').filter(w => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;

  let intersection = 0;
  wa.forEach(w => { if (wb.has(w)) intersection++; });

  return intersection / (wa.size + wb.size - intersection);
}

/* ── Duplicate Search ────────────────────────────────────────── */

/**
 * Search a list for a duplicate of arabicText.
 * Uses an adaptive threshold: stricter for short duas, lenient for long ones.
 * @param {string} arabicText
 * @param {Array<{text_ar:string}>} list
 * @returns {{dua:Object, score:number}|null}
 */
function findDuplicateInList(arabicText, list) {
  const wordCount = normalizeDua(arabicText).split(' ').filter(w => w.length > 1).length;
  const threshold = wordCount <= 8 ? 0.70 : 0.55;

  let best = null, bestScore = 0;
  for (const dua of list) {
    const score = duaSimilarity(arabicText, dua.text_ar);
    if (score > bestScore) { bestScore = score; best = dua; }
  }

  return bestScore >= threshold ? { dua: best, score: bestScore } : null;
}

/**
 * Check for duplicates: first in the loaded state, then via DB query
 * to catch duas in other categories that aren't currently rendered.
 * @param {string} arabicText
 * @returns {Promise<{dua:Object, score:number}|null>}
 */
async function findDuplicate(arabicText) {
  // Fast path: check currently loaded duas
  const quick = findDuplicateInList(arabicText, state.duas);
  if (quick) return quick;

  // Slow path: query up to 300 approved duas from the database
  try {
    const { data } = await db
      .from('duas')
      .select('id, text_ar, translation, source, reference, categories(name,slug,icon)')
      .eq('status', 'approved')
      .limit(300);

    if (data && data.length > state.duas.length) {
      return findDuplicateInList(arabicText, data);
    }
  } catch (e) {
    console.warn('DB duplicate check failed:', e.message);
  }

  return null;
}

/* ── Duplicate Modal ─────────────────────────────────────────── */

function closeDuplicateModal() {
  document.getElementById('duplicateModal').style.display = 'none';
}

/** Force-submit after the user acknowledges the duplicate warning. */
function submitDuaForce() {
  closeDuplicateModal();
  _forceSubmit = true;
  submitDua();
}