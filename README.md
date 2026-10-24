# Sonariel

Um aplicativo desktop para criar músicas e vozes com IA local, processar WAVs com efeitos nativos e organizar projetos, sessões e versões. A direção criativa acontece na conversa com o Codex; o Sonariel acompanha a execução e preserva suas escolhas.

> Esta branch prepara **0.3.0-beta.1**, ainda sem release pública. A versão estável nas Releases continua sendo 0.2.0. Consulte [a expansão e suas limitações](docs/EXPANSION.md) antes de testar o preview.

## Baixar para Windows

[Baixe a versão mais recente nas Releases](https://github.com/SCamposs/sonariel/releases/latest).

Escolha `Sonariel_<versão>_x64-setup.exe`. Não é necessário instalar Node, Rust ou Python para usar o aplicativo. Os modelos e o ambiente de geração são preparados separadamente pelo próprio Sonariel, após sua autorização.

- Windows x64 e WebView2 (o instalador oferece o componente quando necessário).
- O padrão musical permanece **CPU, ACE-Step Turbo e DiT-only**. O preview acrescenta Stable Audio 3 Small-Music/Medium via LiteRT CPU, Chatterbox Multilingual V3 e DSP nativo independente. SFT está pendente, não é anunciado como motor operacional. Não há aceleração por GPU neste perfil.
- O **ACE-Step** exige 16 GiB livres para carregar, ou 4 GiB com o motor gerenciado já carregado. Essa proteção não é uma exigência do app inteiro: voz, LiteRT e FX têm limites próprios. A fila executa um pedido por vez, sem carregar modelos ao abrir a interface.
- Internet é necessária para downloads iniciais e atualizações. A geração é local; o Sonariel não envia áudio e prompts a serviços de geração na nuvem.

O instalador ainda não tem assinatura de editor Windows/Authenticode. A assinatura criptográfica dos pacotes de atualização é uma proteção diferente e não remove avisos do Windows sobre editor desconhecido.

## Primeiro uso

1. Abra o Sonariel e percorra o tutorial opcional. Você pode reabri-lo em **Instruções do workflow**, no fim da sidebar.
2. Em **Ambiente**, vincule uma instalação compatível existente ou revise e autorize uma instalação isolada. Vincular não reinstala nem modifica seu ambiente anterior.
3. Em **Projetos & sessões**, crie um projeto e registre a intenção musical. Confira o projeto ativo antes de gerar.
4. Em **Audacity & Codex**, escolha **Configurar conexão Codex**. O app faz backup da configuração e preserva as outras conexões. Recarregue o cliente Codex para carregar as ferramentas MCP.
5. Na conversa com o Codex, peça uma geração pelo Sonariel com direção, duração, BPM, tonalidade e compasso explícitos. Acompanhe o pedido na **Fila de geração**.
6. Escute e compare em **Biblioteca & versões**, registre suas preferências e só então leve a candidata escolhida para o Audacity.

Para a ponte com o Audacity, habilite `mod-script-pipe` e reinicie o editor. O app usa projetos identificados do Sonariel, sem editar um projeto alheio aberto. O original de áudio é preservado ao criar versões editadas.

No preview, **Voice Studio** organiza idiomas/perfis e interpretações solicitadas ao Codex. **FX & processamento** aceita qualquer WAV registrado: adicione/reordene efeitos, ajuste parâmetros, peça uma prévia curta e renderize uma versão completa somente quando desejar. Originais não são sobrescritos. A biblioteca permite comparar duas versões. O setup é independente por motor; Stable Audio exige aceite individual de seus termos, e seus pesos não acompanham o app.

## Atualizações

Clique no número da versão, abaixo do nome Sonariel na sidebar, para abrir **Versão & atualizações**. Uma bolinha âmbar nesse botão indica uma versão nova.

Por padrão, o app consulta as releases oficiais ao abrir e a cada hora. Selecione **Somente quando eu solicitar** para desativar essas consultas e use **Verificar agora** quando quiser. Nenhuma instalação começa sem você escolher **Atualizar e reiniciar**.

O pacote é baixado e sua assinatura é verificada antes da instalação. Aguarde a fila e o setup terminarem e feche conexões MCP do Sonariel antes de atualizar; esses processos podem manter arquivos do aplicativo em uso. No Windows, o instalador fecha e reabre o app. Projetos e áudios ficam fora da pasta do programa.

Quem usa a versão 0.1 precisa instalar a 0.2 uma vez manualmente para receber o atualizador.

## Dados e privacidade

Dados locais ficam por padrão em `%USERPROFILE%\.sonariel`; `SONARIEL_HOME` pode selecionar outro diretório. Projetos, áudio, backups, ambientes, modelos e logs não fazem parte deste repositório. O tutorial e a preferência de atualizações ficam no perfil local do WebView.

O núcleo escuta somente em loopback, com autenticação local. Abrir o aplicativo ou o MCP não carrega modelos. O Sonariel não contém telemetria de uso. As consultas opcionais de atualização acessam o GitHub, que recebe os dados normais de uma conexão HTTP; elas não enviam áudio, prompts ou o banco de projetos. Downloads de componentes usam suas fontes oficiais.

## Licença

O código próprio usa a [Sonariel Source Available License 1.0](LICENSE):

- Você pode usar o app para criar músicas, vendê-las, licenciá-las e realizar trabalhos criativos pagos.
- Pode estudar, modificar e redistribuir gratuitamente o código/app, mantendo a licença e os avisos.
- Não pode vender o Sonariel, versões modificadas ou acesso a ele como serviço pago sem autorização separada.

É **código disponível, não uma licença open source aprovada pela OSI**. A licença não transfere direitos sobre modelos ou referências e não garante que um áudio gerado esteja livre de direitos de terceiros. As [dependências têm suas próprias licenças](THIRD_PARTY_NOTICES.md).

## Desenvolvimento

Desktop Tauri 2 + React/TypeScript com núcleo Python leve. Requer Node 22.12+, Rust/MSVC e Python 3.12 para desenvolvimento, não para o usuário final.

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
npm.cmd ci
& .venv/Scripts/python.exe -m pytest -q
npm.cmd test
npm.cmd run typecheck
npm.cmd run dev
```

`npm run dev` é uma superfície local de verificação. O produto distribuído é o desktop Tauri. `scripts/build.ps1` prepara um instalador de desenvolvimento sem assinatura de atualização; releases oficiais usam o fluxo assinado em [docs/RELEASING.md](docs/RELEASING.md).

Para testar esta branch sem substituir o app estável, execute `scripts/build.ps1` e depois `scripts/run-preview.ps1`. O segundo comando prepara uma cópia executável em `%USERPROFILE%\SonarielPreview\0.3.0-beta.1` e usa `%USERPROFILE%\.sonariel-preview`, separado do perfil estável. O instalador gerado é apenas um artefato de revisão; não é instalado automaticamente. Não conecte o Codex de produção ao preview por engano: ele tem banco e núcleo próprios.

## Documentação e limitações

- [Arquitetura e limites entre processos](docs/ARCHITECTURE.md)
- [Setup e integridade](docs/SETUP.md)
- [Codex/MCP](docs/CODEX.md)
- [Recuperação](docs/RECOVERY.md)
- [Validação: o que foi realmente testado](docs/VALIDATION.md)
- [Expansão de música, voz e FX](docs/EXPANSION.md)
- [Componentes de interação](src/ui/README.md)

Não há cancelamento de inferência ativa; só pedidos ainda não enviados ao motor podem ser cancelados. O teste em uma máquina não garante o mesmo desempenho ou consumo de RAM em outra. Consulte a validação antes de usar o app em uma produção importante.
