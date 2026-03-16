/**
 * ui.js
 * Reusable UI utilities: toast notifications and real-time updates.
 */

/* ── Toast Notifications ─────────────────────────────────────── */

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ── Real-time Supabase Subscription ─────────────────────────── */

/**
 * Subscribe to live INSERT and UPDATE events on the duas table.
 * Automatically updates the UI when other users add or like duas.
 */
function initRealtime() {
  db.channel('duas-live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'duas', filter: 'status=eq.approved' },
      async (payload) => {
        const { data } = await db
          .from('duas')
          .select('*, categories(name,slug,icon)')
          .eq('id', payload.new.id)
          .single();

        if (!data) return;

        const activeCategory = state.categories.find(c => c.slug === state.currentCategory);
        const matchesCat =
          state.currentCategory === 'all' ||
          (activeCategory && activeCategory.id === data.category_id);

        if (matchesCat) {
          if (state.sortBy === 'newest') {
            state.duas = [data, ...state.duas];
          } else {
            state.duas = [...state.duas, data].sort((a, b) => b.like_count - a.like_count);
          }
          renderDuas();
          showToast('✨ New dua added!', 'success');
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'duas' },
      (payload) => {
        const updated = payload.new;
        const idx = state.duas.findIndex(d => d.id === updated.id);
        if (idx !== -1) {
          state.duas[idx].like_count = updated.like_count;
          state.likeCountCache[updated.id] = updated.like_count;
          updateLikeUI(updated.id, state.duas[idx]);
          renderDuas();
        }
      }
    )
    .subscribe((status) => {
      const dot = document.getElementById('realtimeStatus');
      if (dot) dot.style.color = status === 'SUBSCRIBED' ? 'var(--success)' : 'var(--ink-faint)';
    });
}