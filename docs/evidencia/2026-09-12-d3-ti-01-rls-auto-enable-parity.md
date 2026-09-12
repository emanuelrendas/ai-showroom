# D3-TI-01, remediação de paridade, rls_auto_enable() e ensure_rls

- Data, 12 SET 2026
- Fonte da verificação de drift, Control Tower, Cowork, Sonnet 5, leitura estrita
  de catálogo no Supabase yljvselkecxdfrqwyums (ai-showroom), autorizada por
  Emanuel em 12 SET 2026
- Escritor deste PR, Tiago, autorização de Emanuel de 12 SET 2026, transferência
  pontual de Writer Slot por bloqueio 403 do conector GitHub do Control Tower

## Achado

Produção (yljvselkecxdfrqwyums) tem uma função real `public.rls_auto_enable()`,
`RETURNS event_trigger`, `SECURITY DEFINER`, `search_path` fixo em `pg_catalog`,
dono `postgres`, ligada a um event trigger ativo `ensure_rls` em
`ddl_command_end` sobre `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`.
Nenhuma migração do repositório cria esta função ou este trigger. A migração
`20260901152700_create_missing_rls_auto_enable_stub.sql` cria um stub vazio,
`RETURNS void`, nunca aplicado ao remoto. A migração
`20260901152756_lock_down_auto_rls_function.sql`, essa aplicada, revoga EXECUTE
da função para `public`, `anon`, `authenticated`, e correu com sucesso porque a
função real já existia em produção fora da cadeia de migrações.

## Consequência técnica do REVOKE já aplicado

Sem efeito prático. Event triggers correm automaticamente sob o dono do
trigger, não por invocação direta, e o tipo de retorno `event_trigger` já
impede um `SELECT` direto. `152756` é inofensiva e inconsequente.

## Risco real

Qualquer ambiente construído a partir das migrações do repositório, local,
branch, staging, nasce sem `ensure_rls`. Tabelas novas nesse ambiente não
ganham RLS automático. Não é P0, produção está protegida pelo mecanismo ativo.
É dívida de paridade e de custódia.

## Proveniência

NÃO VERIFICADA. A função real entrou em produção fora de qualquer migração
lida até agora. Este documento não resolve essa proveniência, só regista o
facto.

## Revisão de segurança desta migração de reconciliação

1. Dono, fica como quem correr a migração de facto, não fixado a `postgres`
   neste ficheiro.
2. `search_path` fixo em `pg_catalog`, mantido igual ao observado em produção.
3. Privilégios, zero EXECUTE concedido a `public`, `anon`, `authenticated`,
   réplica do estado observado.
4. Âmbito do trigger, limitado a `public`, `CREATE TABLE`, `CREATE TABLE AS`,
   `SELECT INTO`, idêntico ao vivo.
5. Comportamento, a função engole qualquer exceção ao tentar ligar RLS e só
   regista log, a tabela nova pode ficar sem RLS em silêncio se a ativação
   falhar. Reproduzido fielmente porque o objetivo é paridade, não melhoria.
   Fica como achado a decidir por Emanuel, não corrigido aqui.

## Estado

Sem aplicação a nenhum Supabase remoto. Só repositório. Sem merge.
