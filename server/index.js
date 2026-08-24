// Trilha da Inclusão CAR - Setembro Verde 2026
// Servidor das páginas destino dos QR Codes + API de participação anônima.

require('dotenv').config();

const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
// URL pública fixa (definida pela TI/ASCOM ao publicar). Se vazia, usamos o host da requisição.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Proteção simples contra spam (sem guardar identificação da pessoa) ---
// Janela deslizante em memória, por IP, apenas para limitar taxa de envio.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const hits = new Map();

function rateLimited(req) {
  const ip = req.ip || 'anon';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT_MAX;
}

function cleanText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// --- API pública das estações ---

// Estação 03 — "E se fosse com você?"
app.post('/api/respostas', async (req, res, next) => {
  try {
    if (rateLimited(req)) return res.status(429).json({ erro: 'Muitos envios. Tente novamente em instantes.' });
    const texto = cleanText(req.body?.texto, 500);
    if (!texto) return res.status(400).json({ erro: 'Escreva sua resposta antes de enviar.' });
    await store.append('respostas', { texto });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Estação 04 — "Meu Compromisso"
app.post('/api/compromissos', async (req, res, next) => {
  try {
    if (rateLimited(req)) return res.status(429).json({ erro: 'Muitos envios. Tente novamente em instantes.' });
    const itensPermitidos = [
      'Respeito a autonomia das pessoas.',
      'Pergunto antes de ajudar.',
      'Não reproduzo preconceitos.',
      'Respeito as diferenças.',
      'Evito atitudes capacitistas.',
      'Procuro perceber e eliminar barreiras.',
      'Trato todos com respeito e dignidade.',
      'Procuro aprender mais sobre inclusão.',
    ];
    const itensRecebidos = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const itens = itensRecebidos.filter((i) => itensPermitidos.includes(i));
    const compromisso = cleanText(req.body?.compromisso, 300);
    if (itens.length === 0 && !compromisso) {
      return res.status(400).json({ erro: 'Selecione ao menos uma atitude ou escreva seu compromisso.' });
    }
    await store.append('compromissos', { itens, compromisso });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Estação 05 — "Minha Folha na Árvore"
app.post('/api/folhas', async (req, res, next) => {
  try {
    if (rateLimited(req)) return res.status(429).json({ erro: 'Muitos envios. Tente novamente em instantes.' });
    const texto = cleanText(req.body?.texto, 120);
    if (!texto) return res.status(400).json({ erro: 'Complete a frase antes de enviar.' });
    await store.append('folhas', { texto });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Estação 06 — "Quiz da Inclusão"
app.post('/api/quiz', async (req, res, next) => {
  try {
    if (rateLimited(req)) return res.status(429).json({ erro: 'Muitos envios. Tente novamente em instantes.' });
    const acertos = Number.isInteger(req.body?.acertos) ? req.body.acertos : -1;
    const total = Number.isInteger(req.body?.total) ? req.body.total : -1;
    if (acertos < 0 || total !== 5 || acertos > total) {
      return res.status(400).json({ erro: 'Resultado de quiz inválido.' });
    }
    await store.append('quiz', { acertos, total });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Números públicos da campanha (painel de encerramento)
app.get('/api/stats', async (_req, res, next) => {
  try {
    const [respostas, folhas, compromissos, quiz] = await Promise.all([
      store.count('respostas'),
      store.count('folhas'),
      store.count('compromissos'),
      store.count('quiz'),
    ]);
    res.json({
      mensagensRecebidas: respostas + folhas,
      compromissosRegistrados: compromissos,
      respostasNoQuiz: quiz,
      participacoesTotais: respostas + folhas + compromissos + quiz,
    });
  } catch (err) {
    next(err);
  }
});

// --- Cartazes com QR Code (impressão) ---
const ESTACOES = [
  { numero: '01', titulo: 'Você Sabia?', arquivo: 'estacao-01.html' },
  { numero: '02', titulo: 'Mito ou Verdade?', arquivo: 'estacao-02.html' },
  { numero: '03', titulo: 'E se fosse com você?', arquivo: 'estacao-03.html' },
  { numero: '04', titulo: 'Meu Compromisso', arquivo: 'estacao-04.html' },
  { numero: '05', titulo: 'Minha Folha na Árvore', arquivo: 'estacao-05.html' },
  { numero: '06', titulo: 'Quiz da Inclusão', arquivo: 'estacao-06.html' },
];

function baseUrl(req) {
  return PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

app.get('/cartazes', async (req, res, next) => {
  try {
    const origin = baseUrl(req);
    const cartoes = await Promise.all(
      ESTACOES.map(async (e) => {
        const url = `${origin}/${e.arquivo}`;
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#14532d', light: '#ffffff' } });
        return { ...e, url, qr };
      })
    );
    res.send(renderCartazesPage(cartoes));
  } catch (err) {
    next(err);
  }
});

function renderCartazesPage(cartoes) {
  const cards = cartoes
    .map(
      (c) => `
      <section class="cartaz">
        <div class="cartaz-numero">QR Code ${c.numero}</div>
        <h2>${c.titulo}</h2>
        <img class="cartaz-qr" src="${c.qr}" alt="QR Code para a estação ${c.numero} — ${c.titulo}" width="240" height="240" />
        <p class="cartaz-url">${c.url}</p>
      </section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Cartazes — Trilha da Inclusão CAR</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/css/style.css" />
<style>
  body { background: #fff; }
  .toolbar { max-width: 900px; margin: 1rem auto; padding: 0 1rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1100px; margin: 0 auto; padding: 0 1rem 3rem; }
  .cartaz { border: 2px solid #14532d; border-radius: 16px; padding: 1.5rem; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .cartaz-numero { font-weight: 700; color: #14532d; letter-spacing: .05em; }
  .cartaz h2 { margin: .25rem 0 1rem; }
  .cartaz-qr { width: 100%; max-width: 240px; height: auto; }
  .cartaz-url { font-size: .75rem; color: #555; word-break: break-all; margin-top: .75rem; }
  @media print {
    .toolbar { display: none; }
    .grid { grid-template-columns: repeat(2, 1fr); }
    .cartaz { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Imprimir cartazes</button>
    <a href="/">Voltar</a>
  </div>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>`;
}

// --- Painel do RH (protegido por chave simples) ---
app.get('/api/admin/data', async (req, res, next) => {
  try {
    if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
      return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }
    const [respostasRaw, folhasRaw, compromissos, quizEntries] = await Promise.all([
      store.readAll('respostas'),
      store.readAll('folhas'),
      store.readAll('compromissos'),
      store.readAll('quiz'),
    ]);
    const respostas = respostasRaw.map((r) => ({ texto: r.texto, criadoEm: r.criadoEm }));
    const folhas = folhasRaw.map((f) => ({ texto: f.texto, criadoEm: f.criadoEm }));

    const frequenciaCompromissos = {};
    compromissos.forEach((c) => (c.itens || []).forEach((i) => {
      frequenciaCompromissos[i] = (frequenciaCompromissos[i] || 0) + 1;
    }));

    const mediaQuiz = quizEntries.length
      ? (quizEntries.reduce((acc, q) => acc + q.acertos, 0) / quizEntries.length).toFixed(2)
      : null;

    res.json({
      totais: {
        mensagensRecebidas: respostas.length + folhas.length,
        compromissosRegistrados: compromissos.length,
        respostasNoQuiz: quizEntries.length,
        mediaAcertosQuiz: mediaQuiz,
      },
      respostas,
      folhas,
      frequenciaCompromissos,
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor. Verifique a conexão com o SQL Server.' });
});

async function start() {
  try {
    await store.ensureSchema();
    console.log('Conexão com o SQL Server estabelecida e tabelas verificadas.');
  } catch (err) {
    console.error('Aviso: não foi possível preparar o banco de dados no início. As páginas estáticas continuam disponíveis, mas os formulários falharão até a conexão ser corrigida.');
    console.error(err.message);
  }

  app.listen(PORT, () => {
    console.log(`Trilha da Inclusão CAR rodando em http://localhost:${PORT}`);
    if (!ADMIN_KEY) {
      console.warn('Aviso: ADMIN_KEY não definida — o painel do RH (/admin) ficará inacessível até configurá-la.');
    }
  });
}

start();
