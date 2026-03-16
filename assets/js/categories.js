/**
 * categories.js
 * Loads categories from Supabase, renders them in both the desktop
 * sidebar and the mobile drawer, and handles category selection.
 */

/* ── Load from DB ────────────────────────────────────────────── */

async function loadCategories() {
  const { data, error } = await db.from('categories').select('*').order('sort_order');
  if (error || !data) return;
  state.categories = data;
  renderCategories();
  populateCategorySelect();
}

/* ── Render Category Lists ───────────────────────────────────── */

/**
 * Build a category button string.
 * @param {string} slug
 * @param {string} icon
 * @param {string} name
 * @param {boolean} fromDrawer - determines the onclick target
 */
function _makeCatBtn(slug, icon, name, fromDrawer) {
  const active = state.currentCategory === slug ? 'active' : '';
  const handler = fromDrawer
    ? `selectCategory('${slug}',this,true)`
    : `selectCategory('${slug}',this)`;
  return `<button class="category-item ${active}" onclick="${handler}">
    <span class="cat-icon">${icon}</span>
    <span class="cat-name">${name}</span>
  </button>`;
}

/**
 * Re-renders both the sidebar list and the drawer list.
 */
function renderCategories() {
  const allSidebar = _makeCatBtn('all', '🌟', 'All Duas', false);
  const allDrawer  = _makeCatBtn('all', '🌟', 'All Duas', true);

  const catsSidebar = state.categories.map(c => _makeCatBtn(c.slug, c.icon || '📖', c.name, false)).join('');
  const catsDrawer  = state.categories.map(c => _makeCatBtn(c.slug, c.icon || '📖', c.name, true)).join('');

  document.getElementById('categoryList').innerHTML = allSidebar + catsSidebar;

  const drawerList = document.getElementById('categoryListDrawer');
  if (drawerList) drawerList.innerHTML = allDrawer + catsDrawer;
}

/**
 * Populate the category <select> inside the Add Dua form.
 */
function populateCategorySelect() {
  document.getElementById('inputCategory').innerHTML = state.categories
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join('');
}

/* ── Category Selection ──────────────────────────────────────── */

/**
 * Select a category and reload duas.
 * @param {string} slug - category slug or 'all' or '__favorites__'
 * @param {HTMLElement} btn - the clicked button element
 * @param {boolean} [fromDrawer=false] - true when triggered from the drawer
 */
async function selectCategory(slug, btn, fromDrawer = false) {
  state.currentCategory   = slug;
  state.viewingFavorites  = slug === '__favorites__';

  // Deactivate all buttons in both panels
  document.querySelectorAll('.category-item, .favorites-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Sync the same item in the other panel
  const otherId   = fromDrawer ? 'categoryList' : 'categoryListDrawer';
  const otherList = document.getElementById(otherId);
  if (otherList && btn) {
    const targetName = btn.querySelector('.cat-name')?.textContent;
    otherList.querySelectorAll('.category-item').forEach(b => {
      if (b.querySelector('.cat-name')?.textContent === targetName) b.classList.add('active');
    });
  }

  // Update page title
  const cat = state.categories.find(c => c.slug === slug);
  const title =
    slug === 'all'           ? 'All Duas'     :
    slug === '__favorites__' ? 'My Favorites' :
    cat ? cat.name : slug;

  document.getElementById('pageTitle').textContent = title;

  // Update floating button label
  const fabLabel = document.getElementById('catFabLabel');
  if (fabLabel) fabLabel.textContent = slug === 'all' ? 'Categories' : title;

  if (fromDrawer) closeDrawer();

  await loadDuas();
}