# Armazenamento

Na sidebar, **Armazenamento** reúne os áudios já catalogados: projeto, nome, caminho, tamanho, origem gerenciada/externa e estado. Selecione **Todos os projetos** para consultar o catálogo inteiro.

Não há varredura automática do PC: arquivos antigos que nunca foram catalogados devem ser registrados pela biblioteca para aparecerem. Nenhum arquivo existente é migrado automaticamente. Novas gerações continuam centralizadas na pasta `output` do perfil Sonariel.

## Descartar e recuperar

1. Escolha explicitamente os registros que deseja descartar e clique em **Revisar descarte**.
2. Leia a prévia. WAVs próprios do app serão movidos para a lixeira interna; arquivos externos terão apenas o registro ocultado. Referências, favoritas, escolhidas, arquivos compartilhados, origens de versões e registros com edições/perfis dependentes ficam protegidos.
3. Confirme somente se concordar. O núcleo revalida a prévia e o hash; mudanças ou arquivos ausentes bloqueiam a operação.
4. Para recuperar, abra **Lixeira recuperável** e clique em **Restaurar**. Nenhum destino existente é sobrescrito.

A lixeira **não libera espaço em disco**: os bytes são preservados para restauração. Esta versão não oferece exclusão permanente nem esvaziamento automático. O inventário exibe os caminhos da lixeira sem exigir que você procure arquivos dispersos. Não descarte tudo que não é favorito: um candidato não avaliado não equivale a um rejeitado.

Descarte/restauração aguardam a fila terminar. Projetos, parâmetros, histórico de tarefas e relações entre versões não são apagados. Cada movimentação tem um registro persistente anterior à operação; se houver uma falha, o item fica na lixeira com orientação de restaurar. Operações em lote podem parar após uma falha: atualize o inventário e confira cada registro antes de repetir.

## Migração

Na Fase 2.5 da main, o schema 5 adiciona tags, filtros por projeto e o registro idempotente dos recortes, com backup consistente de schemas 1–4. Tags e filtros não movem arquivos. Um recorte confirmado produz um WAV próprio com hash, limites por amostra e linhagem; referências e trechos derivados de referências continuam protegidos. A origem de um trecho fica protegida pela relação de dependência. As tags de organização não são incluídas automaticamente no manifesto de exportação. [Evidências da Fase 2.5](PHASE2_5.md).

Na main de desenvolvimento (Fase 2, ainda sem release), o schema 4 adiciona presets musicais e seu histórico de uso, com backup consistente de schemas 1–3. Áudios usados como condicionamento de presets musicais também ficam protegidos do descarte. Use um perfil de prévia separado; a versão estável não abre o banco mais novo. [Instruções e evidências](PHASE2.md).

O schema 3 acrescenta `asset_trash`, sem recriar as tabelas existentes. Antes de migrar schemas 1/2, o app produz um backup SQLite consistente em `backups`. Versões anteriores não devem abrir um banco já migrado; use o backup com suporte técnico caso precise retornar.

MCP: `storage_list` é inventário, `storage_preview` devolve a prévia e seu token, `storage_discard` exige token e confirmação, e `storage_restore` recupera um registro. Não forneça confirmação de descarte ao Codex sem escolher os itens. Nenhuma limpeza de produção foi executada para validar esta funcionalidade.
