// Trilha da Inclusão CAR - Setembro Verde 2026
// Servidor das páginas destino dos QR Codes + API de participação anônima.

require('dotenv').config();

const path = require('path');
const express = require('express');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

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
app.post('/api/respostas.ashx', async (req, res, next) => {
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
app.post('/api/compromissos.ashx', async (req, res, next) => {
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
app.post('/api/folhas.ashx', async (req, res, next) => {
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
app.post('/api/quiz.ashx', async (req, res, next) => {
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
app.get('/api/stats.ashx', async (_req, res, next) => {
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

// Os cartazes (/cartazes.html) são um arquivo estático servido direto do
// public/ — o QR Code de cada estação é gerado no navegador (public/js/qrcode.js),
// então funciona igual nesse servidor Node e na versão ASP.NET/IIS.

// --- Painel do RH (protegido por chave simples) ---
app.get('/api/admin-data.ashx', async (req, res, next) => {
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

// public/ também guarda o back-end ASP.NET alternativo (App_Code/*.cs,
// api/*.ashx, Web.config, Global.asax, *.config) para hospedagem em IIS —
// ver README. Esses arquivos nunca devem ser servidos como estáticos aqui;
// as rotas acima já respondem em /api/*.ashx, então isto é uma segunda
// camada de proteção contra vazar código-fonte ou (num deploy IIS ao lado)
// as credenciais do banco.
const BLOCKED_STATIC_PATTERNS = [
  /\.ashx$/i,
  /\.cs$/i,
  /\.config$/i,
  /^\/Global\.asax$/i,
  /^\/Web\.config$/i,
  /^\/App_Code(\/|$)/i,
];
app.use((req, res, next) => {
  if (BLOCKED_STATIC_PATTERNS.some((pattern) => pattern.test(req.path))) {
    return res.status(404).end();
  }
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

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
