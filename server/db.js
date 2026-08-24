// Conexão com o SQL Server corporativo, via node-mssql.
// Configuração 100% por variáveis de ambiente — ver README.md.

const sql = require('mssql');

let poolPromise;

function getConfig() {
  const {
    DB_SERVER,
    DB_PORT,
    DB_INSTANCE,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    DB_TRUST_SERVER_CERTIFICATE,
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    throw new Error(
      'Configuração do SQL Server incompleta. Defina DB_SERVER, DB_DATABASE, DB_USER e DB_PASSWORD.'
    );
  }

  const options = {
    // Por padrão o driver exige TLS (padrão seguro). Em SQL Server on-premises
    // com certificado autoassinado, ajuste DB_TRUST_SERVER_CERTIFICATE=true.
    encrypt: DB_ENCRYPT !== 'false',
    trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE === 'true',
  };

  const config = {
    server: DB_SERVER,
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    options,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 15000,
  };

  if (DB_INSTANCE) {
    // Ao usar instância nomeada (ex.: SERVIDOR\SQLEXPRESS), o SQL Browser
    // resolve a porta — não defina DB_PORT nesse caso.
    config.options.instanceName = DB_INSTANCE;
  } else {
    config.port = DB_PORT ? Number(DB_PORT) : 1433;
  }

  return config;
}

// Conexão preguiçosa: só abre o pool na primeira consulta, e reseta em caso
// de falha para permitir nova tentativa na próxima chamada.
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getConfig())
      .connect()
      .catch((err) => {
        poolPromise = undefined;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
