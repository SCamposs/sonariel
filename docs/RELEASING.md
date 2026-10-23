# Publicar uma release Windows

As releases oficiais são geradas localmente, assinadas e publicadas no GitHub. Não há chave privada em Git ou em arquivos da release.

## Chave de assinatura

O mantenedor inicializa a chave uma única vez com `scripts/initialize-signing.ps1`. Ela fica fora do repositório, em `%USERPROFILE%\.sonariel\signing\updater.key.dpapi`, protegida para o usuário Windows atual com DPAPI e permissões locais. A chave pública está no config Tauri. O arquivo temporário de chave privada é removido após a proteção.

Não execute a inicialização novamente para uma chave já publicada. Guarde uma cópia segura e recuperável da chave antes de trocar de usuário/instalação Windows: DPAPI CurrentUser não é um backup portátil. A recuperação/exportação da chave exige um procedimento separado e seguro; não a cole em chats, issues ou logs. Perder a chave impede assinar novas atualizações aceitas pelos clientes existentes.

O build descriptografa a chave somente no processo de compilação. Também aceita `TAURI_SIGNING_PRIVATE_KEY` fornecida pelo mantenedor. Não publique variáveis de assinatura. `scripts/build.ps1` sem `-SignUpdates` cria apenas um instalador de desenvolvimento; ele não é uma release oficial assinada para o atualizador.

## Próxima versão

1. Atualize a versão em `package.json`, lock npm, config e Cargo do Tauri, `pyproject.toml` e `core/sonariel/__init__.py`. Adicione `docs/releases/v<versão>.md`.
2. Execute testes Python/React, typecheck, build e os checks relevantes de integração. Nunca gere áudio como parte de um teste de atualização.
3. Execute `scripts/build.ps1 -SignUpdates`. A assinatura deve incluir a versão da aplicação.
4. Execute `scripts/release.ps1 -SkipBuild` para preparar instalador, assinatura, `latest.json`, checksums e licença fora do Git. Os binários ficam em `%USERPROFILE%\.sonariel\releases\<versão>`.
5. Revise os arquivos staged, faça commit e publique o código validado em `main`.
6. Execute `scripts/release.ps1 -SkipBuild -Publish`. O comando verifica o checkout, cria/publica a tag e envia os arquivos para uma release estável. Não substitua binários já publicados sob a mesma versão.

O endpoint do app é `https://github.com/SCamposs/sonariel/releases/latest/download/latest.json`. O manifesto contém plataforma `windows-x86_64`, URL do instalador e assinatura. HTTPS, origem esperada, assinatura e vínculo entre assinatura/versão são verificados. Mantenha as releases públicas para download sem autenticação.

## Comportamento no aplicativo

A consulta padrão acontece ao abrir e a cada hora. A pessoa pode desativá-la e verificar manualmente. A bolinha âmbar sinaliza atualização sem abrir um modal automaticamente. Somente **Atualizar e reiniciar** inicia download/instalação. Não há downgrade automático nem instalação de arquivo escolhido pelo frontend.

O núcleo recusa preparação se houver fila, geração ativa, tarefa remota incerta, setup ou clientes MCP em execução. O motor ocioso gerenciado é descarregado; o núcleo fecha antes do instalador substituir seus arquivos. Não force o fechamento de Codex, Audacity ou processos alheios. No Windows, o NSIS do plugin reabre o aplicativo; dados de produção ficam fora da instalação.

Uma assinatura de atualização Tauri não é uma assinatura Authenticode. A ausência de certificado de editor Windows permanece documentada.
