# Fase 4 — UX incremental do Sonariel

## Escopo e baseline

Início: 27/10/2026. Main limpa em `2978d65eab1b61cb5bddd79aaea420657b94d49b`,
aplicativo/release estável v0.5.0. Esta fase não altera versão, release, feed,
instalação do mantenedor, modelos, áudio privado, gates de RAM ou skill Agensi.
São autorizados commits na main de blocos validados, sem PR.

Não foi localizado um relatório original de auditoria de UX no inventário de
documentação do projeto. O pedido reproduz UX-01 a UX-09 individualmente e os
temas adicionais, mas não descreve individualmente os rótulos UX-10 a UX-13.
Não atribuí números inventados a esses temas. A avaliação abaixo é inspeção
funcional/heurística, não pesquisa com usuários ou medição quantitativa de UX.

## Revalidação contra v0.5.0

| Achado | Evidência inicial | Estado nesta fase |
| --- | --- | --- |
| UX-01 | `environment_link` exigia `audacity_path` no schema e validava o executável antes de persistir motor compatível; setup baixava editor portátil automaticamente | Resolvido; backend, UI, schema MCP empacotado e FX sem editor validados |
| UX-02 | Projetos oferecia contexto/sessões e abertura genérica da biblioteca, sem entradas pelas três intenções | Resolvido; navegação sem efeitos colaterais validada |
| UX-03 | Ferramentas da biblioteca antecediam os resultados | Resolvido; resultados/A/B antes de ferramentas avançadas, recursos preservados |
| UX-04 | Voice → FX já existia; demais passagens exigiam reconstruir contexto | Resolvido no escopo; transições por IDs/projeto, filtros, paginação e rascunho testados |
| UX-05 | `exportAsset` usava fallback para escolha preferida ou primeiro candidato, inclusive fonte | Resolvido; escolha explícita, prévia excluída e exportação física/hash testados |
| UX-06 | Rótulos curtos não explicitavam sempre o alcance de escolha, preset e exportação | Revisado em EN/PT-BR; A/B, favorita, escolha do projeto e lote exercitados separadamente |
| UX-07/08 | Cabeçalho/resumos exibiam aprovação histórica e estados com pouca recuperação contextual | Corrigidas mensagens e inferência de compatibilidade; fila com espera/incerteza validada por fixtures React, sem inferência real |
| UX-09 | Setup reunia capacidades e detalhes de infraestrutura; FP32 já tinha explicação opcional e texto-only na v0.5.0 | Refinada hierarquia/estados; limitações existentes preservadas e revisão FP32 exercitada sem download |
| UX-10 a UX-13 | Rótulos não detalhados no material fornecido/localizado | Não verificados individualmente. Temas adicionais reproduzidos, incluindo armazenamento, foram tratados sem inventar o mapeamento original |

## Bloco A — mudanças

- Engine inspection continua usando os mesmos checks obrigatórios de Python,
  Torch CPU, commit, modelos, LM e Flash Attention. `audacity_path` tornou-se
  opcional no RPC/MCP; chamadas antigas com editor existente continuam aceitas.
  Relink sem editor preserva os caminhos anteriores. Audacity é configurado
  separadamente e só bloqueia operações do editor.
- Preparar ACE-Step não baixa editor nem altera suas preferências. O vínculo
  de ambiente e as receitas de geração continuam independentes da integração.
- FX exige seleção explícita da versão exportada; escolha do projeto e ordem
  dos arquivos não determinam exportação. Prévia não entra nas opções finais.
  Uma seleção desaparecida bloqueia o botão em vez de trocar o áudio.
- Exportação ganhou painel próprio após o processamento, com nome, papel de
  fonte/processado, duração, ID, arquivo e destino. Presets e render continuam
  operações separadas. Nenhuma regra de escrita/hash foi alterada.

## Validação incremental do Bloco A (registro histórico)

- Recorte backend Bloco A: 46 testes passaram, incluindo novo contrato sem
  editor, compatibilidade legada e recusa de motor incompleto/CUDA.
- Rodada final UI Bloco A: 13 testes passaram em studio/App, incluindo a
  regressão do formulário sem Audacity. Suíte backend completa: 151 passaram.
- TypeScript passou na primeira implementação.
- A conferência desktop e os percursos posteriores estão registrados abaixo;
  testes isolados/mocks não são apresentados como aceite desktop.

A validação automatizada permitiu continuar a implementação independente,
mantendo a conferência desktop como requisito separado.

