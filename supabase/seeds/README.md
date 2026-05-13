# Seeds — Dados Iniciais do Sistema

Esta pasta contém scripts SQL para inicialização manual de dados essenciais.
Os seeds **não são executados automaticamente** — devem ser rodados manualmente pelo administrador do banco.

## seed_admin.sql — Definição do Primeiro Admin

### Por que isso existe?
Por segurança, nenhum usuário recebe a role `admin` automaticamente ao se cadastrar.
O admin inicial deve ser definido manualmente por quem tem acesso ao banco de dados.

### Como usar

1. Acesse o [Supabase SQL Editor](https://supabase.com/dashboard/project/rgikyyazotqapaxijwui/sql)
2. Abra o arquivo `seed_admin.sql`
3. Substitua `SEU_EMAIL_ADMIN@dominio.com` pelo e-mail do admin desejado
4. Execute o script
5. Confira o resultado — deve retornar `Sucesso: seu-email@dominio.com agora é admin do sistema.`

### Proteções da função `set_first_admin`
- ✅ Só funciona se **não existir nenhum admin** cadastrado
- ✅ Retorna erro descritivo se o usuário não for encontrado
- ✅ Retorna erro se já existir um admin (evita sobrescrita acidental)
- ✅ Declarada como `SECURITY DEFINER` — só pode ser chamada por quem tem acesso ao SQL Editor

### Após o primeiro admin estar definido
Novos admins devem ser promovidos pelo próprio painel de administração da aplicação,
não por este script.
