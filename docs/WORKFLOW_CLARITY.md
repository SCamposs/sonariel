# Fluxos por tarefa — 28/10/2026

Continuação do polimento local sobre main `39538fd`. O problema relatado é
de organização da interação: campos, informação e trabalho do agente apareciam
no mesmo nível. A entrega anterior de tooltips não foi tratada como aceite
definitivo de usabilidade. Esta etapa reorganiza a entrada e o avanço da tarefa.

## Critério aplicado

- Ações manuais têm um contexto e um acionador; campos só aparecem quando a
  tarefa ou a configuração correspondente for escolhida.
- Música e voz deixam explícito o trabalho na conversa com Codex, o contexto
  do projeto e onde acompanhar os resultados.
- Informação consultiva é texto, lista ou readout; não um campo de edição
  inativo. Detalhes técnicos continuam disponíveis com nomes reconhecíveis.
- Preparação ocasional fica fora do percurso cotidiano. Motor obrigatório
  para síntese não significa configuração manual obrigatória pelo usuário.

## Antes e depois

| Área | Antes | Agora |
| --- | --- | --- |
| Projetos | A intenção levava imediatamente a outra tela com configuração | Escolha da tarefa apresenta responsabilidade, pré-requisito e próximo passo. Sem projeto, criar/selecionar vem primeiro; sem engine, preparar vem antes de gerar |
| Música pronta | Caminho levava à tela genérica de conexão | Com motor compatível vinculado, há um pedido-base por projeto para continuar no Codex; conexão é uma ação secundária explícita |
| Voz | Preparação técnica e criação de perfil expostas juntas | A continuação pelo Codex vem primeiro; preparar motor e criar perfil manualmente são escolhas. Os campos permanecem disponíveis, sem exibição obrigatória inicial |
| Ambiente | Catálogo, vínculo, instalação e preferências simultâneos | Escolher vínculo ACE-Step, instalação ou Stable Audio revela a configuração correspondente; voz aponta ao seu workspace. Formulário escolhido precede inventário técnico; preferência de inatividade é uma ação opcional |
| FX vazio | Cadeia e exportação apareciam antes de haver arquivo | Primeiro escolher/importar a fonte; depois os mesmos controles de efeitos e exportação. A fonte segue identificada por ID/projeto |
| Sessões/importação | Campo de nova sessão sempre exposto e botões de importação com nomes iguais | Criação de sessão sob ação explícita; abrir/fechar importação se distingue de registrar o arquivo no formulário |
| Pedido vocal anterior | Texto read-only parecia preenchimento de formulário | Histórico consultivo em `details`, com texto e parâmetros legíveis, sem caixas de edição |
| Rascunhos | FX retido; Voice desmontava ao navegar | Ambos retidos somente em memória após primeira visita; troca de projeto limpa o rascunho para evitar mistura |

Biblioteca, fila e armazenamento preservam suas ações e os filtros essenciais.
Não receberam uma classificação artificial em cada controle: ouvir/filtrar,
acompanhar e revisar operações de arquivo já são tarefas diretas nessas telas.

## Continuação pelo agente

`AgentHandoff` prepara apenas texto local. O pedido-base contém nome/ID do
projeto atual, intenção e orientação para consultar contexto/disponibilidade
antes de combinar parâmetros. Não inclui automaticamente contexto privado,
caminhos de arquivos, referências, histórico ou parâmetros de áudio.

Copiar exige clique; não abre conversa, envia mensagem, chama geração ou
instala motores. O usuário pode inspecionar o texto antes de copiar, colá-lo
no cliente e completar sua intenção. Falha de clipboard tem mensagem e saída
manual. Estado de configuração MCP continua distinto de ferramentas realmente
disponíveis na conversa atual.

## Validação

- 94 testes frontend em 23 arquivos passaram; TypeScript e build passaram.
  Há regressões de escolha antes de navegação, projeto obrigatório, continuação
  musical pronta, conteúdo mínimo do pedido por projeto, falha de clipboard,
  consentimento/idioma e retenção/reset do rascunho vocal.
- Percurso automatizado no Tauri/WebView2 real, com núcleo empacotado e
  perfis separados: PT-BR 1000×700 e EN 1280×800, sem uso do tutorial.
  Não é uma prévia Vite nem aceite pessoal.
- Primeiro acesso a Projetos, Voz e Ambiente: zero caixas de texto visíveis
  antes de escolher uma ação manual. É uma verificação do estado da UI,
  não uma medição de melhoria subjetiva ou quantitativa de UX.
- Projeto criado pela UI; a criação manual revela seus campos, preserva a
  intenção escolhida e encaminha ao próximo passo. Importação pela UI leva
  ao asset correto no FX; ajuste -7 dB fica no rascunho ao navegar, sem render.
- Rascunho de perfil vocal preservado entre módulos e limpo ao trocar projeto.
  Pedido-base posterior contém somente a identidade do projeto atual.
- Clipboard foi substituído no harness para conferir exatamente o texto e o
  feedback sem sobrescrever o clipboard do Windows. A escrita real no clipboard
  do sistema não é declarada validada; seu erro/fallback está coberto.
- Zero jobs, inferência, processamento DSP, download ou instalação. Reutilizada
  apenas cópia de fixture WAV sintética anterior, com hash preservado. Arquivos
  monitorados de configuração/skill de produção permaneceram iguais.
- O runner histórico `scripts/check-phase4-desktop.mjs` foi ajustado para a nova
  navegação, mas sua bateria DSP/armazenamento não foi reexecutada nesta etapa
  sem áudio. O harness desta rodada e capturas ficam na prévia privada.

## Preservações e limites

Preservados a identidade visual, sidebar, player, funcionalidades, chamadas
RPC/MCP, regras de edição/exportação/armazenamento, perfis de modelos e gates
de memória. Nenhuma dependência nova, alteração de backend, versão ou release.
`hidden` mantém os formulários e rascunhos montados, mas fora da navegação e da
árvore acessível até serem escolhidos. Nenhum rascunho novo é persistido em disco.

O aceite pessoal estava aberto ao entregar a prévia. Após experimentá-la, o
mantenedor aprovou as melhorias e autorizou publicação na v0.6.0; mudanças
pontuais futuras continuam possíveis. Achados anteriores de descoberta
de referências em “Todos os tipos” e reutilização de presets musicais não foram
declarados resolvidos. Uma revisão completa de leitor de tela, instalação limpa
e ciclo do atualizador também não faz parte deste teste de fluxo.

A implementação incorporou o polimento anterior; após a avaliação da prévia,
o mantenedor aprovou a publicação em 28/10/2026. A prévia é uma cópia separada
com seus próprios SONARIEL_HOME, WebView2, usuário fictício e temporários;
as prévias anteriores e a instalação estável foram preservadas.

Prévia manual privada: `%USERPROFILE%\SonarielPreview\flow-clarity-20261028`.
O launcher `Abrir Sonariel DEMO.cmd` abre uma cópia independente com fixtures
anteriores; `LEIA-ME.md` descreve o percurso e os limites. `Evidence.zip` contém
capturas, recibos e harness, SHA-256
`26c8f3071e87dd7e8daab36f6ea83477c051a12896fab8bea9979ef68cafee96`.
O instalador estável 0.5.0 permaneceu com SHA-256
`98704bf88d5d74852b31f21efc7cce9b100f0db3beb027fd4120422d1bd6e03e`.
