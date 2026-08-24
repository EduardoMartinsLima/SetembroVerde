// Conexão com o SQL Server, lendo a connection string de connectionStrings.config
// (arquivo fora do controle de versão — ver connectionStrings.config.example).

using System;
using System.Configuration;
using System.Data.SqlClient;

public static class Db
{
    public static SqlConnection GetConnection()
    {
        var entry = ConfigurationManager.ConnectionStrings["SetembroVerde"];
        if (entry == null || string.IsNullOrWhiteSpace(entry.ConnectionString))
        {
            throw new InvalidOperationException(
                "Configuração do SQL Server incompleta. Defina a connection string 'SetembroVerde' em connectionStrings.config.");
        }
        var conn = new SqlConnection(entry.ConnectionString);
        conn.Open();
        return conn;
    }
}
