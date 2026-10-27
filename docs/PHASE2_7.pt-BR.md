# Fase 2.7 — candidato de distribuição Windows

[English](PHASE2_7.md)

## Candidato e limites de publicação

Candidato **0.4.0-rc.1**, implementação no commit `65b0780`, versão estável proposta 0.4.0. O pacote Python usa a forma PEP 440 equivalente `0.4.0rc1`. Posteriormente, o proprietário autorizou publicar esta [pré-release de teste](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0-rc.1) para baixá-la dentro da VM Windows. **A v0.3.2 continua como latest**, sem substituição do manifesto público do atualizador.

Instalador Windows x64 NSIS: `Sonariel_0.4.0-rc.1_x64-setup.exe`, 22.534.304 bytes. SHA-256:

```text
4f35135835624b3f57acf357d1cb58ffea0545081031a7d2b0c6b286916814bf
```

O código revisado e 97 entradas relevantes do executável corresponderam à cópia isolada usada no build. Nenhum perfil de produção, áudio, modelo ou material privado de assinatura entrou no Git ou nos assets públicos.

## Funcionalidades e loops

Inclui EN/PT-BR, Voice Studio, Stable Audio experimental, FX nativo, biblioteca/comparação A/B, exportação WAV em lote, presets musicais, regiões de referência, tags/filtros, descarte recuperável e MCP. Audacity permanece opcional. Limitações dos motores e gates de RAM foram preservados; nenhuma nova geração pesada foi executada nesta fase.

**A criação de loops está indisponível na distribuição empacotada.** Interface e descoberta MCP omitem o recurso; o núcleo recusa chamadas diretas e receitas FX genéricas com loops. Variável de ambiente não o habilita no pacote. No código-fonte, desenvolvimento exige habilitação explícita e perfil separado da produção. Loops antigos em espera são interrompidos antes de executar; registros, arquivos, metadados e linhagem são preservados. Recortes de referência e FX comuns continuam disponíveis.

