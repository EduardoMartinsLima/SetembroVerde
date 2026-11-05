// Painel PNP · SurveyCTO — servidor do painel de monitoramento em tempo real.
//
// - Consulta a API do SurveyCTO no servidor (as credenciais nunca vão para o
//   navegador) em intervalo fixo, guarda a última base em memória e avisa os
//   navegadores conectados via Server-Sent Events assim que chegam dados novos.
// - Sem dependências externas: basta Node.js 18+.
//
//   npm start                 conecta ao SurveyCTO (usa o .env)
//   npm run demo              dados fictícios, para conhecer o painel
//   npm run testar-conexao    faz uma consulta e mostra o resumo

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const RAIZ = __dirname;
carregarEnv(path.join(RAIZ, '.env'));

const { baixarDados } = require('./lib/surveycto');
const { lerXlsForm } = require('./lib/xlsform');
const { criarDemo } = require('./lib/demo');
const painelConfig = require('./config/painel.config');

const DEMO = process.argv.includes('--demo') || process.env.DEMO === '1';
const TESTAR = process.argv.includes('--testar');
// --arquivo=dados.json lê as submissões de um arquivo (testes, sem consultar a API)
const ARQUIVO = (process.argv.find((a) => a.startsWith('--arquivo=')) || '').slice(10);
// --prototipo=saida.html gera um HTML único (dados embutidos, sem servidor) e encerra
const PROTOTIPO = (process.argv.find((a) => a.startsWith('--prototipo=')) || '').slice(12);
const PORTA = Number(process.env.PORTA || process.env.PORT || 3100);
const INTERVALO = Math.max(30, Number(process.env.INTERVALO_SEGUNDOS || (DEMO ? 20 : 300)));

const SCTO = {
  servidor: process.env.SCTO_SERVIDOR || 'https://bpcomponente2.surveycto.com',
  usuario: process.env.SCTO_USUARIO || '',
  senha: process.env.SCTO_SENHA || '',
  formId: process.env.SCTO_FORM_ID || 'registro_de_informaes_ambientais_e_sociais_do_plano_de_investimentos',
  dataInicial: process.env.SCTO_DATA_INICIAL || 'Oct 13, 2015 00:00:00 AM',
};

const ARQ_XLSFORM = path.join(RAIZ, 'config', 'formulario.xlsx');
const ARQ_BASE = path.join(RAIZ, 'config', 'base_conveniadas.csv');

// ---------------------------------------------------------------- utilidades

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), '·', ...a);
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

function lerCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  if (!linhas.length) return [];
  const cab = linhas[0].map((h) => semAcento(h).trim().toLowerCase().replace(/\s+/g, '_'));
  return linhas.slice(1).map((l) => Object.fromEntries(cab.map((h, i) => [h, (l[i] || '').trim()])));
}

function normalizarBase(linhas) {
  const achar = (o, re) => { const k = Object.keys(o).find((x) => re.test(x)); return k ? o[k] : ''; };
  return linhas
    .map((o) => ({
      edital: achar(o, /^edital/),
      id: achar(o, /^(id|cnpj|codigo|cod|identificador)/),
      nome: achar(o, /^(nome|razao|organiza|op$)/),
      municipio: achar(o, /^munic/),
    }))
    .filter((o) => o.id || o.nome);
}

// ---------------------------------------------------------------- estado

const estado = {
  versao: 0,
  hash: '',
  registros: [],
  colunas: [],
  base: null,
  esquema: null,
  atualizadoEm: null,
  ultimaTentativa: null,
  proximaEm: null,
  erro: null,
  emAndamento: false,
};
const demo = DEMO ? criarDemo() : null;
const mtimes = {};

