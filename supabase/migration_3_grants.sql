-- ============================================================================
-- Migração 3 — libera o acesso básico às tabelas para o usuário autenticado
-- (as políticas de segurança (RLS) já estavam certas, mas faltava a permissão
--  de base do Postgres — sem isso, nem a política chega a ser avaliada).
-- Execute no SQL Editor do Supabase, um único "Run".
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
