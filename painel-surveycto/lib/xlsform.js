// Leitor mínimo de .xlsx (zip + XML) para extrair a definição do formulário
// (XLSForm do SurveyCTO): enunciados das perguntas, tipos e rótulos das opções.
// Assim o painel mostra "Feminino" em vez do código "2". Sem dependências.

const fs = require('fs');
const zlib = require('zlib');

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo .xlsx inválido (zip sem diretório central).');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files[name] = () => (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + extraLen + commLen;
  }
  return files;
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml) => {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out += m[1];
  return decode(out);
};

function colIndex(ref) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheets(path) {
  const files = unzip(fs.readFileSync(path));
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    const xml = files['xl/sharedStrings.xml']();
    while ((m = re.exec(xml))) shared.push(textOf(m[1]));
  }
  const rels = {};
  const relsXml = files['xl/_rels/workbook.xml.rels'] ? files['xl/_rels/workbook.xml.rels']() : '';
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0]);
    const target = /Target="([^"]+)"/.exec(m[0]);
    if (id && target) rels[id[1]] = target[1].replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const sheets = {};
  const wb = files['xl/workbook.xml']();
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode((/name="([^"]*)"/.exec(m[0]) || [])[1] || '');
    const rid = (/r:id="([^"]*)"/.exec(m[0]) || [])[1];
    const file = files['xl/' + rels[rid]];
    if (!file) continue;
    const rows = [];
    for (const r of file().matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1];
        const t = (/t="([^"]+)"/.exec(attrs) || [])[1];
        const inner = c[2] || '';
        let v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        if (t === 's') v = shared[+v];
        else if (t === 'inlineStr') v = textOf(inner);
        else if (v !== undefined) v = decode(v);
        if (ref) row[colIndex(ref)] = v === undefined ? '' : String(v);
        else row.push(v === undefined ? '' : String(v));
      }
      rows.push(row);
    }
    sheets[name.toLowerCase()] = rows;
  }
  return sheets;
}

function toObjects(rows) {
  if (!rows || !rows.length) return [];
  const head = rows[0].map((h) => String(h || '').trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { if (h) o[h] = (r[i] || '').trim(); });
    return o;
  });
}

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\$\{[^}]+\}/g, '…').replace(/\s+/g, ' ').trim();

function pickLabel(obj, prefer) {
  const keys = Object.keys(obj).filter((k) => k === 'label' || k.startsWith('label:'));
  const ordered = keys.sort((a, b) => {
    const pa = prefer.test(a) ? 0 : a === 'label' ? 1 : 2;
    const pb = prefer.test(b) ? 0 : b === 'label' ? 1 : 2;
    return pa - pb;
  });
  for (const k of ordered) if (obj[k]) return stripHtml(obj[k]);
  return '';
}

// Retorna { campos: { nome: { tipo, lista, rotulo, opcoes: {valor: rotulo} } } }
function lerXlsForm(path) {
  const sheets = readSheets(path);
  const survey = toObjects(sheets.survey);
  const choices = toObjects(sheets.choices);
  const prefer = /portugu|pt/i;
  const listas = {};
  const ordens = {};
  for (const c of choices) {
    const lista = c.list_name || c['list name'];
    const valor = c.value !== undefined && c.value !== '' ? c.value : c.name;
    if (!lista || valor === undefined || valor === '') continue;
    (listas[lista] = listas[lista] || {})[valor] = pickLabel(c, prefer) || valor;
    (ordens[lista] = ordens[lista] || []).push(valor);
  }
  const campos = {};
  for (const q of survey) {
    if (!q.name || !q.type) continue;
    const [tipo, lista] = q.type.trim().split(/\s+/);
    campos[q.name] = {
      tipo,
      lista: lista || null,
      rotulo: pickLabel(q, prefer),
      opcoes: lista && listas[lista] ? listas[lista] : null,
      ordem: lista && ordens[lista] ? ordens[lista] : null,
    };
  }
  return { campos };
}

module.exports = { lerXlsForm, readSheets };
