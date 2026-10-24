# Stable Audio: fonte de áudio

Desde 0.3.1, `music_generate` oferece `mode="audio2audio"` de forma explícita,
além do `text2audio` anterior. A geração continua no processo LiteRT CPU isolado,
pela fila compartilhada. O núcleo, a interface e o MCP não carregam modelos.

## Preparar e usar

1. Revise e autorize o setup LiteRT em Music Engines, com aceite dos termos
   Stability Community e Gemma. Ele inclui o encoder SAME-S w8a8 e soxr 1.0.0.
   Em um ambiente já preparado com esses componentes, basta vinculá-lo novamente.
   O vínculo verifica versões e hashes; não baixa nem reinstala componentes.
2. Registre o WAV como referência ou resultado do projeto. Preserve a origem.
3. Peça ao Codex `music_generate`, escolhendo Small-Music ou Medium, com
   `mode="audio2audio"`, `source_id`, prompt, seed, duração integral da fonte e
   `init_noise_level` (0,25 é um ponto inicial; 0,01 <= sigma < 1).
4. Acompanhe `job_get`/fila, escute o WAV e só depois registre preferência.

O modo usa **conteúdo da fonte**, não apenas uma referência de estilo. Um sigma
menor reduz a perturbação inicial dos latentes, mas não promete uma porcentagem
de semelhança, preservação literal da composição ou direitos sobre a gravação.
Sigma 1 é rejeitado porque ignoraria a fonte. Nada troca silenciosamente um
pedido com áudio por geração de texto.

## Limites e integridade

- Fonte WAV mono/estéreo, no mesmo projeto, entre 5 e 120 s.
- A duração solicitada deve coincidir com a fonte, com tolerância de um sample.
  Para recortar, registre um trecho separado; não há truncamento oculto.
- soxr HQ converte para os 44,1 kHz do codec dentro do worker. A fonte é mantida
  intacta, com hash conferido no enfileiramento e antes/depois da execução.
- A versão registra a fonte como parent, todos os parâmetros e os hashes dos
  checkpoints. A saída FLOAT não recebe limiter, fades ou normalização ocultos.
- Texto sem áudio mantém o limite local de 60 s; batch 1, CFG/APG 1 e 8 passos
  formam a receita CPU testada. As proteções de memória continuam ativas.
- Instalações antigas de texto continuam utilizáveis. Sem encoder/resampler
  verificados, o catálogo não anuncia entrada de áudio disponível.
- Inpainting, geração por GPU e cancelamento de inferência ativa não foram
  adicionados. Não se removem marcas d'água deliberadamente.

## Validação 0.3.1

Passaram 63 testes Python, 24 de interface, typecheck e build. Os contratos cobrem
fonte explícita, projeto, duração, integridade, idempotência, limites e linhagem.

O núcleo Windows empacotado inicializou 43 ferramentas MCP e executou uma única
geração concluída de 5 s no Medium, em perfil isolado, com uma fonte sintética
mono/48 kHz. A saída foi estéreo/44,1 kHz, finita e não silenciosa, com parent e
hash de origem corretos; a fonte permaneceu inalterada. Medição: carregamento
3,27 s, inferência 13,10 s, processo 19,81 s, pico amostrado 1,93 GiB e mínimo
7,17 GiB livres. São observações locais, não metas para outras máquinas.

A primeira tentativa desse teste parou antes de amostrar música por uma disputa
Windows na substituição do arquivo de progresso. O worker agora tenta novamente
a atualização de telemetria e não aborta o render por essa disputa transitória;
o caso tem teste de regressão. A repetição validada usou um novo perfil, sem
reenviar uma tarefa de estado incerto.

Um estudo privado de 102 s também concluiu com os mesmos primitivos oficiais em
um wrapper local separado, antes da integração. Ele **não** é apresentado como
uma geração longa executada pelo novo adaptador da fila, nem como aprovação
artística. Gravações, prompts privados e resultados não são distribuídos.

Para repetir o teste de integração, use `scripts/smoke-mcp.py` com um
`SONARIEL_HOME` dedicado fora do Git, `--executable` apontando ao núcleo a testar,
`--stable-input-root` para um ambiente existente e
`--authorize-stable-input-generation`. Essa opção autoriza exatamente uma
geração sintética de 5 s; não use o perfil de produção. O teste padrão do script
não gera áudio.
