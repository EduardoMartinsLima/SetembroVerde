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
  store.js           Armazenamento simples em arquivos .jsonl (data/)
```

A rota `GET /cartazes` gera automaticamente os 6 pôsteres para impressão,
já com o QR Code apontando para a URL pública de cada estação.

## Como rodar

Pré-requisito: Node.js 18 ou superior.

```bash
npm install
PORT=3000 ADMIN_KEY="defina-uma-chave-forte" npm start
```

Acesse `http://localhost:3000`.

### Variáveis de ambiente

| Variável          | Obrigatória | Descrição                                                                 |
|-------------------|:-----------:|-----------------------------------------------------------------------------|
| `PORT`            | não         | Porta HTTP (padrão `3000`).                                                |
| `ADMIN_KEY`        | sim, para o painel | Chave de acesso ao painel do RH (`/admin`). Sem ela, o painel fica bloqueado. |
| `PUBLIC_BASE_URL`  | recomendada | URL final publicada (ex.: `https://setembroverde.car.ba.gov.br`), usada para gerar os QR Codes em `/cartazes`. Se não definida, usa o host da requisição. |

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

Os dados de participação ficam em `data/*.jsonl` (um arquivo por estação),
ignorados pelo git. Cada registro contém apenas o conteúdo da resposta e o
horário de envio — nunca informações que identifiquem a pessoa. Ao final da
campanha, recomenda-se exportar os dados de interesse (via `/admin`) e
depois apagar o conteúdo de `data/` caso não seja mais necessário mantê-lo.

## Personalização

- Cores e tipografia: `public/css/style.css`.
- Perguntas do Quiz (Estação 06): `public/estacao-06.html`.
- Textos dos cartazes: cada `estacao-0X.html` e a função `renderCartazesPage`
  em `server/index.js`.
