// Verificação rápida da conexão com o SQL Server, sem subir o servidor
// inteiro. Útil para a TI validar rede/credenciais antes de publicar.
//
// Uso:
//   cp .env.example .env   # preencha com os dados reais
//   npm run db:check

require('dotenv').config();

const { getPool } = require('../server/db');
const { ensureSchema } = require('../server/store');

async function main() {
  console.log('Testando conexão com o SQL Server...');
  console.log(`  DB_SERVER=${process.env.DB_SERVER || '(não definido)'}`);
  console.log(`  DB_DATABASE=${process.env.DB_DATABASE || '(não definido)'}`);
  console.log(`  DB_USER=${process.env.DB_USER || '(não definido)'}`);

  const pool = await getPool();
  console.log('✔ Conexão aberta com sucesso.');

  const result = await pool.request().query('SELECT @@VERSION AS versao');
  console.log(`✔ SELECT de teste ok. Versão do servidor:\n  ${result.recordset[0].versao.split('\n')[0]}`);

  if (process.env.DB_AUTO_MIGRATE === 'false') {
    console.log('DB_AUTO_MIGRATE=false — pulando criação/verificação das tabelas (rode sql/schema.sql manualmente).');
  } else {
    await ensureSchema();
    console.log('✔ Tabelas verificadas/criadas: TrilhaRespostas, TrilhaCompromissos, TrilhaFolhas, TrilhaQuiz.');
  }

  console.log('\nTudo certo! O banco está pronto para a aplicação.');
  await pool.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✘ Falha ao conectar ou preparar o banco:');
  console.error(err.message);
  console.error('\nVerifique: endereço/porta do servidor, firewall, nome do banco, usuário/senha e permissões.');
  process.exit(1);
});
