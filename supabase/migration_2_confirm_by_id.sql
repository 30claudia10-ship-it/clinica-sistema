-- ============================================================================
-- Migração 2 — confirmação de sessão a partir do link geral do paciente
-- (o link geral do paciente usa um token sem consumption_id; esta função
--  valida esse token e confirma UMA sessão específica pelo id informado,
--  checando que ela realmente pertence ao paciente do token).
-- Execute no SQL Editor do Supabase, um único "Run".
-- ============================================================================

create or replace function portal_confirm_session_by_id(p_token text, p_consumption_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_owner uuid;
begin
  select patient_id into v_patient_id
  from portal_tokens
  where token = p_token
    and consumption_id is null
    and revoked = false
    and (expires_at is null or expires_at > now());

  if v_patient_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token inválido ou expirado.');
  end if;

  select patient_id into v_owner from consumptions where id = p_consumption_id and type = 'fechado';
  if v_owner is null or v_owner <> v_patient_id then
    return jsonb_build_object('ok', false, 'error', 'Esta sessão não pertence a este paciente.');
  end if;

  update consumptions
  set confirmation_status = 'confirmado', confirmed_at = now()
  where id = p_consumption_id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function portal_confirm_session_by_id(text, uuid) to anon;
