-- ============================================================
-- LÓGICAS PXG V3.6.1 — DESATIVAR DENÚNCIAS
-- Preserva a tabela e o histórico, mas bloqueia novos registros.
-- ============================================================

revoke insert on public.profile_reports from authenticated;

-- Para reativar no futuro:
-- 1. Troque REPORTS_ENABLED para true em script.js e admin.js.
-- 2. Execute: grant insert on public.profile_reports to authenticated;