A issue [#3](https://github.com/SCamposs/sonariel/issues/3) continua aberta: duas rodadas musicais anteriores foram rejeitadas; não houve terceira rodada. Issues #6–9 continuam como trabalhos separados, sem implementação nesta fase. A seleção temporária do par A/B não tem promessa de persistência.

## Aceites — 27/10/2026

| Área | Resultado | Evidência e limites |
| --- | --- | --- |
| Regressões automatizadas | PASSOU | 131 testes Python, 73 frontend, 28 Rust nativos; typecheck aprovado. O alvo Tauri compilou e executou zero testes; isso não é teste de interface. |
| Build e pacote | PASSOU | Núcleo PyInstaller isolado, aplicativo Tauri otimizado e instalador NSIS real, assinados pela rotina/chave existente. Sem novas dependências. |
| Assinatura e integridade | PASSOU | Chave pública e versão RC autenticada verificadas. Bytes adulterados/truncados e assinatura inválida recusados. Assinatura Tauri não é Authenticode; aviso de editor desconhecido pode permanecer. |
| MCP empacotado | PASSOU | Handshake stdio real e 58 ferramentas. Habilitação de loops e desvios diretos/genéricos recusados; região de referência funcionou. Teste fora da VM, em perfil isolado. |
| FX nativo e exportação | PASSOU fora da VM | Prévia real de ganho em sinal sintético de 10 s concluída; hash original preservado e duas exportações verificadas. Zero tarefas de IA. |
| Migração SQLite | PASSOU fora da VM | Store real da v0.3.2: schema 3 → 5 em fixture isolada; registros, idioma, arquivos e backup consistente preservados. Núcleo antigo recusou banco novo sem alterá-lo. Não equivale a testar instalador/atualizador. |
| Preparação de atualização do núcleo | PASSOU fora da VM | Núcleo ocioso de teste encerrou; candidato reiniciou preservando tabelas, exceto eventos esperados de ciclo de vida. Sem executar instalador nesse check. |
| Instalação limpa do Sonariel no Windows | PASSOU, aceita pelo proprietário | Instalador RC baixado do GitHub concluiu em VM Hyper-V Windows 11 descartável, perfil Sonariel novo, 6 GiB RAM e nenhum motor de IA instalado. WebView2 já fornecido pelo sistema; bootstrap sem WebView2 não exercitado. |
| Primeiro uso e idioma | PASSOU na VM | Núcleo iniciou; inglês sugerido; escolha de idioma/tutorial abriram; avanço e fechamento opcional funcionaram. Troca para PT-BR salva imediatamente. |
| Projetos, importação e biblioteca | PASSOU na VM | Projeto de teste criado; WAV do Windows convidado escolhido pelo seletor nativo, registrado e carregado com waveform/metadados 48 kHz PCM-16. Sem assets de produção. |
| Reprodução | PASSOU no transporte; saída audível NÃO TESTADA | Posição avançou e chegou ao fim. Saída sonora da sessão básica da VM não foi ouvida/capturada independentemente. |
| Exportação WAV | PASSOU na VM | Novo WAV em Downloads do convidado; núcleo confirmou cópia exportada e verificada. Bytes do convidado não foram extraídos para outro cálculo independente de hash. |
| Encerrar/reabrir e preferências | PASSOU na VM | Atalho instalado reabriu o app; projeto, resultado e PT-BR permaneceram; tutorial não reapareceu. |
| FX nativo na VM | NÃO CONCLUÍDO | Uma prévia de ganho aguardou corretamente 3 GiB livres; havia aproximadamente 1,7–2,4 GiB. Cancelada antes de executar, com histórico preservado. Nenhum gate reduzido. |
| Desinstalação NSIS | NÃO TESTADO | Instalação e dados de teste preservados. |
| Ciclo oficial v0.3.2 → RC por instalador/atualizador | NÃO TESTADO | Instalador antigo baixado, mas versão antiga não instalada/executada antes de atualizar. Sem alegação de download/instalação/reabertura completos pelo atualizador, migração de preferências WebView ou interrupção injetada nesse ciclo. |

Não houve falha funcional observada nos checks concluídos da VM. A falta de RAM impediu iniciar o FX convidado; não é render aprovado. Um cliente privado da v0.3.2 com transporte de teste foi construído, mas não exercitado no convidado; não é artefato oficial/público.

Logística da validação: Windows Sandbox indisponível; a VM existente inicialmente era Ubuntu. Foi preparado um Windows 11 descartável no Hyper-V. A cópia de arquivos para o convidado falhou com `0x800710DF` (dispositivo não pronto). Por orientação do proprietário, o RC foi publicado como pré-release e baixado do GitHub dentro da VM. Isso resolveu a entrega do instalador; a falha de transferência não foi uma falha do runtime Sonariel. Posteriormente, o proprietário encerrou os checks adicionais da VM e aceitou os limites explícitos abaixo.

## Entrega e recomendação

Evidências privadas incluem inventário do candidato, recibo MCP/FX, migração, reinício, observações da instalação na VM, builds isolados e fixture não utilizada do atualizador. Tudo permanece fora do Git. Aplicativo estável instalado, dados de produção, ambientes/modelos e projetos Unity foram preservados.

O proprietário aceitou a validação Windows de instalação/uso básico e escolheu explicitamente encerrar a Fase 2.7 com o ciclo de atualização não testado registrado como ressalva, em vez de mantê-lo como requisito pendente da fase. Os demais itens não testados acima permanecem como limites desse aceite. Essa decisão não transforma evidência ausente em teste aprovado. **Fase encerrada com ressalvas; adequada como pré-release de teste. O aceite completo v0.3.2 → RC continua sem verificação para uma afirmação irrestrita de prontidão estável.** Promoção/publicação estável e alteração do feed continuam dependendo de decisão separada do proprietário.


## Publicação estável v0.4.0 — complemento final

Após encerrar a fase RC com ressalvas, o mantenedor autorizou expressamente uma release estável normal e sua disponibilização no atualizador público. O limite anterior de latest/feed v0.3.2 acima descreve o checkpoint do RC e foi substituído pela decisão de publicar a v0.4.0. O ciclo completo v0.3.2 → v0.4.0 não executado permanece como ressalva documentada e aceita, não como teste aprovado.

- Identidade `0.4.0` coerente em npm, Cargo, Tauri, pacote Python e núcleo. Implementação igual à do RC: 109 arquivos de runtime comparados; somente a string de versão do núcleo difere. Uma regressão adicional de diagnóstico bilíngue é exclusiva de teste.
- Novo build Windows isolado com a rotina/chave de assinatura existentes. Nenhum aplicativo instalado, perfil de produção ou runtime em uso foi sobrescrito. Instalador assinado `Sonariel_0.4.0_x64-setup.exe`, 22533414 bytes, SHA-256 `3645f92b041085dbbeb5967407bcf54ac289a308450cfecbae51c5d837e27b5c`. Artefatos RC preservados.
- Checks repetidos na estável: **131 testes Python**, **73 frontend**, **28 Rust nativos** e typecheck aprovados. Build frontend/Tauri/NSIS aprovado; permanece o aviso não bloqueante de tamanho do bundle JavaScript.
- Handshake stdio/versão e **58 ferramentas** reais no MCP estável empacotado aprovados. Duas tentativas de contornar o bloqueio de loops recusadas, inclusive com habilitação de desenvolvimento no pacote. Recorte de referência, uma prévia sintética de ganho de 10 s e duas exportações com hashes passaram; original preservado; **zero tarefas de IA**. O núcleo exclusivo de teste recebeu preparação de encerramento depois.
- Assinatura verificada pela chave pública e versão autenticada `0.4.0`; pacote alterado, truncado e assinatura inválida recusados. Nenhum material privado de assinatura exposto. Não equivale a Authenticode.
- Assets estáveis: instalador, assinatura do atualizador, `latest.json`, lista SHA-256 e licença. O atualizador público aponta ao instalador estável assinado; consultar disponibilidade não instala automaticamente. [Release estável](https://github.com/SCamposs/sonariel/releases/tag/v0.4.0), [notas em português](releases/v0.4.0.pt-BR.md), [English notes](releases/v0.4.0.md).

O instalador estável final não foi executado novamente na VM. A evidência de instalação é o exercício real do RC na VM, implementação preservada e repetição dos checks do pacote/contratos estáveis. Permanecem os limites da tabela: saída audível, desinstalação, FX dentro da VM e ciclo completo do atualizador. Publicar com esses limites é a decisão aceita pelo mantenedor; não significa que todos os cenários originalmente solicitados passaram. Sem geração pesada, mudança de drivers/RAM, terceira rodada musical de loops, atualização da instalação do host ou alteração no Unity.

Verificação pública concluída em 27/10/2026: GitHub informa `v0.4.0` como latest, sem draft/pré-release; o `releases/latest/download/latest.json` público real retorna `0.4.0`. O instalador baixado corresponde ao SHA-256 acima; assinatura pública igual à do manifesto/artefato local assinado e verificada pela chave pública existente. As notas públicas do atualizador contêm a ressalva aceita. Isso confirma disponibilidade da atualização, não execução do ciclo de atualização/reinício de um cliente instalado. A revisão de privacidade examinou 544 blobs alcançáveis e 238 arquivos de trabalho sem achados nos padrões configurados; e-mails históricos de autoria foram mantidos como autorizado. Os 163 links Markdown locais examinados resolveram corretamente.

Commits da fase publicados: `65b0780` (implementação RC e bloqueio de loops), `7283643` (evidência real de instalação Windows), `196642f` (encerramento/ressalvas aceitos pelo proprietário) e `6fd9712` (versão estável, notas, guias e código da release assinada). A tag `v0.4.0` aponta para `6fd9712`; a verificação final da publicação é registrada depois neste relatório, sem substituir binários da release.