function carregarArquivosLocais() {
  if (DEMO) {
    estado.base = demo.base;
    estado.esquema = demo.esquema;
    return;
  }
  const mudou = (arq) => {
    if (!fs.existsSync(arq)) { const tinha = mtimes[arq]; delete mtimes[arq]; return tinha ? 'removido' : false; }
    const t = fs.statSync(arq).mtimeMs;
    if (mtimes[arq] === t) return false;
    mtimes[arq] = t;
    return 'alterado';
  };
  const x = mudou(ARQ_XLSFORM);
  if (x === 'removido') estado.esquema = null;
  else if (x) {
    try {
      estado.esquema = lerXlsForm(ARQ_XLSFORM);
      log(`XLSForm carregado: ${Object.keys(estado.esquema.campos).length} campos.`);
    } catch (e) {
      log('Falha ao ler config/formulario.xlsx:', e.message);
    }
  }
  const b = mudou(ARQ_BASE);
  if (b === 'removido') estado.base = null;
  else if (b) {
    try {
      estado.base = normalizarBase(lerCsv(fs.readFileSync(ARQ_BASE, 'utf8')));
      log(`Base de conveniadas carregada: ${estado.base.length} OP.`);
    } catch (e) {
      log('Falha ao ler config/base_conveniadas.csv:', e.message);
    }
  }
}

// Mapeia nomes da configuração -> nome real da coluna (sem diferenciar caixa).
function resolverColunas(colunas) {
  const porMinusculo = new Map(colunas.map((c) => [c.toLowerCase(), c]));
  const achar = (nome) => (nome ? porMinusculo.get(nome.toLowerCase()) : undefined);
  const detectar = (env, padroes) => {
    if (process.env[env]) return achar(process.env[env]) || null;
    for (const re of padroes) {
      const c = colunas.find((x) => re.test(x));
      if (c) return c;
    }
    return null;
  };
  const chaves = {
    edital: detectar('CAMPO_EDITAL', [/^edital$/i, /edital/i]),
    idOp: detectar('CAMPO_ID_OP', [/^cnpj/i, /cnpj/i, /^(id|cod(igo)?)_?(op|organiza)/i]),
    nomeOp: detectar('CAMPO_NOME_OP', [/^nome_?(da_)?(op|organiza|associa|cooperativa|entidade)/i, /razao_social/i, /^(op|organizacao)$/i]),
    municipio: detectar('CAMPO_MUNICIPIO', [/^municipio/i, /munic/i]),
  };
  // Perguntas de múltipla escolha podem vir "divididas" no formato wide:
  // uma coluna por opção (campo_opcao = 1). Nesse caso o campo é reconstruído.
  const valoresBinarios = (col) => estado.registros.every((r) => r[col] === undefined || r[col] === '' || r[col] === '0' || r[col] === '1');
  const variaveis = {};
  const divididas = {};
  for (const s of painelConfig.secoes)
    for (const g of s.grupos)
      for (const v of g.variaveis) {
        variaveis[v.campo] = achar(v.campo) || null;
        if (variaveis[v.campo]) continue;
        const prefixo = v.campo.toLowerCase() + '_';
        const partes = colunas.filter((c) => c.toLowerCase().startsWith(prefixo) && valoresBinarios(c)).map((c) => ({ col: c, opcao: c.slice(prefixo.length) }));
        if (partes.length) divididas[v.campo] = partes;
      }
  return { chaves, variaveis, divididas };
}

async function atualizar() {
  if (estado.emAndamento) return;
  estado.emAndamento = true;
  estado.ultimaTentativa = new Date().toISOString();
  try {
    carregarArquivosLocais();
    const dados = DEMO ? demo.proximo() : ARQUIVO ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) : await baixarDados(SCTO);
    const colunas = [...new Set(dados.flatMap((r) => Object.keys(r)))];
    const hash = crypto.createHash('sha1').update(JSON.stringify(dados)).digest('hex');
    const novos = dados.length - estado.registros.length;
    estado.registros = dados;
    estado.colunas = colunas;
    estado.atualizadoEm = new Date().toISOString();
    estado.erro = null;
    if (hash !== estado.hash) {
      estado.hash = hash;
      estado.versao++;
      log(`Dados atualizados: ${dados.length} submissões${estado.versao > 1 && novos > 0 ? ` (+${novos})` : ''}.`);
    }
  } catch (e) {
    estado.erro = { mensagem: e.message, dica: e.dica || null, em: new Date().toISOString() };
    log('Erro ao consultar o SurveyCTO:', e.message, e.dica ? `— ${e.dica}` : '');
  } finally {
    estado.emAndamento = false;
    estado.proximaEm = new Date(Date.now() + INTERVALO * 1000).toISOString();
    transmitir();
  }
}