## Bloco B — implementação e validação automatizada

- Projetos oferece três intenções com pré-requisitos reais e navegação apenas;
  o resumo genérico anterior foi substituído por orientação compacta. Sem
  projeto, processar WAV abre a criação/seleção em vez de instalar um motor.
- Biblioteca mantém pesquisa/filtros essenciais e seu resumo, depois A/B e
  resultados. Trechos e presets têm seção explicitamente nomeada e ações
  contextuais. Exportação em lote aparece com seleção; sua montagem é mantida
  para não descartar o destino/rascunho ao limpar a seleção.
- Sessão → biblioteca aplica o ID da sessão, mantendo os outros filtros.
  Resultado de tarefa → biblioteca troca o projeto quando necessário, abre o
  ID exato, limpa filtros conflitantes e amplia a paginação para localizá-lo.
  O foco contextual é aplicado uma única vez, preservando a rolagem posterior.
- Fila → player utiliza os resultados do job/projeto, inclusive prévias.
  Biblioteca/Voice → FX mantém o ID da fonte e valida o projeto. Derivados
  oferecem navegação para uma origem ainda disponível do mesmo projeto.
- 80 testes frontend passaram em 20 arquivos; TypeScript/build passaram. Os
  quatro novos workflows automatizados cobrem intenções sem efeitos colaterais,
  ordem da biblioteca/identidade FX independente do player, sessão/filtros e
  navegação de job de outro projeto. São testes React com RPC simulado, não
  observações desktop. A rodada nativa final está descrita abaixo.

## Bloco C — clareza operacional

- Handshake registrado é apresentado como histórico; a tela não afirma que
  ferramentas estão disponíveis na conversa atual. Audacity é identificado
  como editor opcional e sua indisponibilidade não invalida FX/exportação.
- Escolha do projeto, comparação A/B, seleção para lote/tags, salvar preset
  DSP, renderizar e exportar cópia têm termos distintos, sem mudar seus dados.
- Configuração vinculada, compatibilidade e execução anterior não são uma
  aprovação geral do motor. Corrigido o catálogo ACE-Step para não inferir
  compatibilidade apenas da existência de uma configuração persistida.
- Fila explica espera de RAM, permanência da solicitação e recuperação com ID
  e request_key, sem introduzir repetição automática ou nova chave.
- Armazenamento usa os recursos reais da v0.5.0. Nome/tamanho/estado/proteção
  conhecida/expiração aparecem antes dos caminhos, disponíveis em detalhes e
  mantidos na confirmação física. Ausência de favorita não significa aprovação
  de exclusão: continua sendo obrigatória a revisão das proteções no núcleo.
- 82 testes frontend passaram em 21 arquivos; build/TypeScript passaram.
  Suíte Python completa: 152 testes passaram.

## Primeira evidência desktop — Bloco A

