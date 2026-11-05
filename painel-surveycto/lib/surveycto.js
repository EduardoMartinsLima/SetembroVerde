// Cliente mínimo da API v2 do SurveyCTO, sem dependências externas.
// A API usa autenticação HTTP Digest por padrão (Basic, se habilitado no
// servidor). Este cliente lê o desafio "WWW-Authenticate" e responde com o
// esquema que o servidor pedir.

const crypto = require('crypto');

function hash(alg, text) {
  const algo = /sha-?256/i.test(alg || '') ? 'sha256' : 'md5';
  return crypto.createHash(algo).update(text).digest('hex');
}

function parseChallenge(header) {
  const out = { scheme: header.split(/\s+/)[0].toLowerCase() };
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let m;
  while ((m = re.exec(header))) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

function digestHeader(ch, method, uri, user, pass) {
  const alg = ch.algorithm || 'MD5';
  const qop = (ch.qop || '').split(',').map((s) => s.trim()).find((q) => q === 'auth');
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  let ha1 = hash(alg, `${user}:${ch.realm}:${pass}`);
  if (/-sess$/i.test(alg)) ha1 = hash(alg, `${ha1}:${ch.nonce}:${cnonce}`);
  const ha2 = hash(alg, `${method}:${uri}`);
  const response = qop
    ? hash(alg, `${ha1}:${ch.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : hash(alg, `${ha1}:${ch.nonce}:${ha2}`);
  const parts = [
    `username="${user}"`,
    `realm="${ch.realm}"`,
    `nonce="${ch.nonce}"`,
    `uri="${uri}"`,
    `algorithm=${alg}`,
    `response="${response}"`,
  ];
  if (ch.opaque) parts.push(`opaque="${ch.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return 'Digest ' + parts.join(', ');
}

async function authFetch(url, user, pass, timeoutMs = 120000) {
  const u = new URL(url);
  const uri = u.pathname + u.search;
  const headers = { Accept: 'application/json', 'User-Agent': 'painel-pnp-surveycto/1.0' };
  const go = (h) =>
    fetch(url, { headers: h, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => {
      const causa = e.cause ? e.cause.code || e.cause.message : e.name === 'TimeoutError' ? 'tempo esgotado' : e.message;
      const err = new Error(`Não foi possível conectar a ${u.host} (${causa}).`);
      err.dica = 'Verifique a internet/proxy/firewall do servidor onde o painel está rodando.';
      throw err;
    });

  let res = await go(headers);
  if (res.status !== 401) return res;

  const challenge = res.headers.get('www-authenticate') || '';
  await res.arrayBuffer().catch(() => {});
  const ch = parseChallenge(challenge || 'Basic');
  if (ch.scheme === 'digest') {
    res = await go({ ...headers, Authorization: digestHeader(ch, 'GET', uri, user, pass) });
  } else {
    res = await go({ ...headers, Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') });
  }
  return res;
}

// Baixa os dados no formato "wide" em JSON, a partir de uma data fixa.
async function baixarDados({ servidor, usuario, senha, formId, dataInicial }) {
  const base = servidor.replace(/\/+$/, '');
  const url = `${base}/api/v2/forms/data/wide/json/${encodeURIComponent(formId)}?date=${encodeURIComponent(dataInicial)}`;
  const res = await authFetch(url, usuario, senha);
  const texto = await res.text();
  if (!res.ok) {
    let msg = texto.slice(0, 300).replace(/\s+/g, ' ').trim();
    try {
      const j = JSON.parse(texto);
      msg = j.error?.message || j.message || msg;
    } catch (_) {}
    const err = new Error(`SurveyCTO respondeu HTTP ${res.status}: ${msg || res.statusText}`);
    err.status = res.status;
    if (res.status === 417) err.dica = 'Limite de frequência do SurveyCTO para a base completa (aguarde ~5 min entre consultas).';
    if (res.status === 401 || res.status === 403) err.dica = 'Confira usuário/senha e se o usuário tem permissão de "download de dados" via API.';
    throw err;
  }
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (_) {
    throw new Error('Resposta do SurveyCTO não é um JSON válido (formulário criptografado ou ID incorreto?).');
  }
  if (!Array.isArray(dados)) {
    if (Array.isArray(dados?.data)) dados = dados.data;
    else throw new Error('Formato inesperado na resposta do SurveyCTO (esperava uma lista de submissões).');
  }
  return dados;
}

module.exports = { baixarDados, parseChallenge, digestHeader };
