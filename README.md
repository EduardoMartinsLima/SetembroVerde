# Trilha da Inclusão CAR — Setembro Verde 2026

Páginas destino dos 6 QR Codes da ação **Trilha da Inclusão CAR**, prevista no
Despacho SEI nº 00147265013 (Processo 082.1727.2026.0003492-56), do
CAR/DEPRH. Cada QR Code impresso nos cartazes leva a uma página mobile-first
com uma experiência diferente: informação, quiz, reflexão ou participação.

**A participação é 100% anônima.** Nenhuma página pede nome, matrícula,
e-mail ou login. Não é feito nenhum registro de IP ou identificador do
navegador junto das respostas armazenadas.

## Dois back-ends, um único front-end

O projeto tem **duas implementações de back-end** que servem exatamente as
mesmas páginas em `public/` (HTML/CSS/JS idênticos, mesmas rotas de API):

- **Node.js/Express** (`server/`) — caminho padrão, use se o servidor
  tiver Node 18+.
- **ASP.NET/C# para IIS** (`public/App_Code/`, `public/api/*.ashx`) —
  alternativa para hospedar num Windows Server antigo demais para rodar
  qualquer versão atual do Node (ver seção [Publicação em IIS](#publicação-em-iis-windows-server-antigo) abaixo).
  Precisa apenas do .NET Framework 4.5+ e do IIS — nada para instalar.

Escolha um dos dois; não use os dois ao mesmo tempo apontando pro mesmo
banco (não tem problema técnico, mas não faz sentido rodar em duplicidade).

A página `public/cartazes.html` gera os QR Codes **no navegador** (usa
`public/js/qrcode.js`, vendorizada, sem dependência externa) a partir da
própria URL da página — funciona igual nos dois back-ends, sem precisar
configurar a URL pública em lugar nenhum.

## Estrutura

```
public/
  index.html          Página inicial (hub) com links para as 6 estações
  estacao-01.html      01 — Você Sabia?
  estacao-02.html      02 — Mito ou Verdade?
  estacao-03.html      03 — E se fosse com você? (coleta resposta livre)
  estacao-04.html      04 — Meu Compromisso (coleta checklist + compromisso)
  estacao-05.html      05 — Minha Folha na Árvore (coleta frase curta)
  estacao-06.html      06 — Quiz da Inclusão (5 perguntas, pontuação)
  admin.html           Painel para o RH ver os resultados agregados
  cartazes.html        Pôsteres para impressão, com QR Code gerado no navegador
  css/, js/            Estilos e scripts compartilhados (incluindo qrcode.js)
  App_Code/, api/*.ashx, Web.config, Global.asax
                        Back-end ASP.NET/C# (alternativa pro IIS — ver abaixo)
server/
  index.js             Servidor Express (páginas + API) — back-end Node.js
  db.js                Conexão com o SQL Server (pool node-mssql)
  store.js             Consultas de leitura/escrita das participações
sql/
  schema.sql            Script de criação manual das tabelas (opcional, os dois back-ends usam o mesmo schema)
scripts/
  check-db.js            Testa a conexão com o SQL Server (npm run db:check) — só Node.js
.env.example             Modelo de variáveis de ambiente do back-end Node.js (copiar para .env)
```

## Como rodar (back-end Node.js)

Pré-requisitos: Node.js 18+ e acesso de rede a uma instância do **SQL Server**
(local, na rede da CAR, ou Azure SQL). Como o banco costuma estar só na rede
interna, este roteiro é pensado para a própria TI rodar, sem precisar
compartilhar credenciais com mais ninguém.

1. Copie o arquivo de exemplo e preencha com os dados reais do banco:
   ```bash
   cp .env.example .env
   ```
   Edite `.env` e defina pelo menos `DB_SERVER`, `DB_DATABASE`, `DB_USER`,
   `DB_PASSWORD` e `ADMIN_KEY`. Esse arquivo **nunca** é commitado (já está
   no `.gitignore`).

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Valide a conexão com o banco antes de subir o site (não sobe servidor
   HTTP, só testa a conexão e, se `DB_AUTO_MIGRATE` não estiver como
   `false`, já cria as 4 tabelas):
   ```bash
   npm run db:check
   ```
   Uma falha aqui aponta exatamente o que corrigir (rede/firewall, nome do
   servidor, banco, usuário/senha ou permissões) sem precisar envolver
   quem preparou a aplicação.

4. Suba a aplicação:
   ```bash
   npm start
   ```
   Acesse `http://localhost:3000` (ou a `PORT` configurada).

5. Teste rapidamente cada estação pelo celular ou pelo navegador — em
   especial as que gravam dados (03, 04, 05 e 06) — e confira em seguida
   no painel `/admin.html` (com a `ADMIN_KEY` definida) se as respostas
   apareceram.

Se preferir que as tabelas sejam criadas manualmente por um DBA (por
exemplo, para rodar a aplicação depois com um login sem permissão de DDL),
rode `sql/schema.sql` uma vez com um usuário com permissão de criação de
tabelas e suba a aplicação com `DB_AUTO_MIGRATE=false`.

### Variáveis de ambiente

| Variável          | Obrigatória | Descrição                                                                 |
|-------------------|:-----------:|-----------------------------------------------------------------------------|
| `PORT`            | não         | Porta HTTP (padrão `3000`).                                                |
| `ADMIN_KEY`        | sim, para o painel | Chave de acesso ao painel do RH (`/admin.html`). Sem ela, o painel fica bloqueado. |
| `DB_SERVER`        | sim         | Endereço do SQL Server (nome, IP ou `servidor\instância`).                |
| `DB_DATABASE`      | sim         | Nome do banco de dados a usar.                                            |
| `DB_USER`          | sim         | Login SQL usado pela aplicação.                                           |
| `DB_PASSWORD`      | sim         | Senha do login acima.                                                     |
| `DB_PORT`          | não         | Porta do SQL Server (padrão `1433`). Ignorado se `DB_INSTANCE` for usado. |
| `DB_INSTANCE`      | não         | Nome da instância nomeada (ex.: `SQLEXPRESS`), quando aplicável.          |
| `DB_ENCRYPT`        | não         | `true`/`false` — força TLS na conexão (padrão `true`).                    |
| `DB_TRUST_SERVER_CERTIFICATE` | não | `true` para aceitar certificado autoassinado do servidor on-premises. |
| `DB_AUTO_MIGRATE`  | não         | `false` para não criar as tabelas automaticamente (ver `sql/schema.sql`). |

> A aplicação usa autenticação SQL (login e senha). Se a política da CAR
> exigir autenticação integrada do Windows/Azure AD, avise a TI: é possível
> adaptar `server/db.js` para usar `azure-active-directory-*` ou NTLM,
> suportados pelo driver `mssql`.

### Permissões recomendadas para o login da aplicação

O login usado em `DB_USER`/`DB_PASSWORD` só precisa de `SELECT` e `INSERT`
nas 4 tabelas da aplicação (`TrilhaRespostas`, `TrilhaCompromissos`,
`TrilhaFolhas`, `TrilhaQuiz`). Não é necessário `UPDATE`, `DELETE` nem
permissão de DDL — a não ser que `DB_AUTO_MIGRATE` fique ligado (padrão),
caso em que ele também precisa poder criar tabelas na primeira execução.

## Publicação (TI / Informática)

Conforme observado no despacho, a publicação depende da aprovação dos
setores de **Tecnologia da Informação** e da **ASCOM**. Sugestão de fluxo:

1. Publicar a aplicação em um servidor/serviço interno ou externo acessível
   pelo celular dos empregados — usando o back-end Node.js (padrão) ou o
   ASP.NET/IIS (ver seção abaixo, para servidores Windows antigos demais
   para o Node atual).
2. Definir um valor forte para `ADMIN_KEY` e repassá-lo apenas à equipe do
   RH responsável por acompanhar os resultados, através do `/admin.html`.
3. Abrir `/cartazes.html` **pela URL final publicada**, clicar em "Imprimir
   cartazes" e fixá-los nos locais sugeridos no despacho (recepção,
   escadas, corredores, relógios de ponto, salas de trabalho e espaço de
   convivência). Os QR Codes são gerados a partir da URL da própria
   página, então é importante abri-la já no endereço definitivo.

## Publicação em IIS (Windows Server antigo)

Se o servidor disponível só tiver um Windows Server antigo demais pra
rodar qualquer versão atual do Node.js (por exemplo, **Windows Server
2008 R2**, cujo suporte estendido da Microsoft encerrou em janeiro de
2020 — o Node.js 18+ se recusa a iniciar nesse tipo de SO), use a versão
ASP.NET/C# do back-end, que já vem pronta no mesmo repositório.

### Pré-requisitos

- IIS com o recurso **ASP.NET** habilitado (`Web-Asp-Net` no Gerenciador
  do Servidor).
- **.NET Framework 4.5 ou superior** instalado (confira com):
  ```powershell
  Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" | Select-Object Release, Version
  ```
- O .NET Framework 4.x registrado no IIS (rode **como Administrador**,
  uma vez só; termina com "Finished installing ASP.NET"):
  ```powershell
  & "$env:windir\Microsoft.NET\Framework64\v4.0.30319\aspnet_regiis.exe" -i
  ```

### Passos

1. Copie (ou extraia o zip) o repositório inteiro para uma pasta, por
   exemplo `C:\inetpub\wwwroot\SetembroVerde`.

2. Configure as credenciais do banco — copie os dois arquivos de exemplo
   dentro de `public\` e preencha com os dados reais:
   ```powershell
   cd C:\inetpub\wwwroot\SetembroVerde\public
   Copy-Item connectionStrings.config.example connectionStrings.config
   Copy-Item appSettings.config.example appSettings.config
   ```
   Edite `connectionStrings.config` (dados do SQL Server) e
   `appSettings.config` (a `AdminKey`). Esses dois arquivos **nunca** são
   versionados (já estão no `.gitignore`) e o próprio ASP.NET bloqueia
   requisições HTTP diretas para qualquer `*.config` — mas depois do
   deploy vale testar no navegador (`/connectionStrings.config` deve dar
   404/403, nunca mostrar o conteúdo).

3. No **IIS Manager**, aponte o site (ou uma Application dedicada) para a
   pasta `public\` (não para a raiz do repositório — é ali que ficam
   `Web.config`, `Global.asax` e o `App_Code`). Se `public\` for só uma
   subpasta dentro de um site maior, converta-a em Application
   (botão direito → "Convert to Application") e associe a um Application
   Pool configurado com:
   - .NET CLR Version: **v4.0**
   - Managed Pipeline Mode: **Integrated**

   Alternativa via linha de comando (`appcmd`, já vem com o IIS, não
   precisa de nenhum recurso extra do Windows):
   ```powershell
   $appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
   & $appcmd add apppool /name:"SetembroVerdeAppPool" /managedRuntimeVersion:v4.0 /managedPipelineMode:Integrated
   & $appcmd add app /site.name:"Default Web Site" /path:/SetembroVerde /physicalPath:"C:\inetpub\wwwroot\SetembroVerde\public"
   & $appcmd set app "Default Web Site/SetembroVerde" /applicationPool:"SetembroVerdeAppPool"
   ```

4. Teste a conexão com o banco abrindo, no navegador, o endereço:
   ```
   http://localhost/SetembroVerde/api/health.ashx
   ```
   (ajuste o caminho conforme o binding do site). Uma resposta
   `{"ok":true,"sqlServerVersion":"..."}` confirma que o ASP.NET está
   rodando e conseguindo falar com o SQL Server — inclusive já criou as
   4 tabelas automaticamente na primeira execução (`Global.asax` chama
   isso no início da aplicação). Um erro aqui aponta exatamente o
   problema (connection string, rede, permissão) sem precisar mexer em
   mais nada.

5. Percorra as 6 estações pelo navegador/celular e confira no `/admin.html`
   (com a `AdminKey` que você definiu) se as respostas de teste aparecem.

6. Abra `/cartazes.html` já pela URL pública final e imprima os pôsteres.

### O que muda em relação ao back-end Node.js

- Mesmo schema de banco (`sql/schema.sql`), mesmas 4 tabelas, mesma
  política de anonimato — os dois back-ends podem inclusive apontar pro
  mesmo banco (não ao mesmo tempo em produção, mas dá pra migrar de um
  pro outro sem perder dados).
- As mesmas páginas HTML/CSS/JS de `public/` são usadas sem nenhuma
  alteração — só o back-end que processa `/api/*.ashx` é diferente.
- Não tem passo de build: o IIS compila os `.ashx`/`App_Code` sozinho na
  primeira requisição (igual o PHP faz com `.php`), então basta copiar os
  arquivos.

## Painel do RH (`/admin.html`)

Mostra, de forma agregada e anônima:

- Números da campanha (mensagens recebidas, compromissos registrados,
  respostas no quiz, média de acertos);
- Frequência das atitudes de compromisso mais escolhidas (Estação 04);
- Lista das respostas livres da Estação 03 (para seleção de frases a usar
  na comunicação de encerramento);
- Lista das frases da Árvore da Inclusão (Estação 05), para impressão em
  formato de folhas no painel físico.

Acesso exige a `ADMIN_KEY` configurada no servidor — recomenda-se também
restringir `/admin.html` por VPN/rede interna caso a aplicação fique exposta
publicamente.

## Dados armazenados

Os dados de participação ficam em 4 tabelas no SQL Server configurado
(`TrilhaRespostas`, `TrilhaCompromissos`, `TrilhaFolhas`, `TrilhaQuiz`, ver
`sql/schema.sql`). Cada registro contém apenas o conteúdo da resposta e o
horário de envio (`CriadoEm`) — nunca informações que identifiquem a
pessoa. Ao final da campanha, recomenda-se exportar os dados de interesse
(via `/admin.html` ou diretamente do banco) e, se a CAR não precisar mantê-los,
truncar essas tabelas.

## Personalização

- Cores e tipografia: `public/css/style.css`.
- Perguntas do Quiz (Estação 06): `public/estacao-06.html`.
- Textos dos cartazes: cada `estacao-0X.html` e a lista `ESTACOES` em
  `public/cartazes.html`.
- Rotas de API: se alterar o caminho de algum endpoint, atualize nos três
  lugares — a página HTML que faz o `fetch`, `server/index.js` (Node) e o
  `.ashx` correspondente em `public/api/` (ASP.NET) — os dois back-ends
  precisam continuar respondendo nos mesmos caminhos.
