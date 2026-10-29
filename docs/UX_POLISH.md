# Polimento de interação e clareza — 28/10/2026

Base: main `39538fd`, versão distribuída 0.5.0. Rodada iniciada após o
checkpoint pessoal: a implementação anterior não foi aceita como uma
experiência suficientemente confortável. Esta rodada não pressupõe esse aceite.

## Escopo

Interface e orientação do aplicativo. Sem pesos, instalação de motores,
geração ou processamento de áudio, mudança de backend, versão, release/feed
ou substituição do aplicativo instalado. Os testes reutilizam cópias de WAVs
sintéticos do checkpoint anterior, sem dados de produção.

## Mudanças

| Feedback | Tratamento |
| --- | --- |
| Prefixo de branches | `multi-engine-voice-fx` substitui o nome anterior local e remoto, mantendo o commit `8ec2098d65f4c7b397b3e84c15991fc6e9ff7d24`; main permanece main. A orientação sem prefixo de agente foi registrada em AGENTS.md. Não houve reescrita de commits. |
| Badges pareciam ações | Estados usam linguagem descritiva: “Não vinculado” e “Compatibilidade pendente”. O enquadramento de botão foi removido dos status compartilhados; ajuda no próprio status complementa os próximos passos. Um motor bloqueado recebe explicação distinta de um motor apenas não configurado. |
| Formulários colados | Seções expansíveis receberam um contêiner real de conteúdo com gap; `display:flex` no próprio `details` não organizava a caixa anônima de conteúdo. Corrige voz, preparação musical e seções do FX, preservando campos e ações. |
| Botões pouco reconhecíveis | Ações antes apresentadas como texto ganharam borda, área de interação e hover. Ícones, linhas de projeto e expansores têm resposta visual; foco por teclado permanece visível. |
| Ajuda junto aos títulos | As oito páginas têm um controle de ajuda junto ao H1, descrevendo finalidade e percurso sem executar operações. |
| Obrigatório/opcional | Requisitos de música, voz, FX e integração aparecem de forma compacta e visível. Campos de vínculo/instalação identificam obrigatoriedade; referências e caches opcionais permanecem distintos. Botões de voz bloqueados têm orientação textual próxima. |
| Conexão Codex pouco clara | A ação explica registro MCP/skill e efeito no cliente. Há progresso no próprio botão e feedback no painel para sucesso ou erro. Sucesso orienta recarregar o cliente, sem alegar ferramentas confirmadas nesta conversa. |
| Textos soltos | Avisos repetidos de navegação, comandos de exemplo, detalhes de transporte e implementação passaram para ajuda ou detalhes técnicos. Licenças, autorizações, proteções e requisitos de operação permanecem no fluxo. |

## Componentes e acessibilidade

`src/ui/help-tip.tsx` adapta o Tooltip do Base UI **1.9.0 já instalado**.
O visual continua pertencendo ao Sonariel; não foi adicionada dependência.
Há abertura por hover, foco e clique, fechamento por Escape, `role=tooltip`,
associação por `aria-describedby`, colisão com o viewport e redução de movimento.
O clique de ajuda não propaga para uma ação do contêiner.

Informações essenciais de autorização/requisito não dependem exclusivamente
de tooltip. Status continuam não sendo botões de instalação. A ajuda abre no próprio
status, botão ou seletor existente; o ícone separado fica nos títulos das páginas. O conjunto MCP do cabeçalho é ocultado integralmente
no layout compacto, evitando um ícone de ajuda órfão quando sua badge some.

## Validação

- 89 testes frontend passaram em 22 arquivos, incluindo os novos testes de
  teclado/Escape, ajuda sem acionamento do contêiner e progresso/sucesso/erro
  de registro com chamada única. Paridade EN/PT-BR e chamadas de tradução
  fazem parte da suíte.
- TypeScript e build de produção passaram. Permanece o aviso pré-existente
  de chunk acima de 500 kB; o Tooltip acrescenta código do pacote já instalado.
- Validação automatizada no **Tauri/WebView2 real**, com Rust IPC e núcleo
  empacotado: PT-BR nativo 1000×700 e EN nativo 1280×800. Foram percorridas
  as oito páginas; ajuda, Escape, limites do popup e ausência de overflow
  horizontal foram conferidos. Não é um navegador Vite apresentado como desktop.
- Separação vertical entre os campos de vínculo vocal medida em pelo menos
  16 px; botões de vínculo incompleto permanecem bloqueados e a badge não
  aparece como botão de configuração.
- O registro Codex foi exercitado de verdade **somente em usuário fictício**:
  skill conflitante causou erro sem modificar a configuração; após remover
  a fixture conflitante, o registro gravou config/skill e criou backup.
  `configured=true`, `tested=false`: nenhum handshake foi inventado.
- Hashes da configuração MCP/skill de produção monitorados antes/depois
  permaneceram iguais. Zero jobs, zero modelos vinculados/carregados e hash
  do WAV importado preservado. Nenhum teste precisou de áudio novo.
- Capturas e recibos ficam na prévia privada entregue ao mantenedor. São
  evidências automatizadas, não aceite pessoal, teste com usuários, leitor de
  tela ou medição quantitativa de facilidade de uso.

## Limites e continuidade

A identidade gráfica, sidebar, player, contratos RPC, regras de armazenamento
e configuração dos motores foram preservados. Nenhum arquivo de backend,
dependência ou release precisou mudar.

A etapa posterior de reorganização dos fluxos passou a reter o rascunho de
Voice Studio em memória durante navegação, limpando-o ao trocar de projeto.
Não introduz persistência privada em disco e não declara resolvidos os
achados anteriores de referências ou presets musicais. Consulte
[WORKFLOW_CLARITY.md](WORKFLOW_CLARITY.md) para a rodada mais recente.

A prévia anterior é preservada. A nova cópia usa seu próprio SONARIEL_HOME,
WebView2, HOME/USERPROFILE/CODEX_HOME, AppData e temporários. Seus launchers
verificam identidade do executável; o encerramento é normal e restrito aos
processos próprios. Atualização oficial está desativada apenas nessa cópia.

Esta rodada foi entregue localmente para revisão. A publicação do conjunto
foi posteriormente autorizada após o percurso descrito em WORKFLOW_CLARITY.md. A mudança de nome da branch remota
foi executada por solicitação explícita do mantenedor. Esta validação técnica
não encerra a avaliação de conforto da experiência pelo responsável.
