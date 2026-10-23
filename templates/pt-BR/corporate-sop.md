# Procedimento Operacional Padrão Corporativo

## METADADOS DO DOCUMENTO *(Conformidade)*

* **Nome do POP:** <!-- PARSER_HOOK: INJECT_TITLE -->
* **ID do documento:** <!-- PARSER_HOOK: INJECT_DOC_ID -->
* **Versão:** 1.0 (Gerada)
* **Data de vigência:** <!-- PARSER_HOOK: INJECT_TIMESTAMP -->
* **Sistema/Aplicativo:** <!-- PARSER_HOOK: INJECT_TARGET_APP -->

---

## 1. CONTEXTO *(Por quê e quem)*

### 1.1 Objetivo

Este procedimento operacional padrão define a sequência de ações capturadas
durante a execução do processo, para garantir consistência e conformidade
em toda a organização.

### 1.2 Escopo

* **Inclui:** Ações executadas durante a sessão gravada.
* **Exclui:** Operações externas de hardware e intervenções manuais no sistema
  que não foram capturadas.

### 1.3 Funções e responsabilidades

* **Executor principal:** <!-- PARSER_HOOK: INJECT_USER_ID -->
* **Ambiente do sistema:** <!-- PARSER_HOOK: INJECT_OS_ENVIRONMENT -->

---

## 2. CONTEÚDO *(Etapas de execução)*

### 2.1 Pré-requisitos

Antes de começar, certifique-se de ter as credenciais e a configuração de
ambiente exigidas pelo aplicativo.

### 2.2 Instruções passo a passo

<!-- PARSER_HOOK: START_DYNAMIC_STEPS_LOOP -->
{{text_block}}

{{image_block}}

<!-- PARSER_HOOK: END_DYNAMIC_STEPS_LOOP -->

### 2.3 Exceções do sistema

| Evento detectado | Comportamento padrão do sistema |
| :--- | :--- |
| `UI_ELEMENT_NOT_FOUND` | Pare e registre a falha; não continue o procedimento |
| `UNEXPECTED_NAV` | Volte à tela anterior e repita a etapa |

---

## 3. CONSISTÊNCIA *(Padrões e elementos visuais)*

### 3.1 Terminologia dos eventos

* **CLIQUE ESQUERDO / CLIQUE DIREITO / CLIQUE DUPLO:** botão do mouse pressionado e solto.
* **ARRASTAR:** botão mantido pressionado enquanto o ponteiro se move entre dois pontos.
* **TEXTO DIGITADO:** valor digitado no campo em foco, registrado por campo em vez de por tecla.
* **TECLA PRESSIONADA:** tecla identificada pelo nome ou combinação de teclas modificadoras.
* **SENHA:** houve digitação em um campo protegido; o conteúdo não foi gravado.

### 3.2 Mapeamento do contexto das telas

<!-- PARSER_HOOK: START_IMAGE_GALLERY -->
**Etapa {{number}} - {{window}}**

{{image_block}}

<!-- PARSER_HOOK: END_IMAGE_GALLERY -->

---

## 4. CONFORMIDADE *(Qualidade e controle)*

### 4.1 Segurança e privacidade

Aplicado a esta gravação: <!-- PARSER_HOOK: INJECT_REDACTION_SUMMARY -->

Campos de senha são suprimidos durante a captura e seu conteúdo nunca é salvo
em disco. Valores com formato de cartão ou de número de seguro nacional britânico
digitados em campos comuns são mascarados automaticamente. Qualquer ocultação
adicional é de responsabilidade do autor e está descrita acima.

### 4.2 Histórico de revisões

| Versão | Data | Descrição das alterações | Autor |
| :--- | :--- | :--- | :--- |
| 1.0 | <!-- PARSER_HOOK: INJECT_DATE --> | Procedimento capturado, <!-- PARSER_HOOK: INJECT_STEP_COUNT --> etapas | <!-- PARSER_HOOK: INJECT_USER_ID --> |

### 4.3 Aprovações e assinaturas

* **Assinatura do aprovador autorizado:** ___________________________
* **Data:** ___________________________
