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
| UX-01 | `environment_link` exigia `audacity_path` no schema e validava o executável antes de persistir motor compatível; setup baixava editor portátil automaticamente | Bloco A: regressões automatizadas passaram; conferência desktop pendente |
| UX-02 | Projetos oferecia contexto/sessões e abertura genérica da biblioteca, sem entradas pelas três intenções | Bloco B pendente |
| UX-03 | Ferramentas da biblioteca antecediam os resultados | Bloco B pendente |
| UX-04 | Voice → FX já existia; demais passagens precisam preservar IDs, projeto, filtros e rascunho | Bloco B pendente |
| UX-05 | `exportAsset` usava fallback para escolha preferida ou primeiro candidato, inclusive fonte | Bloco A: regressões automatizadas passaram; conferência desktop pendente |
| UX-06 | Rótulos curtos não explicitavam sempre o alcance de escolha, preset e exportação | Bloco C pendente |
| UX-07/08 | Cabeçalho/resumos exibiam aprovação histórica e estados com pouca recuperação contextual | Bloco C pendente |
| UX-09 | Setup reunia capacidades e detalhes de infraestrutura; FP32 já tinha explicação opcional e texto-only na v0.5.0 | Bloco C: preservar o que já existe e refinar hierarquia |
| UX-10 a UX-13 | Rótulos não detalhados no material fornecido/localizado | Mapeamento original não verificado; temas de armazenamento, densidade e orientação serão avaliados pelo escopo reproduzido |

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

## Validação em andamento

- Recorte backend Bloco A: 46 testes passaram, incluindo novo contrato sem
  editor, compatibilidade legada e recusa de motor incompleto/CUDA.
- Rodada final UI Bloco A: 13 testes passaram em studio/App, incluindo a
  regressão do formulário sem Audacity. Suíte backend completa: 151 passaram.
- TypeScript passou na primeira implementação.
- Validação desktop, screenshots EN/PT-BR e percursos completos A–J ainda
  pendentes. Testes isolados/mocks não serão apresentados como aceite desktop.

A validação automatizada do Bloco A permite continuar a implementação
independente. A conferência desktop da fase continua obrigatória e pendente;
não há declaração de conclusão desta fase neste registro inicial.

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
  observações desktop. A conferência desktop continua pendente.

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
Screenshots e o percurso final completo ainda serão acrescentados.
