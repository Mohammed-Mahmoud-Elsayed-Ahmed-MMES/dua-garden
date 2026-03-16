/**
 * duas.js
 * All dua-related operations: loading, rendering cards, liking,
 * favoriting, copying, submitting new duas, and deleting.
 */

/* ── Loading ─────────────────────────────────────────────────── */

async function loadDuas() {
  document.getElementById('duasList').innerHTML =
    '<div class="loading"><div class="loading-spinner"></div><p>Loading duas…</p></div>';
  document.getElementById('favoritesSection').classList.add('hidden');

  if (state.viewingFavorites) {
    if (!state.user) { openAuthModal(); return; }
    await renderFavoritesPage();
    return;
  }

  let query = db
    .from('duas')
    .select('*, categories(name,slug,icon)')
    .eq('status', 'approved');

  if (state.currentCategory !== 'all') {
    const cat = state.categories.find(c => c.slug === state.currentCategory);
    if (cat) query = query.eq('category_id', cat.id);
  }

  query = state.sortBy === 'likes'
    ? query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });

  const { data, error } = await query.limit(80);
  if (error) { showToast('Failed to load duas', 'error'); return; }

  // Apply optimistic like-count cache
  data.forEach(d => {
    const cached = state.likeCountCache[d.id];
    if (cached !== undefined && cached > d.like_count) d.like_count = cached;
    else state.likeCountCache[d.id] = d.like_count;
  });

  state.duas = data;

  // Show pinned favorites strip on the "All Duas" view
  if (state.user && state.favorites.size > 0 && state.currentCategory === 'all') {
    const favDuas = data.filter(d => state.favorites.has(d.id));
    if (favDuas.length > 0) {
      document.getElementById('favoritesSection').classList.remove('hidden');
      document.getElementById('favCount').textContent = favDuas.length;
      document.getElementById('favoritesList').innerHTML = favDuas.map((d, i) => renderDuaCard(d, i)).join('');
    }
  }

  renderDuas();
}

async function renderFavoritesPage() {
  if (!state.user || state.favorites.size === 0) {
    document.getElementById('duasList').innerHTML =
      '<div class="empty-state"><span class="empty-icon">⭐</span><h3>No favorites yet</h3><p>Browse duas and tap Save to add them here</p></div>';
    return;
  }

  const { data, error } = await db
    .from('duas')
    .select('*, categories(name,slug,icon)')
    .in('id', [...state.favorites])
    .eq('status', 'approved');

  if (error || !data) {
    document.getElementById('duasList').innerHTML =
      '<div class="empty-state"><span class="empty-icon">⭐</span><h3>Could not load favorites</h3></div>';
    return;
  }

  state.duas = data;
  renderDuas();
}

/* ── Sorting ─────────────────────────────────────────────────── */

function setSort(sort, btn) {
  state.sortBy = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadDuas();
}

/* ── Rendering ───────────────────────────────────────────────── */

function renderDuas() {
  const list = document.getElementById('duasList');

  if (!state.duas.length) {
    list.innerHTML =
      '<div class="empty-state"><span class="empty-icon">🌿</span><h3>No duas found</h3><p>Be the first to contribute in this category</p></div>';
    return;
  }

  const sorted = [...state.duas].sort((a, b) =>
    state.sortBy === 'likes'
      ? ((b.like_count || 0) - (a.like_count || 0)) || (new Date(b.created_at) - new Date(a.created_at))
      : new Date(b.created_at) - new Date(a.created_at)
  );

  list.innerHTML = sorted.map((d, i) => renderDuaCard(d, i)).join('');
}

/**
 * Build the HTML string for a single dua card.
 * @param {Object} dua
 * @param {number} index - used for staggered animation delay
 */
