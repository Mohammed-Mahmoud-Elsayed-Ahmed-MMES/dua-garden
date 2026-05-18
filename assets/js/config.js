const SUPABASE_URL     = 'https://loxcubuubveqgtsglllq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveGN1YnV1YnZlcWd0c2dsbGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjMxMTIsImV4cCI6MjA4Nzg5OTExMn0.oFf2oHcY1kroPl91Zew2guaXZAcSpGeHA8HleJz_zf0';

const GEMINI_API_KEY = 'AIzaSyBYAtJLkgbtlpmtsvn3eLankfdJxcsWprg';
const GROQ_API_KEY   = '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';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
