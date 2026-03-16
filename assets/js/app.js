/**
 * app.js
 * Application entry point. Boots the app in the correct order:
 * categories → auth → duas → realtime.
 *
 * Script load order in index.html must be:
 *   config.js → state.js → ui.js → auth.js → drawer.js
 *   → categories.js → duplicate.js → ai.js → duas.js → pdf.js → app.js
 */

async function init() {
  await loadCategories();
  await initAuth();
  await loadDuas();
  initRealtime();
}

init().catch(console.error);