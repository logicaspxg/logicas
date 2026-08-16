LÓGICAS PXG V3.3

NOVO: bloqueio progressivo de tentativas de login (10s, 30s, 1m, 5m e 15m), contador visual e tratamento de rate limit 429 do Supabase.

Consulte README-V3.md para detalhes.

LÓGICAS PXG V3

As instruções completas estão no arquivo README-V3.md.
Comece por ele antes de configurar o Supabase.


V3.4: antes de testar Engraçado, contadores, usernames únicos e gestão de admins, rode MIGRATION-V3.4.sql uma vez no SQL Editor do Supabase.

V3.4.1: lista de acessos mostra apenas admins; usuários comuns são pesquisados por nome; cadastro não anuncia conta nova em resposta ofuscada de e-mail já existente. Não exige nova migração SQL após V3.4.


V3.5: Execute MIGRATION-V3.5.sql uma vez para ativar upload de imagens de capa no Supabase Storage.