function renderDuaCard(dua, index) {
  const isLiked = state.likedDuas.has(dua.id);
  const isFav   = state.favorites.has(dua.id);
  const isOwn   = !!(state.user && dua.submitted_by === state.user.id);
  const cat     = dua.categories;
  const delay   = Math.min(index * 40, 350);
  const count   = dua.like_count || 0;

  const likeLabel =
    count === 0 ? (isLiked ? 'You liked this' : 'Like') :
    isLiked
      ? (count === 1 ? 'You liked this' : `You and ${count - 1} other${count - 1 > 1 ? 's' : ''}`)
      : `${count} like${count > 1 ? 's' : ''}`;

  const likeClick = state.user ? `toggleLike('${dua.id}')` : `promptSignIn('like')`;
  const saveClick = state.user ? `toggleFavorite('${dua.id}')` : `promptSignIn('save')`;

  return `
<div class="dua-card ${isFav ? 'is-favorited' : ''}" id="dua-${dua.id}" style="animation-delay:${delay}ms">
  ${cat ? `<div class="dua-category-tag">${cat.icon || '📖'} ${cat.name}</div>` : ''}
  ${dua.text_ar ? `<div class="dua-text-ar">${dua.text_ar}</div>` : ''}
  ${dua.transliteration ? `<div class="dua-transliteration">${dua.transliteration}</div>` : ''}
  ${dua.translation ? `<div class="dua-translation">${dua.translation}</div>` : ''}
  ${(dua.source || dua.reference) ? `
  <div class="dua-source">
    ${dua.source ? `<span class="dua-source-badge">📚 ${dua.source}</span>` : ''}
    ${dua.reference ? `<span>${dua.reference}</span>` : ''}
  </div>` : ''}
  <div class="dua-actions">
    <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="${likeClick}" id="like-btn-${dua.id}">
      <svg viewBox="0 0 24 24" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <span id="like-label-${dua.id}">${likeLabel}</span>
    </button>
    <button class="action-btn save-btn ${isFav ? 'saved' : ''}" onclick="${saveClick}" id="save-btn-${dua.id}">
      <svg viewBox="0 0 24 24" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>${isFav ? 'Saved' : 'Save'}</span>
    </button>
    <button class="action-btn" onclick="copyDua('${dua.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Copy
    </button>
    ${!state.user ? '<span class="guest-hint">Sign in to like &amp; save</span>' : ''}
    ${isOwn ? `<button class="action-btn delete-btn" onclick="confirmDelete('${dua.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      Delete
    </button>` : ''}
  </div>
  ${isOwn ? '<div class="owner-badge">✏️ Added by you</div>' : ''}
</div>`;
}

/* ── Prompts ─────────────────────────────────────────────────── */

function promptSignIn(action) {
  showToast(`Sign in to ${action} duas`, 'warning');
  openAuthModal();
}

/* ── Likes ───────────────────────────────────────────────────── */

async function toggleLike(duaId) {
  if (!state.user) { promptSignIn('like'); return; }

  const isLiked = state.likedDuas.has(duaId);
  const dua     = state.duas.find(d => d.id === duaId);

  // Optimistic update
  if (isLiked) {
    state.likedDuas.delete(duaId);
    if (dua) dua.like_count = Math.max(0, (dua.like_count || 0) - 1);
  } else {
    state.likedDuas.add(duaId);
    if (dua) dua.like_count = (dua.like_count || 0) + 1;
  }
  if (dua) state.likeCountCache[duaId] = dua.like_count;

  updateLikeUI(duaId, dua);
  renderDuas();

  try {
    if (isLiked) {
      await db.rpc('remove_like', { p_dua_id: duaId, p_user_id: state.user.id, p_anon_id: null });
    } else {
      await db.rpc('add_like', { p_dua_id: duaId, p_user_id: state.user.id, p_anon_id: null });
    }
  } catch {
    // Roll back optimistic update
    if (isLiked) {
      state.likedDuas.add(duaId);
      if (dua) dua.like_count = (dua.like_count || 0) + 1;
    } else {
      state.likedDuas.delete(duaId);
      if (dua) dua.like_count = Math.max(0, (dua.like_count || 0) - 1);
    }
    if (dua) state.likeCountCache[duaId] = dua.like_count;
    updateLikeUI(duaId, dua);
    renderDuas();
    showToast('Could not save like, please try again', 'error');
  }
}

