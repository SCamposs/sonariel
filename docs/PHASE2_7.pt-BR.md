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

## Entrega e recomendação

Evidências privadas incluem inventário do candidato, recibo MCP/FX, migração, reinício, observações da instalação na VM, builds isolados e fixture não utilizada do atualizador. Tudo permanece fora do Git. Aplicativo estável instalado, dados de produção, ambientes/modelos e projetos Unity foram preservados.

O proprietário aceitou a validação Windows de instalação/uso básico e escolheu explicitamente encerrar a Fase 2.7 com o ciclo de atualização não testado registrado como ressalva, em vez de mantê-lo como requisito pendente da fase. Os demais itens não testados acima permanecem como limites desse aceite. Essa decisão não transforma evidência ausente em teste aprovado. **Fase encerrada com ressalvas; adequada como pré-release de teste. O aceite completo v0.3.2 → RC continua sem verificação para uma afirmação irrestrita de prontidão estável.** Promoção/publicação estável e alteração do feed continuam dependendo de decisão separada do proprietário.
