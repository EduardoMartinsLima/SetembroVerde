// Armazenamento das participações no SQL Server corporativo.
// Nenhum dado de identificação (nome, e-mail, IP, matrícula) é gravado —
// cada tabela guarda só o conteúdo da resposta e o horário de envio.

const { sql, getPool } = require('./db');

const AUTO_MIGRATE = process.env.DB_AUTO_MIGRATE !== 'false';

// Cria as tabelas se ainda não existirem. Pode ser desligado com
// DB_AUTO_MIGRATE=false para ambientes em que o login da aplicação não tem
// permissão de DDL — nesse caso, rode sql/schema.sql manualmente antes.
async function ensureSchema() {
  if (!AUTO_MIGRATE) return;
  const pool = await getPool();

  await pool.request().query(`
    IF OBJECT_ID('dbo.TrilhaRespostas', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TrilhaRespostas (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaRespostas_Id DEFAULT NEWID() PRIMARY KEY,
        Texto NVARCHAR(500) NOT NULL,
        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaRespostas_CriadoEm DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.TrilhaCompromissos', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TrilhaCompromissos (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaCompromissos_Id DEFAULT NEWID() PRIMARY KEY,
        Itens NVARCHAR(MAX) NULL,
        Compromisso NVARCHAR(300) NULL,
        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaCompromissos_CriadoEm DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.TrilhaFolhas', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TrilhaFolhas (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaFolhas_Id DEFAULT NEWID() PRIMARY KEY,
        Texto NVARCHAR(120) NOT NULL,
        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaFolhas_CriadoEm DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.TrilhaQuiz', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TrilhaQuiz (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaQuiz_Id DEFAULT NEWID() PRIMARY KEY,
        Acertos INT NOT NULL,
        Total INT NOT NULL,
        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaQuiz_CriadoEm DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

async function append(collection, record) {
  const pool = await getPool();
  const request = pool.request();

  switch (collection) {
    case 'respostas': {
      request.input('texto', sql.NVarChar(500), record.texto);
      const result = await request.query(`
        INSERT INTO dbo.TrilhaRespostas (Texto)
        OUTPUT INSERTED.Id, INSERTED.Texto, INSERTED.CriadoEm
        VALUES (@texto)
      `);
      return mapRow(result.recordset[0]);
    }
    case 'folhas': {
      request.input('texto', sql.NVarChar(120), record.texto);
      const result = await request.query(`
        INSERT INTO dbo.TrilhaFolhas (Texto)
        OUTPUT INSERTED.Id, INSERTED.Texto, INSERTED.CriadoEm
        VALUES (@texto)
      `);
      return mapRow(result.recordset[0]);
    }
    case 'compromissos': {
      request.input('itens', sql.NVarChar(sql.MAX), JSON.stringify(record.itens || []));
      request.input('compromisso', sql.NVarChar(300), record.compromisso || null);
      const result = await request.query(`
        INSERT INTO dbo.TrilhaCompromissos (Itens, Compromisso)
        OUTPUT INSERTED.Id, INSERTED.Itens, INSERTED.Compromisso, INSERTED.CriadoEm
        VALUES (@itens, @compromisso)
      `);
      return mapRow(result.recordset[0]);
    }
    case 'quiz': {
      request.input('acertos', sql.Int, record.acertos);
      request.input('total', sql.Int, record.total);
      const result = await request.query(`
        INSERT INTO dbo.TrilhaQuiz (Acertos, Total)
        OUTPUT INSERTED.Id, INSERTED.Acertos, INSERTED.Total, INSERTED.CriadoEm
        VALUES (@acertos, @total)
      `);
      return mapRow(result.recordset[0]);
    }
    default:
      throw new Error(`Coleção desconhecida: ${collection}`);
  }
}

async function readAll(collection) {
  const pool = await getPool();
  const table = tableName(collection);
  const result = await pool.request().query(`SELECT * FROM dbo.${table} ORDER BY CriadoEm DESC`);
  return result.recordset.map(mapRow);
}

async function count(collection) {
  const pool = await getPool();
  const table = tableName(collection);
  const result = await pool.request().query(`SELECT COUNT(*) AS Total FROM dbo.${table}`);
  return result.recordset[0].Total;
}

function tableName(collection) {
  const tables = {
    respostas: 'TrilhaRespostas',
    compromissos: 'TrilhaCompromissos',
    folhas: 'TrilhaFolhas',
    quiz: 'TrilhaQuiz',
  };
  const table = tables[collection];
  if (!table) throw new Error(`Coleção desconhecida: ${collection}`);
  return table;
}

// Normaliza nomes de coluna (PascalCase no banco) para o formato usado pelo
// restante da aplicação, e desserializa a coluna Itens (JSON como texto).
function mapRow(row) {
  if (!row) return row;
  const { Id, Itens, Compromisso, Texto, Acertos, Total, CriadoEm } = row;
  const out = { id: Id, criadoEm: CriadoEm };
  if (Texto !== undefined) out.texto = Texto;
  if (Itens !== undefined) out.itens = Itens ? JSON.parse(Itens) : [];
  if (Compromisso !== undefined) out.compromisso = Compromisso;
  if (Acertos !== undefined) out.acertos = Acertos;
  if (Total !== undefined) out.total = Total;
  return out;
}

module.exports = { ensureSchema, append, readAll, count };