function updateLikeUI(duaId, dua) {
  const isLiked = state.likedDuas.has(duaId);
  const count   = dua ? dua.like_count || 0 : 0;
  const label   =
    count === 0 ? (isLiked ? 'You liked this' : 'Like') :
    isLiked
      ? (count === 1 ? 'You liked this' : `You and ${count - 1} other${count - 1 > 1 ? 's' : ''}`)
      : `${count} like${count > 1 ? 's' : ''}`;

  document.querySelectorAll(`#like-btn-${duaId}`).forEach(btn => {
    btn.classList.toggle('liked', isLiked);
    const svg = btn.querySelector('svg');
    svg.style.fill   = isLiked ? '#e0245e' : 'none';
    svg.style.stroke = isLiked ? '#e0245e' : 'currentColor';
  });
  document.querySelectorAll(`#like-label-${duaId}`).forEach(el => { el.textContent = label; });
}

/* ── Favorites ───────────────────────────────────────────────── */

async function toggleFavorite(duaId) {
  if (!state.user) { promptSignIn('save'); return; }

  const isFav = state.favorites.has(duaId);
  if (isFav) state.favorites.delete(duaId); else state.favorites.add(duaId);
  updateSaveUI(duaId);

  try {
    if (isFav) {
      await db.from('favorites').delete().eq('dua_id', duaId).eq('user_id', state.user.id);
      showToast('Removed from favorites');
    } else {
      await db.from('favorites').insert({ dua_id: duaId, user_id: state.user.id });
      showToast('Saved to favorites ⭐', 'success');
    }
  } catch {
    if (isFav) state.favorites.add(duaId); else state.favorites.delete(duaId);
    updateSaveUI(duaId);
    showToast('Failed to update favorites', 'error');
  }
}

function updateSaveUI(duaId) {
  const isFav = state.favorites.has(duaId);
  document.querySelectorAll(`#save-btn-${duaId}`).forEach(btn => {
    btn.classList.toggle('saved', isFav);
    const svg = btn.querySelector('svg');
    svg.style.fill   = isFav ? 'var(--gold)' : 'none';
    svg.style.stroke = isFav ? 'var(--gold-dark)' : 'currentColor';
    btn.querySelector('span').textContent = isFav ? 'Saved' : 'Save';
  });
  document.querySelectorAll(`#dua-${duaId}`).forEach(card => {
    card.classList.toggle('is-favorited', isFav);
  });
}

/* ── Copy ────────────────────────────────────────────────────── */

function copyDua(duaId) {
  const dua = state.duas.find(d => d.id === duaId);
  if (!dua) return;
  const text = [dua.text_ar, dua.transliteration, dua.translation, dua.reference ? `Reference: ${dua.reference}` : '']
    .filter(Boolean)
    .join('\n\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast('Dua copied 📋', 'success'))
    .catch(() => showToast('Could not copy', 'error'));
}

/* ── Add Dua Form ────────────────────────────────────────────── */

function toggleAddForm() {
  if (!state.user) {
    showToast('Please sign in to share a dua', 'warning');
    openAuthModal();
    return;
  }
  const form   = document.getElementById('addDuaForm');
  const toggle = document.getElementById('addDuaToggle');
  const isOpen = form.classList.toggle('open');
  toggle.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) clearAiBadges();
}

function clearAiBadges() {
  ['translitBadge', 'translationBadge', 'sourceBadge', 'referenceBadge']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
  ['inputTranslit', 'inputTranslation', 'inputSource', 'inputReference']
    .forEach(id => document.getElementById(id).classList.remove('field-validated'));
}

/* ── Submit Dua ──────────────────────────────────────────────── */

