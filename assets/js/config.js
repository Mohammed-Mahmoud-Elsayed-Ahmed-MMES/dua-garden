/**
 * config.js
 * Supabase client initialisation and API keys.
 *
 * ⚠️  For production: move keys to environment variables
 *     and use a build tool (Vite / Webpack) to inject them.
 *     The Supabase anon key is safe to expose in client code;
 *     it is protected by Row-Level Security policies.
 */

const SUPABASE_URL     = 'https://loxcubuubveqgtsglllq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveGN1YnV1YnZlcWd0c2dsbGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjMxMTIsImV4cCI6MjA4Nzg5OTExMn0.oFf2oHcY1kroPl91Zew2guaXZAcSpGeHA8HleJz_zf0';

const GEMINI_API_KEY = 'AIzaSyBYAtJLkgbtlpmtsvn3eLankfdJxcsWprg';
const GROQ_API_KEY   = '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';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
