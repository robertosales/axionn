# Motor de Aprendizado APF

## Arquitetura atual

A validação contratual é atômica:

```text
apf_counting_items
  -> validate_apf_counting_item
      -> valida acesso, tipo e fator
      -> recalcula PF Bruto e PF FS
      -> atualiza item, HU e sessão
      -> insere apf_validation_events
      -> trigger alimenta apf_embedding_queue
```

Não existe dependência de uma Edge Function separada para validar. A interface chama o RPC autenticado `validate_apf_counting_item`.

## Dados registrados

`apf_validation_events` preserva:

- item, sessão, projeto, time e baseline;
- tipo, fator, PF Bruto e PF FS sugeridos;
- tipo, fator, PF Bruto e PF FS homologados;
- confiança e justificativa;
- motivo e observação da correção;
- embedding da HU e metadados de RAG.

Quando há alteração de tipo, fator ou valor, `correction_reason_code` é obrigatório.

## Embeddings e precedentes

O trigger de `apf_validation_events` adiciona eventos sem embedding a `apf_embedding_queue`. A Edge Function `apf-embeddings` processa a fila. Os precedentes são recuperados por `match_similar_apf_cases`.

A ordem de decisão do motor é:

1. correspondência exata na baseline;
2. correspondência semelhante na baseline;
3. precedentes humanos validados;
4. classificação por IA;
5. cálculo determinístico pelo banco.

## Métricas

- `v_apf_accuracy_trend`;
- `v_apf_confusion_matrix`;
- `v_apf_confidence_calibration`.

## Regra de ouro

Toda correção deve registrar a causa estruturada. Sem esse campo, o sistema identifica o desvio, mas não consegue aprender por que ocorreu.
