## Plano de correção

1. **Ajustar a regra de duplicidade na criação manual**
   - Trocar a validação atual de duplicidade para considerar apenas: **time + RHM + projeto**.
   - Remover da decisão de bloqueio os campos título, tipo e SLA.
   - Alterar a mensagem para algo claro: “Já existe uma demanda com este número neste projeto.”

2. **Corrigir a regra no banco para refletir o mesmo comportamento**
   - Substituir a restrição atual `UNIQUE(team_id, rhm)`, que bloqueia o mesmo RHM em projetos diferentes.
   - Criar uma regra única por **time + RHM + projeto** usando `project_id` quando existir e o nome do projeto como fallback para registros antigos.
   - Manter os dados existentes; não remover tabelas nem colunas.

3. **Revisar a importação/migração de demandas**
   - Atualizar o `upsert_demandas_batch` para procurar demanda existente por **RHM + projeto**, não apenas por RHM.
   - Assim, uma planilha com o mesmo RHM em outro projeto cria nova demanda; se for o mesmo RHM e mesmo projeto, atualiza a demanda correta.

4. **Corrigir a consulta por RHM**
   - A tela “Consultar Demandas” hoje filtra apenas as demandas já carregadas na paginação; se a demanda estiver em uma página ainda não carregada, a busca retorna 0.
   - Ajustar a busca para consultar no backend quando o usuário informar RHM/projeto/título, garantindo que o RHM `26925` seja encontrado se existir no time/projeto acessível.

5. **Validar o caso reportado**
   - Conferir que criar `26925` no mesmo projeto bloqueia.
   - Conferir que criar `26925` em outro projeto permite.
   - Conferir que consultar por `26925` retorna a demanda correta quando ela existir no escopo do usuário.