let _forceSubmit = false;

async function submitDua() {
  const textAr      = document.getElementById('inputTextAr').value.trim();
  const categoryId  = document.getElementById('inputCategory').value;
  const translit    = document.getElementById('inputTranslit').value.trim();
  const translation = document.getElementById('inputTranslation').value.trim();
  const source      = document.getElementById('inputSource').value.trim();
  const reference   = document.getElementById('inputReference').value.trim();

  // Validation
  document.getElementById('arabicError').classList.add('hidden');
  document.getElementById('inputTextAr').classList.remove('error');
  if (!textAr) {
    document.getElementById('arabicError').classList.remove('hidden');
    document.getElementById('inputTextAr').classList.add('error');
    showToast('Please enter the Arabic text', 'error');
    return;
  }

  // Duplicate check
  if (!_forceSubmit) {
    const dup = await findDuplicate(textAr);
    if (dup) {
      const d   = dup.dua;
      const cat = d.categories;
      const preview =
        (cat ? `<div style="font-size:10px;font-weight:600;color:var(--sage);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${cat.icon || ''} ${cat.name}</div>` : '') +
        (d.text_ar ? `<div style="font-family:Amiri,serif;font-size:18px;direction:rtl;text-align:right;color:var(--deep-green);line-height:1.8;margin-bottom:8px">${d.text_ar}</div>` : '') +
        (d.translation ? `<div style="font-size:12px;color:var(--ink-muted);line-height:1.5">${d.translation}</div>` : '') +
        ((d.source || d.reference) ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:6px">${[d.source, d.reference].filter(Boolean).join(' — ')}</div>` : '');
      document.getElementById('duplicateCardPreview').innerHTML = preview;
      document.getElementById('duplicateModal').style.display = 'flex';
      return;
    }
  }
  _forceSubmit = false;

  const btn = document.getElementById('submitDuaBtn');
  btn.textContent = 'Submitting…';
  btn.disabled    = true;

  const payload = { text: textAr, text_ar: textAr, status: 'approved', like_count: 0 };
  if (translit)    payload.transliteration = translit;
  if (translation) payload.translation     = translation;
  if (source)      payload.source          = source;
  if (reference)   payload.reference       = reference;
  if (categoryId)  payload.category_id     = categoryId;
  if (state.user)  payload.submitted_by    = state.user.id;

  try {
    const { error } = await db.from('duas').insert(payload);
    if (error) throw error;
    showToast('Your dua has been shared! JazakAllahu Khayran 🌿', 'success');
    ['inputTextAr', 'inputTranslit', 'inputTranslation', 'inputSource', 'inputReference']
      .forEach(id => { document.getElementById(id).value = ''; });
    clearAiBadges();
    toggleAddForm();
    await loadDuas();
  } catch (err) {
    showToast('Failed to submit: ' + err.message, 'error');
  } finally {
    btn.textContent = '🌿 Submit Dua';
    btn.disabled    = false;
  }
}

/* ── Delete Dua ──────────────────────────────────────────────── */

let _pendingDeleteId = null;

function confirmDelete(duaId) {
  _pendingDeleteId = duaId;
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() {
  _pendingDeleteId = null;
  document.getElementById('confirmModal').style.display = 'none';
}

async function doDelete() {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  closeConfirm();

  try {
    await db.from('favorites').delete().eq('dua_id', id);
    await db.from('likes').delete().eq('dua_id', id);
    const { error } = await db.from('duas').delete().eq('id', id).eq('submitted_by', state.user.id);
    if (error) throw error;

    const card = document.getElementById(`dua-${id}`);
    if (card) {
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(.95)';
      setTimeout(() => card.remove(), 300);
    }

    state.duas = state.duas.filter(d => d.id !== id);
    delete state.likeCountCache[id];
    showToast('Dua deleted', 'success');
  } catch (err) {
    showToast('Could not delete: ' + err.message, 'error');
  }
}