function payload() {
  const { chaves, variaveis, divididas } = resolverColunas(estado.colunas);
  const usar = new Map([['KEY', 'KEY'], ['SubmissionDate', 'SubmissionDate']]);
  for (const [k, col] of Object.entries(chaves)) if (col) usar.set(col, '_' + k);
  for (const [nome, col] of Object.entries(variaveis)) if (col) usar.set(col, nome);
  const registros = estado.registros.map((r) => {
    const o = {};
    for (const [col, nome] of usar) if (r[col] !== undefined && r[col] !== '') o[nome] = r[col];
    for (const [nome, partes] of Object.entries(divididas)) {
      const marcadas = partes.filter((p) => r[p.col] === '1').map((p) => p.opcao);
      if (marcadas.length) o[nome] = marcadas.join(' ');
    }
    return o;
  });
  const esquema = {};
  if (estado.esquema) {
    const campos = estado.esquema.campos;
    const porMin = new Map(Object.keys(campos).map((k) => [k.toLowerCase(), k]));
    for (const [col, nome] of usar) {
      const k = porMin.get(col.toLowerCase());
      if (k) esquema[nome] = campos[k];
    }
  }
  return {
    meta: {
      versao: estado.versao,
      demo: DEMO,
      formId: SCTO.formId,
      servidor: SCTO.servidor.replace(/^https?:\/\//, ''),
      intervalo: INTERVALO,
      atualizadoEm: estado.atualizadoEm,
      proximaEm: estado.proximaEm,
      erro: estado.erro,
      totalColunas: estado.colunas.length,
      chaves,
      naoEncontrados: Object.entries(variaveis).filter(([n, c]) => !c && !divididas[n] && estado.colunas.length).map(([n]) => n),
      reconstruidas: Object.keys(divididas),
      temXlsForm: !!estado.esquema,
    },
    config: painelConfig,
    esquema,
    base: estado.base,
    registros,
  };
}

// ---------------------------------------------------------------- SSE

const clientes = new Set();
function status() {
  return { versao: estado.versao, atualizadoEm: estado.atualizadoEm, proximaEm: estado.proximaEm, erro: estado.erro, emAndamento: estado.emAndamento };
}
function transmitir() {
  const msg = `event: status\ndata: ${JSON.stringify(status())}\n\n`;
  for (const res of clientes) res.write(msg);
}
setInterval(() => { for (const res of clientes) res.write(': ping\n\n'); }, 25000).unref();

// ---------------------------------------------------------------- HTTP

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const PUB = path.join(RAIZ, 'public');

function autorizado(req) {
  const u = process.env.PAINEL_USUARIO, s = process.env.PAINEL_SENHA;
  if (!u && !s) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [uu, ...rest] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const esperado = Buffer.from(`${u || ''}:${s || ''}`);
  const recebido = Buffer.from(`${uu}:${rest.join(':')}`);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

const servidor = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!autorizado(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Painel PNP", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Acesso restrito.');
  }
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/api/dados') {
    const corpo = JSON.stringify(payload());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(corpo);
  }
  if (url.pathname === '/api/eventos') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 5000\nevent: status\ndata: ${JSON.stringify(status())}\n\n`);
    clientes.add(res);
    req.on('close', () => clientes.delete(res));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const arq = path.normalize(path.join(PUB, rel));
  if (!arq.startsWith(PUB + path.sep) || !fs.existsSync(arq) || !fs.statSync(arq).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Não encontrado.');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(arq).pipe(res);
});

// ---------------------------------------------------------------- protótipo

// Reduz dados pessoais antes de embutir: CNPJ vira um código curto (mantém o
// cruzamento com a base e a contagem de reenvios) e o nascimento vira só o ano.
function anonimizar(p) {
  const cod = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    return d ? 'OP-' + crypto.createHash('sha256').update(d).digest('hex').slice(0, 10) : v;
  };
  for (const r of p.registros) {
    if (r._idOp) r._idOp = cod(r._idOp);
    if (r.nascimento_presidente) {
      const m = /(\d{4})/.exec(r.nascimento_presidente);
      r.nascimento_presidente = m ? m[1] : '';
    }
    delete r.KEY;
  }
  p.registros.forEach((r, i) => (r.KEY = 'r' + i));
  if (p.base) p.base = p.base.map((b) => ({ ...b, id: cod(b.id) }));
  return p;
}

function gerarPrototipo(saida) {
  const p = anonimizar(payload());
  p.meta.prototipo = true;
  p.meta.erro = null;
  const ler = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
  const json = JSON.stringify(p).replace(/</g, '\\u003c');
  let html = ler('index.html')
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${ler('style.css')}\n</style>`)
    .replace('<script src="app.js"></script>', () => `<script>window.PAINEL_DADOS = ${json};</script>\n<script>\n${ler('app.js')}\n</script>`)
    .replace('<title>Painel PNP</title>', '<title>Painel PNP · Protótipo</title>');
  fs.writeFileSync(saida, html);
  console.log(`Protótipo gerado: ${saida} (${(html.length / 1024).toFixed(0)} KB, ${p.registros.length} submissões)`);
}

