/**
 * drawer.js
 * Mobile / tablet sliding category drawer.
 * The desktop sidebar is hidden via CSS below 1024px and replaced
 * by a floating action button that opens this drawer from the right.
 */

function openDrawer() {
  document.getElementById('catDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeDrawer() {
  document.getElementById('catDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}