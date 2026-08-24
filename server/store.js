// Armazenamento simples e anônimo em arquivos .jsonl (uma linha = um registro).
// Nenhum dado de identificação (nome, e-mail, IP, matrícula) é gravado.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  respostas: 'respostas.jsonl', // Estação 03 - "E se fosse com você?"
  compromissos: 'compromissos.jsonl', // Estação 04 - "Meu Compromisso"
  folhas: 'folhas.jsonl', // Estação 05 - "Minha Folha na Árvore"
  quiz: 'quiz.jsonl', // Estação 06 - "Quiz da Inclusão"
};

function filePath(collection) {
  const name = FILES[collection];
  if (!name) throw new Error(`Coleção desconhecida: ${collection}`);
  return path.join(DATA_DIR, name);
}

function append(collection, record) {
  const entry = {
    id: crypto.randomUUID(),
    criadoEm: new Date().toISOString(),
    ...record,
  };
  fs.appendFileSync(filePath(collection), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

function readAll(collection) {
  const p = filePath(collection);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function count(collection) {
  return readAll(collection).length;
}

module.exports = { append, readAll, count };