// ---------------------------------------------------------------- início

async function main() {
  if (!DEMO && !ARQUIVO && (!SCTO.usuario || !SCTO.senha)) {
    console.error('Defina SCTO_USUARIO e SCTO_SENHA no arquivo .env (veja .env.example), ou rode "npm run demo".');
    process.exit(1);
  }
  if (PROTOTIPO) {
    estado.emAndamento = false;
    await atualizar();
    if (estado.erro) { console.error('FALHA:', estado.erro.mensagem); process.exit(2); }
    gerarPrototipo(path.resolve(PROTOTIPO));
    process.exit(0);
  }
  if (TESTAR) {
    carregarArquivosLocais();
    try {
      const dados = await baixarDados(SCTO);
      const colunas = [...new Set(dados.flatMap((r) => Object.keys(r)))];
      estado.registros = dados;
      const { chaves, variaveis, divididas } = resolverColunas(colunas);
      console.log(`\nOK — ${dados.length} submissões, ${colunas.length} colunas.`);
      console.log('Campos-chave detectados:', chaves);
      const faltando = Object.entries(variaveis).filter(([n, c]) => !c && !divididas[n]).map(([n]) => n);
      if (Object.keys(divididas).length) console.log('Múltipla escolha reconstruída a partir de colunas por opção:', Object.keys(divididas).join(', '));
      console.log(faltando.length ? `Variáveis prioritárias NÃO encontradas: ${faltando.join(', ')}` : 'Todas as variáveis prioritárias foram encontradas.');
      console.log(`XLSForm: ${estado.esquema ? 'carregado' : 'não encontrado (config/formulario.xlsx)'} · Base DATACAR: ${estado.base ? estado.base.length + ' OP' : 'não encontrada (config/base_conveniadas.csv)'}`);
      process.exit(0);
    } catch (e) {
      console.error('\nFALHA:', e.message, e.dica ? `\nDica: ${e.dica}` : '');
      process.exit(2);
    }
  }
  servidor.listen(PORTA, () => {
    log(`Painel em http://localhost:${PORTA}  ${DEMO ? '(MODO DEMONSTRAÇÃO — dados fictícios)' : `· formulário ${SCTO.formId}`} · atualiza a cada ${INTERVALO}s`);
  });
  await atualizar();
  setInterval(atualizar, INTERVALO * 1000);
}

main();
