## Diagnóstico do problema

**Sei qual é o problema? Sim.** O módulo não está falhando por um único motivo; há uma combinação de configuração incorreta, fallback incompleto e pouca observabilidade na tela.

### 1. A última chamada não usou GPT
Na requisição capturada do navegador, o módulo enviou este provedor:

```text
providerId: Gemini 1.5 Flash
```

Ou seja: mesmo você tendo GPT cadastrado com chave paga, a chamada analisada foi para o **Gemini recomendado**, não para o GPT. Isso explica por que o erro visto nos logs é do Gemini e não da OpenAI.

### 2. O Gemini recomendado está configurado com modelo que falha
O backend registrou:

```text
Gemini [404]: models/gemini-1.5-flash is not found for API version v1beta
```

Isso significa que o provedor ativo/recomendado está apontando para um modelo que a API atual do Gemini não aceita mais nessa rota. Enquanto esse provedor continuar recomendado, o sistema tende a escolher ele primeiro e falhar.

### 3. O fallback para GPT não está confiável
Pelo código, deveria haver fallback automático para outro provedor ativo. Porém, a resposta do backend voltou genérica:

```text
Não foi possível gerar o documento agora. Tente novamente em alguns instantes.
```

E não trouxe a lista detalhada de tentativas. Isso indica que a falha está sendo engolida pelo tratamento genérico de erro ou que a versão implantada da função ainda não está refletindo totalmente o fallback esperado.

### 4. O prompt enviado começa com `undefined`
A requisição capturada mostra:

```text
"prompt":"undefined\n\n---\nDADOS DE ENTRADA..."
```

Isso é grave: o módulo está tentando ler `prompt_template`, mas os templates do banco usam `prompt_content`. Resultado: a IA recebe os arquivos, mas pode ficar sem as instruções principais do template. Mesmo quando a IA responde, a qualidade do relatório fica comprometida.

### 5. A tela pode ficar “Gerando...” sem saída clara
O frontend não tem timeout/controlador de travamento para a chamada de geração. Se a API externa demora, trava, limita requisição ou o backend demora a responder, a tela fica esperando e o usuário não recebe uma mensagem operacional clara.

### 6. O Admin mostra chave configurada, mas não testa se ela funciona
Hoje o cadastro em **Admin → IAs** informa se existe uma chave salva, mas não valida:

- se a chave é realmente aceita pela OpenAI/Gemini;
- se o modelo existe;
- se há crédito/quota;
- se o provedor responde com sucesso.

Por isso o painel pode passar a sensação de “está tudo configurado”, mas o módulo só descobre o problema na hora de gerar.

---

## Plano de correção recomendado

### Etapa 1 — Corrigir configuração dos provedores
- Atualizar o modelo Gemini recomendado para um modelo atual e suportado.
- Garantir que o GPT cadastrado com chave paga possa ser selecionado e realmente enviado na geração.
- Ajustar a ordem de recomendação para evitar que um Gemini quebrado seja escolhido automaticamente.

### Etapa 2 — Corrigir o prompt do módulo Gerar HU / Relatório Enterprise
- Trocar o uso direto de `prompt_template` por uma resolução segura:

```text
prompt_template ?? prompt_content ?? ""
```

- Impedir geração se o template estiver sem conteúdo real.
- Exibir erro claro: “Template sem prompt configurado”.

### Etapa 3 — Fortalecer o backend `apf-generate`
- Normalizar modelos por provedor:
  - Gemini: aceitar nomes atuais e remover prefixos incompatíveis quando necessário.
  - OpenAI: usar modelo padrão seguro quando o campo estiver vazio.
- Melhorar o fallback:
  - se Gemini falhar com 404/429/402/5xx, tentar GPT ativo com chave válida;
  - registrar cada tentativa;
  - retornar ao frontend algo como:

```text
Tentativas: Gemini 1.5 Flash (404 modelo inválido) → GPT (sucesso)
```

ou, se tudo falhar:

```text
Tentativas: Gemini (404 modelo inválido) → GPT (401 chave inválida)
```

### Etapa 4 — Evitar travamento infinito na tela
- Adicionar timeout por provedor no backend.
- Adicionar timeout visual no frontend.
- Trocar “Gerando...” infinito por estados claros:
  - preparando dados;
  - chamando IA;
  - tentando fallback;
  - finalizando;
  - falhou com motivo.

### Etapa 5 — Melhorar a tela Admin → IAs
- Adicionar botão **Testar IA** por provedor.
- O teste fará uma chamada curta e retornará:
  - chave válida;
  - modelo válido;
  - sem crédito;
  - limite atingido;
  - modelo inexistente;
  - erro de autenticação.
- Mostrar um badge operacional separado de “Key configurada”, porque “chave salva” não significa “IA funcionando”.

### Etapa 6 — Melhorar mensagens para o usuário final
- Substituir mensagens genéricas por mensagens acionáveis:

```text
O modelo Gemini configurado não existe mais. Selecione GPT ou ajuste o modelo em Admin → IAs.
```

```text
A chave OpenAI foi recusada. Atualize a chave do provedor GPT em Admin → IAs.
```

```text
Gemini atingiu limite gratuito. Tentando GPT pago automaticamente.
```

---

## Alternativa Enterprise mais robusta

Se você quiser algo mais confiável para relatórios grandes, eu recomendo evoluir esse módulo para uma **fila assíncrona de geração de relatórios**.

Funcionaria assim:

```text
Upload dos arquivos
   ↓
Cria uma tarefa de relatório
   ↓
Processa em partes menores
   ↓
Usa IA principal + fallback
   ↓
Salva histórico, erros e resultado
   ↓
Usuário baixa Markdown/DOCX quando concluir
```

Vantagens:

- a tela nunca fica travada;
- o usuário pode sair e voltar depois;
- relatórios grandes podem ser quebrados em partes;
- cada etapa fica auditável;
- se Gemini falhar, GPT continua;
- se GPT falhar, o erro fica registrado com motivo real;
- dá para reprocessar só a etapa que falhou.

---

## O que eu implementaria primeiro

1. Corrigir `prompt_template`/`prompt_content`.
2. Atualizar o modelo Gemini inválido.
3. Corrigir fallback para GPT e retorno de tentativas.
4. Adicionar timeout e mensagens claras na tela.
5. Adicionar teste de provedor em Admin → IAs.

Depois disso, se você quiser o nível Enterprise de verdade, implementamos a fila assíncrona de relatórios.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>