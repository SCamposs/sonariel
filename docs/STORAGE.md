# Armazenamento

A partir da v0.5.0, o armazenamento inclui retenção de 30 dias e exclusão definitiva com prévia e confirmação próprias. A v0.4.0 e anteriores mantêm o descarte recuperável anterior.

Na sidebar, **Armazenamento** reúne os áudios já catalogados: projeto, nome, caminho, tamanho, origem gerenciada/externa e estado. Selecione **Todos os projetos** para consultar o catálogo inteiro.

Não há varredura automática do PC: arquivos antigos que nunca foram catalogados devem ser registrados pela biblioteca para aparecerem. Nenhum arquivo existente é migrado automaticamente. Novas gerações continuam centralizadas na pasta `output` do perfil Sonariel.

## Descartar e recuperar

1. Escolha explicitamente os registros que deseja descartar e clique em **Revisar descarte**.
2. Leia a prévia. Arquivos próprios vão para `tmp/trash` do perfil. Para mover também os importados, ative a opção explícita; sem ela, apenas o registro externo é ocultado. Referências, favoritas, escolhidas, arquivos compartilhados, origens de versões e registros com edições/perfis dependentes ficam protegidos.
3. Confirme somente se concordar. O núcleo revalida a prévia e o hash; mudanças ou arquivos ausentes bloqueiam a operação.
4. Para recuperar, abra **Lixeira recuperável** e clique em **Restaurar**. Nenhum destino existente é sobrescrito.

A lixeira mantém os bytes durante **30 dias**. O núcleo verifica os vencimentos ao iniciar e a cada hora em que estiver ocioso; se estiver fechado, a limpeza aguarda a próxima abertura. Itens da lixeira anterior recebem 30 dias de carência a partir da ativação desta função. A pasta temporária do Windows não controla a retenção. Registros externos apenas ocultos nunca causam exclusão automática do original.

Para liberar espaço imediatamente, selecione itens em **Lixeira recuperável**, clique em **Revisar exclusão definitiva** e confirme a lista de caminhos. Para apagar o arquivo de um importado antigo que só foi oculto, ative também a opção explícita de excluir arquivos importados. A exclusão definitiva remove os bytes e não pode ser restaurada pelo Sonariel. Parâmetros e histórico permanecem como registros de auditoria, sem reaparecer na biblioteca. Não descarte tudo que não é favorito sem uma solicitação explícita: um candidato não avaliado não equivale a um rejeitado.

Descarte/restauração aguardam a fila terminar. Projetos, parâmetros, histórico de tarefas e relações entre versões não são apagados. Cada movimentação tem um registro persistente anterior à operação; se houver uma falha, o item fica na lixeira com orientação de restaurar. Operações em lote podem parar após uma falha: atualize o inventário e confira cada registro antes de repetir.

## Migração

Na Fase 2.5 da main, o schema 5 adiciona tags, filtros por projeto e o registro idempotente dos recortes, com backup consistente de schemas 1–4. Tags e filtros não movem arquivos. Um recorte confirmado produz um WAV próprio com hash, limites por amostra e linhagem; referências e trechos derivados de referências continuam protegidos. A origem de um trecho fica protegida pela relação de dependência. As tags de organização não são incluídas automaticamente no manifesto de exportação. [Evidências da Fase 2.5](PHASE2_5.md).

Na main de desenvolvimento (Fase 2, ainda sem release), o schema 4 adiciona presets musicais e seu histórico de uso, com backup consistente de schemas 1–3. Áudios usados como condicionamento de presets musicais também ficam protegidos do descarte. Use um perfil de prévia separado; a versão estável não abre o banco mais novo. [Instruções e evidências](PHASE2.md).

O schema 3 acrescenta `asset_trash`, sem recriar as tabelas existentes. Antes de migrar schemas 1/2, o app produz um backup SQLite consistente em `backups`. Versões anteriores não devem abrir um banco já migrado; use o backup com suporte técnico caso precise retornar.

MCP: `storage_list` é inventário, `storage_preview` devolve a prévia e seu token, `storage_discard` exige token e confirmação, e `storage_restore` recupera um registro. `storage_purge_preview` e `storage_purge` são separados para a exclusão definitiva. `include_external_files=true` exige autorização explícita para mover ou apagar o arquivo importado. Os testes automatizados e de navegador usam arquivos sintéticos em perfil isolado. [Detalhes técnicos e perfil de qualidade](STORAGE_AND_QUALITY.md).
