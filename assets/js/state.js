/**
 * state.js
 * Single source of truth for all runtime application state.
 * All modules read from and write to this shared object.
 */

const state = {
  /** @type {import('@supabase/supabase-js').User|null} */
  user: null,

  /** @type {Array<{id:string, name:string, slug:string, icon:string, sort_order:number}>} */
  categories: [],

  /** @type {Array<Object>} Currently displayed duas */
  duas: [],

  /** @type {Set<string>} IDs of duas the user has favorited */
  favorites: new Set(),

  /** @type {Set<string>} IDs of duas the user has liked */
  likedDuas: new Set(),

  /** @type {Object<string, number>} Optimistic like-count cache keyed by dua ID */
  likeCountCache: {},

  /** @type {string} Active category slug, or 'all' */
  currentCategory: 'all',

  /** @type {'likes'|'newest'} Active sort order */
  sortBy: 'likes',

  /** @type {'signin'|'register'} Active auth modal tab */
  authMode: 'signin',

  /** @type {boolean} True when the favorites tab is selected */
  viewingFavorites: false,
};