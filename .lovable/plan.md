## Plano de correção

1. **Ajustar a rotina de troca obrigatória**
   - Revisar `ForcePasswordChange.tsx` para garantir que a sessão esteja válida antes de chamar a troca de senha.
   - Substituir a chamada direta `updateUser({ password })` por uma rotina mais robusta que confirma a sessão atual e trata expiração/autenticação de forma clara.
   - Manter a tela bloqueando o acesso enquanto `must_change_password = true`, mas permitir concluir a troca quando a senha nova for válida.

2. **Corrigir a finalização da obrigatoriedade**
   - Após a senha ser alterada com sucesso, atualizar `profiles.must_change_password = false`.
   - Validar se essa atualização falhou; se falhar, mostrar mensagem correta em vez de deixar o usuário preso na tela.
   - Forçar recarregamento do perfil após sucesso para liberar o acesso imediatamente.

3. **Melhorar diagnóstico do erro 422**
   - Registrar no console apenas dados seguros do erro (`code`, `status`, `message`) para identificar se é política de senha, sessão expirada ou bloqueio da API.
   - Trocar a mensagem genérica por mensagens objetivas em PT-BR, incluindo caso de sessão expirada e senha recusada por política de segurança.

4. **Revisar o fluxo de autenticação relacionado**
   - Conferir `AuthContext`/`ProtectedRoute` para evitar que a tela de troca obrigatória rode antes da sessão estar totalmente carregada.
   - Não alterar login, permissões ou reset por link além do necessário para estabilizar essa rotina.

5. **Validação esperada**
   - Usuário com `must_change_password = true` entra com senha temporária.
   - Informa uma senha nova diferente.
   - A senha é gravada, `must_change_password` vira `false`, o perfil é atualizado e o usuário segue para o sistema.
   - Se a senha for recusada pela política do backend, a tela informa claramente o motivo.