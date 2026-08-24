/* ===========================================================================
   supabaseClient.js — conexão com o banco de dados compartilhado (Supabase)
   =========================================================================== */

const SUPABASE_URL = 'https://mntfjyskryflbgmyxwvq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fRYihAyquI3C59oYwIJDxg_aDFOtMss';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
