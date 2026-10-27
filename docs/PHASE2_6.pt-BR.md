# Fase 2.6 — estabilização e preparação para decisão de release

[Relatório técnico completo em inglês](PHASE2_6.md)

Avaliação em **27 de outubro de 2026**, partindo da main limpa em `84f5237`. A distribuição continua na **v0.3.2, schema 3**; o desenvolvimento usa schema 5. Esta fase não autoriza release, tag, novo instalador oficial, publicação no atualizador ou escolha antecipada de versão.

## 1. Funcionalidades prontas

Projetos/sessões, recortes não destrutivos com papel e motor explícitos, tags/filtros por projeto, presets, exportação WAV e interface EN/PT-BR têm as evidências técnicas descritas no relatório. Originais e linhagem são preservados. Não houve mudança no design, motores, gates de RAM, formatos ou dependências.

## 2. Funcionalidades experimentais

Stable Audio e voz conservam as limitações já documentadas. Os loops passaram na integridade técnica, mas **não têm aceite musical**. Duas rodadas foram rejeitadas e permanecem preservadas. Não houve terceira rodada nem aprovação automática.

## 3. Pendências bloqueantes

Antes de publicar: sua decisão sobre disponibilidade dos loops, definição de versão e autorização de release; depois, teste completo de instalação/atualização do candidato assinado em ambiente isolado. A migração do banco e a verificação da assinatura antiga não substituem esse percurso.

## 4. Pendências não bloqueantes

Aviso de bundle, editor desconhecido do Windows e limites históricos de hardware/integrações permanecem explícitos. A seleção A/B é temporária em memória, não um dado persistido da v0.3.2; favoritos e escolha atual são persistidos. Não foi prometida persistência nova de A/B ou rascunho FX após reiniciar.

## 5. Migrações e correções

Foi reproduzida uma migração parcial quando a criação de tabela ou a preferência de idioma falhavam. Tabelas, marcador de versão e preferência agora ficam na mesma transação e sofrem rollback conjunto.

Testes com SQL exato e código real da v0.3.2 verificaram schema 3 → 5, backup SQLite consistente com WAL aberto, preservação de registros/arquivos, idioma, reinício, recuperação de fila e recusa do banco novo pelo código antigo. Falhas SQL e encerramento abrupto de um processo exclusivo de teste deixaram o perfil anterior recuperável. Não houve cópia insegura de banco aberto ou migração de produção.

O build também ganhou recusa antecipada de runtime em uso. O problema foi encontrado numa tentativa real de empacotar: o Windows bloqueou uma DLL após limpeza parcial. Arquivos ausentes de desenvolvimento foram restaurados de runtime preservado com o mesmo hash do executável, sem sobrescrever arquivos existentes ou encerrar processos. O novo pacote foi construído em outra pasta. A coleta de licenças aceita um destino separado para essa validação.

## 6. Desktop

Reutilizadas as verificações nativas da [Fase 2.5](PHASE2_5.md), em 1000×700 e 1280×720, EN/PT-BR: foco/teclado, diálogos, importação, presets, player, A/B, rolagem, exportação e paginação. Nenhum código frontend mudou nesta fase; os 71 testes passaram novamente. Não se declara uma nova rodada de cliques nem certificação de leitor de tela/DPI. 900×600 segue fora do mínimo.

## 7. Loops

A primeira rodada encurtou 16 s para 15,8 s (**1,25%**). Na segunda, os 120 ms removidos representaram **2,81% e 1,51%** das regiões. Os WAVs são finitos e sem clipping; isso não comprova continuidade musical. Não havia comprovação de pulsação, frase completa, posição harmônica equivalente ou tratamento correto das caudas.

A seleção compensada já existente preserva o período quando o timing é conhecido. Não corrige uma frase inadequada ou tempo instável. Mudar curva de fade pode alterar nível/picos, mas não resolve esses problemas. Não foi acrescentado um algoritmo sem evidência de utilidade.

Antes de outra escuta: escolher material autorizado com frase repetível, verificar ataques/pulso/harmonia, definir entrada/saída e caudas, conservar período e volume, comparar controle sem fade com uma sobreposição justificada em um e três ciclos. Se o material não permitir, a solução pode exigir edição musical no Audacity ou composição própria para loop. A #3 permanece aberta.

## 8. Riscos de distribuição

Banco schema 5 exige backup e não pode voltar silenciosamente ao core antigo. Preferências locais do WebView precisam sobreviver ao instalador real. Registro MCP e modelos de produção não foram alterados. Verificação criptográfica do atualizador é diferente de assinatura Authenticode; o aviso de editor desconhecido permanece.

## 9. Testes e integrações

- **126 Python, 71 frontend e 28 Rust passaram**; typecheck e builds frontend/Windows sem bundle passaram. O target Tauri executou zero testes, não um teste de UI.
- Core Windows empacotado: handshake real com **59 ferramentas**, perfil limpo e snapshots do perfil migrado. Sem geração musical/voz ou instalação de modelos.
- Manifesto público v0.3.2 acessível, hash do instalador igual ao digest do GitHub, assinatura pública válida e bytes adulterados rejeitados. Nenhuma chave privada foi acessada, reinicializada ou exportada.
- Não foi executada a atualização por instalador de uma versão futura nem novo handoff de Audacity de produção. Contratos simulados e medições antigas não são declarados inferências reais desta fase.

## 10. Recomendações

Para os loops, recomendo tecnicamente **C — aguardar melhoria comprovada e seu aceite auditivo**, sem decidir por você. Alternativas: **A**, excluir da próxima distribuição mediante controle avaliado; **B**, disponibilizar claramente como experimental, sem promessa de continuidade. Nenhuma opção foi aplicada automaticamente.

O JavaScript principal mede **736,39 kB / 235,33 kB gzip**; notas de release já são carregadas separadamente (**120,15 / 37,16 kB**). Não há medida de benefício que justifique refatorar toda a UI apenas pelo warning. Não houve otimização especulativa nem alegação de redução de RAM.

## 11. Publicação do código

Commits validados: `b471c6f` (migração atômica e recuperação) e `a09c89f` (proteção do runtime em uso e licenças isoladas), publicados na main com este relatório. Sem PR, release, tag ou substituição de artefatos públicos. Higiene por padrões: 475 blobs históricos e 230 arquivos do working tree, sem achados; 38 links locais da documentação alterada validados. Isso não é uma auditoria completa de segurança. Áudios, recibos, perfis e chaves permanecem fora do Git; e-mails históricos de autoria foram mantidos conforme autorizado.

## 12. Decisões suas

Escolher A/B/C para loops e, numa etapa posterior, autorizar a versão e a construção/teste do candidato de distribuição. #6 offline estrito continua dependendo de validação real de caches/rede; #7 GPU, #8 cancelamento ativo e #9 prévias generativas permanecem investigações independentes, sem implementação nesta rodada.
