# Trilha da Inclusão CAR — Setembro Verde 2026

Páginas destino dos 6 QR Codes da ação **Trilha da Inclusão CAR**, prevista no
Despacho SEI nº 00147265013 (Processo 082.1727.2026.0003492-56), do
CAR/DEPRH. Cada QR Code impresso nos cartazes leva a uma página mobile-first
com uma experiência diferente: informação, quiz, reflexão ou participação.

**A participação é 100% anônima.** Nenhuma página pede nome, matrícula,
e-mail ou login. Não é feito nenhum registro de IP ou identificador do
navegador junto das respostas armazenadas.

## Estrutura

```
public/
  index.html        Página inicial (hub) com links para as 6 estações
  estacao-01.html    01 — Você Sabia?
  estacao-02.html    02 — Mito ou Verdade?
  estacao-03.html    03 — E se fosse com você? (coleta resposta livre)
  estacao-04.html    04 — Meu Compromisso (coleta checklist + compromisso)
  estacao-05.html    05 — Minha Folha na Árvore (coleta frase curta)
  estacao-06.html    06 — Quiz da Inclusão (5 perguntas, pontuação)
  admin.html         Painel para o RH ver os resultados agregados
server/
  index.js           Servidor Express (páginas + API)
  db.js              Conexão com o SQL Server (pool node-mssql)
  store.js           Consultas de leitura/escrita das participações
sql/
  schema.sql          Script de criação manual das tabelas (opcional)
```

A rota `GET /cartazes` gera automaticamente os 6 pôsteres para impressão,
já com o QR Code apontando para a URL pública de cada estação.

## Como rodar

Pré-requisitos: Node.js 18+ e acesso de rede a uma instância do **SQL Server**
(local, na rede da CAR, ou Azure SQL).

```bash
npm install
PORT=3000 \
ADMIN_KEY="defina-uma-chave-forte" \
DB_SERVER="nome-ou-ip-do-servidor" \
DB_DATABASE="SetembroVerde" \
DB_USER="usuario_app" \
DB_PASSWORD="senha_do_usuario" \
npm start
```

Acesse `http://localhost:3000`.

Na primeira execução, a aplicação cria automaticamente as 4 tabelas de que
precisa (ver `sql/schema.sql`), caso ainda não existam. Se preferir que a TI
crie as tabelas manualmente (por exemplo, para usar um login de aplicação
sem permissão de DDL), rode `sql/schema.sql` uma vez e suba a aplicação com
`DB_AUTO_MIGRATE=false`.

### Variáveis de ambiente

| Variável          | Obrigatória | Descrição                                                                 |
|-------------------|:-----------:|-----------------------------------------------------------------------------|
| `PORT`            | não         | Porta HTTP (padrão `3000`).                                                |
| `ADMIN_KEY`        | sim, para o painel | Chave de acesso ao painel do RH (`/admin`). Sem ela, o painel fica bloqueado. |
| `PUBLIC_BASE_URL`  | recomendada | URL final publicada (ex.: `https://setembroverde.car.ba.gov.br`), usada para gerar os QR Codes em `/cartazes`. Se não definida, usa o host da requisição. |
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
   pelo celular dos empregados (ex.: um servidor Node atrás do proxy
   reverso já usado pela CAR, ou qualquer serviço de hospedagem Node).
2. Definir a URL pública definitiva e configurar `PUBLIC_BASE_URL` com ela
   **antes** de gerar/imprimir os cartazes em `/cartazes`, para que os QR
   Codes apontem para o endereço correto.
3. Definir um valor forte para `ADMIN_KEY` e repassá-lo apenas à equipe do
   RH responsável por acompanhar os resultados, através do `/admin`.
4. Imprimir os cartazes da rota `/cartazes` (botão "Imprimir cartazes") e
   fixá-los nos locais sugeridos no despacho (recepção, escadas,
   corredores, relógios de ponto, salas de trabalho e espaço de convivência).

## Painel do RH (`/admin`)

Mostra, de forma agregada e anônima:

- Números da campanha (mensagens recebidas, compromissos registrados,
  respostas no quiz, média de acertos);
- Frequência das atitudes de compromisso mais escolhidas (Estação 04);
- Lista das respostas livres da Estação 03 (para seleção de frases a usar
  na comunicação de encerramento);
- Lista das frases da Árvore da Inclusão (Estação 05), para impressão em
  formato de folhas no painel físico.

Acesso exige a `ADMIN_KEY` configurada no servidor — recomenda-se também
restringir `/admin` por VPN/rede interna caso a aplicação fique exposta
publicamente.

## Dados armazenados

Os dados de participação ficam em 4 tabelas no SQL Server configurado
(`TrilhaRespostas`, `TrilhaCompromissos`, `TrilhaFolhas`, `TrilhaQuiz`, ver
`sql/schema.sql`). Cada registro contém apenas o conteúdo da resposta e o
horário de envio (`CriadoEm`) — nunca informações que identifiquem a
pessoa. Ao final da campanha, recomenda-se exportar os dados de interesse
(via `/admin` ou diretamente do banco) e, se a CAR não precisar mantê-los,
truncar essas tabelas.

## Personalização

- Cores e tipografia: `public/css/style.css`.
- Perguntas do Quiz (Estação 06): `public/estacao-06.html`.
- Textos dos cartazes: cada `estacao-0X.html` e a função `renderCartazesPage`
  em `server/index.js`.
