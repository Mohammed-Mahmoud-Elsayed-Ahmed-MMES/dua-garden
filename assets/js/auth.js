/**
 * auth.js
 * Handles all authentication flows: sign in, register, sign out,
 * session restoration, and auth UI updates across sidebar and drawer.
 */

/* ── Initialise Auth Session ─────────────────────────────────── */

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) await setUser(session.user);

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;

    if (event === 'SIGNED_IN' && session) {
      if (!state.user || state.user.id !== session.user.id) {
        await setUser(session.user);
        await loadDuas();
      }
    } else if (event === 'SIGNED_OUT') {
      state.user = null;
      state.favorites.clear();
      state.likedDuas.clear();
      state.likeCountCache = {};
      updateAuthUI();
      await loadDuas();
    }
  });
}

async function setUser(user) {
  state.user = user;
  state.likedDuas.clear();
  state.favorites.clear();
  await Promise.all([loadUserFavorites(), loadUserLikes()]);
  updateAuthUI();
}

/* ── Load User Data ──────────────────────────────────────────── */

async function loadUserLikes() {
  if (!state.user) return;
  const { data } = await db.from('likes').select('dua_id').eq('user_id', state.user.id);
  if (data) {
    state.likedDuas.clear();
    data.forEach(r => state.likedDuas.add(r.dua_id));
  }
}

async function loadUserFavorites() {
  if (!state.user) return;
  const { data } = await db.from('favorites').select('dua_id').eq('user_id', state.user.id);
  if (data) state.favorites = new Set(data.map(f => f.dua_id));
}

/* ── Auth UI ─────────────────────────────────────────────────── */

/**
 * Sync auth state across the desktop sidebar and the mobile drawer.
 */
function updateAuthUI() {
  const btn            = document.getElementById('authBtn');
  const sidebarContent = document.getElementById('authSidebarContent');
  const drawerContent  = document.getElementById('authDrawerContent');
  const favWrapper     = document.getElementById('favTabWrapper');
  const favWrapperDrawer = document.getElementById('favTabWrapperDrawer');

  if (state.user) {
    const email = state.user.email;
    btn.textContent = 'Sign Out';
    btn.onclick = signOut;

    if (favWrapper)       favWrapper.style.display = 'block';
    if (favWrapperDrawer) favWrapperDrawer.style.display = 'block';

    const userHTML = `
      <div class="auth-user">
        <div class="auth-avatar">${email[0].toUpperCase()}</div>
        <div class="auth-name">${email}</div>
        <div class="auth-email">Signed in</div>
        <button class="btn btn-ghost btn-sm" onclick="signOut()" style="color:var(--ink-muted);margin-top:10px">Sign Out</button>
      </div>`;

    if (sidebarContent) sidebarContent.innerHTML = userHTML;
    if (drawerContent)  drawerContent.innerHTML  = userHTML;
  } else {
    btn.textContent = 'Sign In';
    btn.onclick = openAuthModal;

    if (favWrapper)       favWrapper.style.display = 'none';
    if (favWrapperDrawer) favWrapperDrawer.style.display = 'none';

    const guestHTML = `
      <p style="font-size:13px;color:var(--ink-faint);margin-bottom:13px;line-height:1.5">Sign in to like and save duas.</p>
      <button class="btn btn-green btn-full" onclick="openAuthModal()">Sign In / Register</button>`;

    if (sidebarContent) sidebarContent.innerHTML = guestHTML;
    if (drawerContent)  drawerContent.innerHTML  = guestHTML;
  }
}

/* ── Sign In / Register ──────────────────────────────────────── */

async function handleAuth() {
  const email    = document.getElementById('modalEmail').value.trim();
  const password = document.getElementById('modalPassword').value;

  if (!email || !password) {
    showToast('Please enter email and password', 'error');
    return;
  }

  const btn = document.getElementById('authSubmitBtn');
  btn.textContent = 'Please wait…';
  btn.disabled = true;

  try {
    let error;
    if (state.authMode === 'signin') {
      ({ error } = await db.auth.signInWithPassword({ email, password }));
    } else {
      ({ error } = await db.auth.signUp({ email, password }));
      if (!error) showToast('Check your email to confirm!', 'success');
    }
    if (error) throw error;
    closeAuthModal();
    showToast('Welcome! You are signed in 🌿', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.authMode === 'signin' ? 'Sign In' : 'Create Account';
  }
}

async function signOut() {
  await db.auth.signOut();
  showToast('Signed out', 'success');
}

/* ── Modal Controls ──────────────────────────────────────────── */

function openAuthModal() {
  document.getElementById('authModal').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

function switchAuthTab(mode, btn) {
  state.authMode = mode;
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('authSubmitBtn').textContent =
    mode === 'signin' ? 'Sign In' : 'Create Account';
}

// Close modal when clicking the backdrop
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('authModal').addEventListener('click', (e) => {
    if (e.target.id === 'authModal') closeAuthModal();
  });
});