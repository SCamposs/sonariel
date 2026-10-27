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
