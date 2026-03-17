/**
 * ai.js
 * AI-powered auto-fill for the Add Dua form.
 *
 * Model order — optimised for speed + accuracy on Arabic Islamic text:
 *   1. gemini-2.0-flash        — best balance: fast, reliable, great Arabic
 *   2. gemini-1.5-flash        — very stable, widely available
 *   3. groq llama-3.3-70b      — fast + much better quality than 8b
 *   4. gemini-2.5-flash        — best quality but experimental & slow
 *   5. groq llama-3.1-8b       — fastest, last resort
 *
 * All API errors are logged silently — users never see raw error messages.
 */

let _aiTimer = null;

function onArabicInput() {
  clearTimeout(_aiTimer);
  const text = document.getElementById('inputTextAr').value.trim();
  if (text.length < 10) return;
  _aiTimer = setTimeout(() => autoFillDuaInfo(text), 1800);
}

async function autoFillDuaInfo(arabicText) {
  const bar = document.getElementById('aiFillingBar');
  const msg = document.getElementById('aiFillingMsg');
  bar.classList.remove('hidden');
  msg.textContent = 'Analyzing dua with AI…';

  /* ── Helpers ─────────────────────────────────────────────── */

  function extractJSON(raw) {
    if (!raw) throw new Error('empty response');
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('no JSON found');
    return JSON.parse(raw.slice(s, e + 1));
  }

  function fillFields(info) {
    let filled = 0;

    function fill(inputId, badgeId, val) {
      if (val && String(val).trim() && !document.getElementById(inputId).value.trim()) {
        document.getElementById(inputId).value = String(val).trim();
        document.getElementById(inputId).classList.add('field-validated');
        document.getElementById(badgeId).classList.remove('hidden');
        filled++;
      }
    }

    fill('inputTranslit',    'translitBadge',    info.transliteration);
    fill('inputTranslation', 'translationBadge', info.translation);
    fill('inputSource',      'sourceBadge',      info.source);
    fill('inputReference',   'referenceBadge',   info.reference);

    if (info.category_hint) {
      const slug = info.category_hint.trim().toLowerCase();
      const cat  = state.categories.find(c => c.slug === slug || slug.includes(c.slug));
      if (cat) document.getElementById('inputCategory').value = cat.id;
    }

    msg.textContent = filled > 0
      ? `✓ AI filled ${filled} field${filled > 1 ? 's' : ''} — please review`
      : '✓ Done — fill in any missing fields';

    setTimeout(() => bar.classList.add('hidden'), 5000);
  }

  /* ── Gemini helper ───────────────────────────────────────── */

  const geminiSchema = {
    type: 'object',
    properties: {
      transliteration: { type: 'string' },
      translation:     { type: 'string' },
      source:          { type: 'string' },
      reference:       { type: 'string' },
      category_hint:   { type: 'string' },
    },
    required: ['transliteration', 'translation', 'source', 'reference', 'category_hint'],
  };

  async function tryGemini(model) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are an Islamic scholar. Analyze this Arabic dua and return the requested fields: ${arabicText}` }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
            responseSchema: geminiSchema,
          },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      let detail = `HTTP ${res.status}`;
      try { detail = JSON.parse(body).error.message || detail; } catch (_) {}
      throw new Error(detail);
    }
    const data = await res.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('empty response');
    return extractJSON(raw);
  }

  /* ── Groq helper ─────────────────────────────────────────── */

  const groqPrompt = `You are an Islamic scholar. For this Arabic dua return ONLY a raw JSON object — no markdown, no explanation:
{"transliteration":"...","translation":"...","source":"Quran or Sunnah","reference":"...","category_hint":"one of: quran morning-evening forgiveness health family rizq knowledge jannah dhikr"}

Dua: ${arabicText}`;

  async function tryGroq(model) {
    const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: groqPrompt }],
        temperature: 0.1,
        max_tokens: 600,
      }),
    });
    if (!gr.ok) {
      const body = await gr.text();
      let detail = `HTTP ${gr.status}`;
      try { detail = JSON.parse(body).error.message || detail; } catch (_) {}
      throw new Error(detail);
    }
    const gd   = await gr.json();
    const graw = gd?.choices?.[0]?.message?.content || '';
    if (!graw) throw new Error('empty response');
    return extractJSON(graw);
  }

  /* ── Model queue — ordered by speed + accuracy ───────────── */

  const models = [
    { name: 'gemini-2.0-flash',          run: () => tryGemini('gemini-2.0-flash')          },
    { name: 'gemini-1.5-flash',          run: () => tryGemini('gemini-1.5-flash')          },
    { name: 'groq llama-3.3-70b',        run: () => tryGroq('llama-3.3-70b-versatile')     },
    { name: 'gemini-2.5-flash',          run: () => tryGemini('gemini-2.5-flash-preview-05-20') },
    { name: 'groq llama-3.1-8b',         run: () => tryGroq('llama-3.1-8b-instant')        },
  ];

  for (let i = 0; i < models.length; i++) {
    const { name, run } = models[i];
    try {
      if (i > 0) msg.textContent = 'Still analyzing…';
      const info = await run();
      fillFields(info);
      return; // success — stop here
    } catch (err) {
      // Always silent — never show API details to the user
      console.warn(`[AI] ${name} skipped: ${err.message}`);
    }
  }

  // All models failed
  msg.textContent = 'AI unavailable — please fill the fields manually';
  setTimeout(() => bar.classList.add('hidden'), 4000);
}


/* ##################################################################################### */

// /**
//  * ai.js
//  * AI-powered auto-fill for the Add Dua form.
//  *
//  * Tries Gemini models in order (2.5-flash → 2.0-flash → 1.5-flash),
//  * then falls back to Groq llama-3.1-8b-instant.
//  * Model names are never exposed to the user.
//  */

// let _aiTimer = null;

// /**
//  * Debounced handler called from the Arabic textarea oninput event.
//  * Waits 1.8 s of silence before firing the AI request.
//  */
// function onArabicInput() {
//   clearTimeout(_aiTimer);
//   const text = document.getElementById('inputTextAr').value.trim();
//   if (text.length < 10) return;
//   _aiTimer = setTimeout(() => autoFillDuaInfo(text), 1800);
// }

// /**
//  * Main AI autofill function.
//  * @param {string} arabicText
//  */
// async function autoFillDuaInfo(arabicText) {
//   const bar = document.getElementById('aiFillingBar');
//   const msg = document.getElementById('aiFillingMsg');
//   bar.classList.remove('hidden');
//   msg.textContent = 'Analyzing dua with AI…';

//   /* ── Shared helpers ─────────────────────────────────────── */

//   /** Extract a JSON object from potentially messy text. */
//   function extractJSON(raw) {
//     if (!raw) throw new Error('empty response');
//     const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
//     if (s === -1 || e === -1) throw new Error('No JSON object in: ' + raw.slice(0, 80));
//     return JSON.parse(raw.slice(s, e + 1));
//   }

//   /** Write AI results into form fields and show AI badges. */
//   function fillFields(info) {
//     let filled = 0;

//     function fill(inputId, badgeId, val) {
//       if (val && String(val).trim() && !document.getElementById(inputId).value.trim()) {
//         document.getElementById(inputId).value = String(val).trim();
//         document.getElementById(inputId).classList.add('field-validated');
//         document.getElementById(badgeId).classList.remove('hidden');
//         filled++;
//       }
//     }

//     fill('inputTranslit',    'translitBadge',    info.transliteration);
//     fill('inputTranslation', 'translationBadge', info.translation);
//     fill('inputSource',      'sourceBadge',      info.source);
//     fill('inputReference',   'referenceBadge',   info.reference);

//     if (info.category_hint) {
//       const slug = info.category_hint.trim().toLowerCase();
//       const cat  = state.categories.find(c => c.slug === slug || slug.includes(c.slug));
//       if (cat) document.getElementById('inputCategory').value = cat.id;
//     }

//     msg.textContent = filled > 0
//       ? `✓ AI filled ${filled} field${filled > 1 ? 's' : ''} — please review`
//       : '✓ Done — fill in any missing fields';

//     setTimeout(() => bar.classList.add('hidden'), 5000);
//   }

//   /* ── 1. Gemini models ────────────────────────────────────── */

//   const geminiSchema = {
//     type: 'object',
//     properties: {
//       transliteration: { type: 'string' },
//       translation:     { type: 'string' },
//       source:          { type: 'string' },
//       reference:       { type: 'string' },
//       category_hint:   { type: 'string' },
//     },
//     required: ['transliteration', 'translation', 'source', 'reference', 'category_hint'],
//   };

//   const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

//   for (let m = 0; m < geminiModels.length; m++) {
//     const model = geminiModels[m];
//     try {
//       if (m > 0) {
//         msg.textContent = 'Still analyzing…';
//         await new Promise(r => setTimeout(r, 1200));
//       }

//       const res = await fetch(
//         `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
//         {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({
//             contents: [{ parts: [{ text: `You are an Islamic scholar. Analyze this Arabic dua: ${arabicText}` }] }],
//             generationConfig: {
//               temperature: 0.1,
//               maxOutputTokens: 800,
//               responseMimeType: 'application/json',
//               responseSchema: geminiSchema,
//             },
//           }),
//         }
//       );

//       if (res.status === 429 || res.status === 503 || res.status === 404) {
//         console.warn(`Gemini ${model} skipped: HTTP ${res.status}`);
//         continue;
//       }

//       if (!res.ok) {
//         const body = await res.text();
//         let errMsg = `HTTP ${res.status}`;
//         try { errMsg = JSON.parse(body).error.message || errMsg; } catch (_) {}
//         msg.textContent = `Error: ${errMsg}`;
//         setTimeout(() => bar.classList.add('hidden'), 6000);
//         return;
//       }

//       const data = await res.json();
//       const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
//       if (!raw) { console.warn(`Gemini ${model}: empty response`); continue; }

//       fillFields(extractJSON(raw));
//       return;
//     } catch (err) {
//       console.warn(`Gemini ${model}:`, err.message);
//     }
//   }

//   /* ── 2. Groq fallback ────────────────────────────────────── */

//   msg.textContent = 'Analyzing dua with AI…';
//   try {
//     const prompt = `You are an Islamic scholar. For this Arabic dua return ONLY a raw JSON object — no markdown, no explanation:
// {"transliteration":"...","translation":"...","source":"Quran or Sunnah","reference":"...","category_hint":"one of: quran morning-evening forgiveness health family rizq knowledge jannah dhikr"}

// Dua: ${arabicText}`;

//     const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${GROQ_API_KEY}`,
//       },
//       body: JSON.stringify({
//         model: 'llama-3.1-8b-instant',
//         messages: [{ role: 'user', content: prompt }],
//         temperature: 0.1,
//         max_tokens: 600,
//       }),
//     });

//     if (!gr.ok) throw new Error(`HTTP ${gr.status}`);

//     const gd   = await gr.json();
//     const graw = gd?.choices?.[0]?.message?.content || '';
//     fillFields(extractJSON(graw));
//   } catch (err) {
//     console.error('Groq failed:', err.message);
//     msg.textContent = `AI unavailable — please fill fields manually`;
//     setTimeout(() => bar.classList.add('hidden'), 5000);
//   }
// }