A conferência inicial por Computer Use foi interrompida pela interação do
usuário, sem continuar cliques concorrentes. A alternativa usa o mecanismo
[oficial de testes WebView2 do Playwright](https://github.com/microsoft/playwright/blob/main/docs/src/webview2.md):
um executável Tauri real, `http://tauri.localhost/`, IPC Rust/núcleo empacotado
e perfil/WebView separados, com CDP temporário somente em loopback. Não é a
prévia Vite em navegador e não modifica a segurança do aplicativo distribuído.
A automação não injeta entradas no mouse/teclado do Windows.

No build nativo A de 1280×720, a UI selecionou o WAV, adicionou gain -3 dB,
renderizou prévia (10 s), ouviu pelo player (avanço real, áudio mudo), renderizou
12 s completos e exportou explicitamente o processado. A cópia exportada tem
SHA-256 `8f60bb31fbb1bdc1d0ef8c205bbccf20f910f93b2b618f4c0ddaea8cb0e2224f`,
igual ao processado e diferente da fonte preservada. Os jobs foram
`1a9c1d3e23644b558219f276cd7d120c` e `127be5fd832e44ce8d5dfe8246742b99`.

A preparação da fixture e as consultas de verificação foram feitas por scripts;
os pedidos de prévia/render e exportação foram feitos pelos controles reais
do desktop. Houve ajustes de seletores no harness de teste (URL inicial e
rótulos), sem repetir a prévia já concluída nem inventar um aceite auditivo.
A janela automatizada e seu núcleo foram encerrados de forma graciosa.
Screenshots e o percurso final completo estão abaixo.

## Validação final — 27/10/2026

**PASSOU no escopo implementado**, com as ressalvas explícitas desta seção.
Não houve pesquisa com usuários nem medição de ganho quantitativo de UX.

- 152 testes Python passaram; 84 testes frontend em 21 arquivos passaram.
  TypeScript e build de produção passaram. O aviso Vite de chunk acima de
  500 kB permanece; não foi introduzida dependência nova para esta fase.
- Dois executáveis QA Tauri reais, nativamente 1280×720 (EN) e 1000×700
  (PT-BR), executaram o núcleo empacotado em perfis descartáveis separados.
  Houve troca de idioma nos dois sentidos pelo controle real.
- `scripts/check-phase4-desktop.mjs` reproduz os percursos. Preparação das
  fixtures e conferências de estado/hash usam RPC; pedidos de processamento,
  exportação, navegação e decisões usam controles reais da UI via WebView2.
  Não são chamadas de script apresentadas como ações autônomas de agente.
- O handshake e a descoberta MCP foram feitos pelo processo empacotado em
  stdio: 60 ferramentas, `environment_link` requer apenas `root`, conserva
  `audacity_path` opcional e não anuncia criação de loops desabilitada.
  Nenhuma configuração global do Codex foi modificada.

| Percurso | Resultado e evidência |
| --- | --- |
| A | PASSOU desktop: projeto criado na UI, seleção de outro projeto, caminho musical abre inspeção sem campo obrigatório de editor e sem instalar/gerar |
| B | PASSOU desktop: orientação do motor vocal e criação de perfil somente de idioma `sw`, sem referência, instalação ou síntese; perfil e motor continuam distintos |
| C | PASSOU desktop: importação, fonte correta no FX, gain -3 dB, prévia, reprodução com avanço real em mudo, versão completa e cópia explicitamente selecionada; original preservado |
| D | PASSOU desktop: tarefa concluída de outro projeto abre seu resultado por ID, troca projeto e reproduz no player persistente |
| E | PASSOU desktop: sessão aplica seu ID/filtro, preserva-o ao navegar e amplia resultados de 50 para a página seguinte |
| F | PASSOU desktop: dois itens em A/B, uma seleção de lote, favorita e escolha do projeto persistidas; escolha de outro projeto preservada |
| G | PASSOU com fixture React: mensagem de espera de RAM e de identidade remota incerta, sem reenvio ou botão genérico de retry. Espera real sob pressão de memória NÃO TESTADA nesta fase |
| H | PASSOU desktop: ausência de Audacity explicada como bloqueio opcional; FX/exportação continuam funcionais. Handoff real ao editor NÃO RETESTADO |
| I | PASSOU desktop: revisão Medium FP32/SAME-L; aceite/autorização não marcados, instalação bloqueada, destino não criado, nenhum peso baixado |
| J | PASSOU desktop: cancelar preserva bytes; descarte físico de importado exige opção explícita; restauração preserva hash; segunda revisão/exclusão remove somente fixture; favorita/referência protegidas |

O teclado foi exercitado via CDP para Escape, fechamento de modais, retorno
de foco ao acionador e foco inicial seguro em "Manter arquivos". Não representa
uma auditoria completa de leitor de tela, IME ou de todos os atalhos do Windows.
Os seletores, foco e rolagem são do aplicativo real; nenhum viewport emulado
substituiu a dimensão nativa. As capturas foram inspecionadas visualmente,
sem overflow horizontal. Escolha de caminhos em diálogo nativo do Windows não
foi retestada; os campos editáveis reais foram usados.

Para repetir: compilar o núcleo com `scripts/build.ps1 -CoreOnly`; preparar
uma configuração Tauri QA ignorada em `build/`, com identificador separado,
janela `visible: false` e tamanho nativo desejado; compilar com
`npm.cmd run tauri build -- --no-bundle --config build/phase4-desktop.json`.
Copiar o executável QA e seu `runtime/` para uma pasta externa à instalação.
Executar `node scripts/check-phase4-desktop.mjs APP NOVO_PERFIL EVIDENCIAS
PLAYWRIGHT_NODE_MODULES en 1280 720` (ou `pt-BR 1000 700`). O runner recusa
perfil preexistente ou dentro da produção/Git. Playwright é fornecido pelo
ambiente de testes; não entrou nas dependências do aplicativo. O script fecha
somente sua janela e núcleo de teste de forma graciosa.

### Problema encontrado na rodada real

Favoritar e abrir detalhes imediatamente podia capturar a revisão anterior do
asset; definir a escolha do projeto então reenviava `favorite=false`. Os dois
controles agora aguardam a gravação/atualização de estado. A regressão React
com gravação pendente e os dois percursos desktop confirmam a preservação.

Também foram corrigidas sincronizações do harness: aguardar o resultado no
snapshot da UI após completar o job e aguardar a conclusão/hash da cópia,
em vez de considerar a mera criação do arquivo como exportação concluída.
Os registros das tentativas anteriores foram preservados nas evidências
privadas; nenhuma falha foi convertida em aprovação silenciosa.

### Identidade e integridade

Recibos sanitizados ficam em `docs/evidence/phase4/`. Guardam IDs, request keys
de teste, hashes e origem da interface, sem tokens ou dados de produção.
Em ambas as rodadas finais:

- Fonte sintética: `2e3272fca370f401d381b46828b1014b4a55f28737512bd86a27fafcfaee271d`.
- Cópia processada -3 dB: `4a010dd2f66008b69a36ee269c184464915cbddb1fa3cf54fc855704e1364fab`.
- Hash da cópia igual ao processado escolhido, diferente da fonte preservada.
- Prévia excluída da lista de exportação final; ausência de escolha mantém o
  botão bloqueado. Desaparecimento da seleção e mudanças de projeto também
  têm regressões de UI sem fallback para outro arquivo.

### Capturas reais

| Tela | EN · 1280×720 | PT-BR · 1000×700 |
| --- | --- | --- |
| Intenções/projetos | [EN](images/phase4/projects-en.png) | [PT-BR](images/phase4/projects-pt-BR.png) |
| Voice Studio | [EN](images/phase4/voice-en.png) | [PT-BR](images/phase4/voice-pt-BR.png) |
| FX/exportação explícita | [EN](images/phase4/fx-export-en.png) | [PT-BR](images/phase4/fx-export-pt-BR.png) |
| Resultado contextual | [EN](images/phase4/queue-result-en.png) | [PT-BR](images/phase4/queue-result-pt-BR.png) |
| Biblioteca/A-B | [EN](images/phase4/library-en.png) | [PT-BR](images/phase4/library-pt-BR.png) |
| Revisão FP32 | [EN](images/phase4/setup-en.png) | [PT-BR](images/phase4/setup-pt-BR.png) |
| Confirmação de armazenamento | [EN](images/phase4/storage-confirm-en.png) | [PT-BR](images/phase4/storage-confirm-pt-BR.png) |

## Publicação e limites

Blocos locais: `b2cca7d` (A), `dcf11ba` (B), `eb07c0f` (C). O commit final
acrescenta a correção da disputa de favorita/detalhes, testes, runner e estas
evidências. Publicação autorizada diretamente na main, após revisão dos paths,
diff, higiene e sincronização com o remoto; sem PR ou reescrita de histórico.

A versão permanece **0.5.0**. Estas mudanças são código da main para uma futura
release; o aplicativo instalado e o atualizador NÃO recebem esta fase agora.
O instalador estável conserva SHA-256
`98704bf88d5d74852b31f21efc7cce9b100f0db3beb027fd4120422d1bd6e03e`.
Não houve alteração de modelos, receitas de geração, gates de RAM, capacidades
nativas, release/feed, Takasa, áudio privado ou pacote Agensi.

A auditoria de publicação por padrões examinou 672 blobs alcançáveis e 291
arquivos de trabalho, sem achados. Isso não é garantia de ausência de toda
vulnerabilidade. O e-mail histórico já autorizado continua no histórico.
As janelas/núcleos QA foram encerrados sem encerramento forçado. Perfis,
WAVs sintéticos, cópias dos executáveis QA e caches exclusivos desta fase
foram removidos após compactar as evidências privadas: `desktop-evidence.zip`,
2.701.422 bytes, SHA-256
`e9687a6923d5b2080be97d37162be7c84159f789c3e1f565bf35dae19b63351e`.
Builds de desenvolvimento ignorados permanecem na árvore de build habitual;
modelos, instalação e projetos de produção foram preservados.

Recomendações: acompanhar o uso real dos três caminhos antes de mudar a
sidebar; obter o mapeamento original UX-10–13 se for necessária rastreabilidade
individual; auditar acessibilidade completa e retestar instalação/handoff na
próxima release. Não há inferência pesada, aceite auditivo, reinstalação limpa
ou ciclo de atualização validados por esta fase de UX.
