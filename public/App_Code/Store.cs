// Trilha da Inclusão CAR - acesso às 4 tabelas de participação no SQL Server.
// Nenhuma tabela grava dado que identifique quem respondeu.

using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Web.Script.Serialization;

public static class Store
{
    private static readonly object SchemaLock = new object();
    private static bool _schemaEnsured;

    public static void EnsureSchema()
    {
        lock (SchemaLock)
        {
            if (_schemaEnsured) return;
            using (var conn = Db.GetConnection())
            {
                CreateIfMissing(conn, "TrilhaRespostas", @"
                    CREATE TABLE dbo.TrilhaRespostas (
                        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaRespostas_Id DEFAULT NEWID() PRIMARY KEY,
                        Texto NVARCHAR(500) NOT NULL,
                        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaRespostas_CriadoEm DEFAULT SYSUTCDATETIME()
                    );");
                CreateIfMissing(conn, "TrilhaCompromissos", @"
                    CREATE TABLE dbo.TrilhaCompromissos (
                        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaCompromissos_Id DEFAULT NEWID() PRIMARY KEY,
                        Itens NVARCHAR(MAX) NULL,
                        Compromisso NVARCHAR(300) NULL,
                        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaCompromissos_CriadoEm DEFAULT SYSUTCDATETIME()
                    );");
                CreateIfMissing(conn, "TrilhaFolhas", @"
                    CREATE TABLE dbo.TrilhaFolhas (
                        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaFolhas_Id DEFAULT NEWID() PRIMARY KEY,
                        Texto NVARCHAR(120) NOT NULL,
                        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaFolhas_CriadoEm DEFAULT SYSUTCDATETIME()
                    );");
                CreateIfMissing(conn, "TrilhaQuiz", @"
                    CREATE TABLE dbo.TrilhaQuiz (
                        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TrilhaQuiz_Id DEFAULT NEWID() PRIMARY KEY,
                        Acertos INT NOT NULL,
                        Total INT NOT NULL,
                        CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_TrilhaQuiz_CriadoEm DEFAULT SYSUTCDATETIME()
                    );");
            }
            _schemaEnsured = true;
        }
    }

    private static void CreateIfMissing(SqlConnection conn, string table, string createSql)
    {
        var sql = "IF OBJECT_ID('dbo." + table + "', 'U') IS NULL BEGIN " + createSql + " END";
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.ExecuteNonQuery();
        }
    }

    public static void InsertResposta(string texto)
    {
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("INSERT INTO dbo.TrilhaRespostas (Texto) VALUES (@texto)", conn))
        {
            cmd.Parameters.Add("@texto", SqlDbType.NVarChar, 500).Value = texto;
            cmd.ExecuteNonQuery();
        }
    }

    public static void InsertCompromisso(List<string> itens, string compromisso)
    {
        var serializer = new JavaScriptSerializer();
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand(
            "INSERT INTO dbo.TrilhaCompromissos (Itens, Compromisso) VALUES (@itens, @compromisso)", conn))
        {
            cmd.Parameters.Add("@itens", SqlDbType.NVarChar, -1).Value = serializer.Serialize(itens ?? new List<string>());
            var compromissoParam = cmd.Parameters.Add("@compromisso", SqlDbType.NVarChar, 300);
            compromissoParam.Value = string.IsNullOrEmpty(compromisso) ? (object)DBNull.Value : compromisso;
            cmd.ExecuteNonQuery();
        }
    }

    public static void InsertFolha(string texto)
    {
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("INSERT INTO dbo.TrilhaFolhas (Texto) VALUES (@texto)", conn))
        {
            cmd.Parameters.Add("@texto", SqlDbType.NVarChar, 120).Value = texto;
            cmd.ExecuteNonQuery();
        }
    }

    public static void InsertQuiz(int acertos, int total)
    {
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("INSERT INTO dbo.TrilhaQuiz (Acertos, Total) VALUES (@acertos, @total)", conn))
        {
            cmd.Parameters.Add("@acertos", SqlDbType.Int).Value = acertos;
            cmd.Parameters.Add("@total", SqlDbType.Int).Value = total;
            cmd.ExecuteNonQuery();
        }
    }

    public static int Count(string table)
    {
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("SELECT COUNT(*) FROM dbo." + table, conn))
        {
            return (int)cmd.ExecuteScalar();
        }
    }

    public static List<string> ReadRespostasTexto()
    {
        return ReadTextos("SELECT Texto FROM dbo.TrilhaRespostas ORDER BY CriadoEm DESC");
    }

    public static List<string> ReadFolhasTexto()
    {
        return ReadTextos("SELECT Texto FROM dbo.TrilhaFolhas ORDER BY CriadoEm DESC");
    }

    private static List<string> ReadTextos(string sql)
    {
        var result = new List<string>();
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand(sql, conn))
        using (var reader = cmd.ExecuteReader())
        {
            while (reader.Read()) result.Add(reader.GetString(0));
        }
        return result;
    }

    public static Dictionary<string, int> FrequenciaCompromissos()
    {
        var freq = new Dictionary<string, int>();
        var serializer = new JavaScriptSerializer();
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("SELECT Itens FROM dbo.TrilhaCompromissos WHERE Itens IS NOT NULL", conn))
        using (var reader = cmd.ExecuteReader())
        {
            while (reader.Read())
            {
                List<string> itens;
                try { itens = serializer.Deserialize<List<string>>(reader.GetString(0)); }
                catch { continue; }
                if (itens == null) continue;
                foreach (var item in itens)
                {
                    if (string.IsNullOrEmpty(item)) continue;
                    freq[item] = freq.ContainsKey(item) ? freq[item] + 1 : 1;
                }
            }
        }
        return freq;
    }

    public static double? MediaAcertosQuiz()
    {
        using (var conn = Db.GetConnection())
        using (var cmd = new SqlCommand("SELECT AVG(CAST(Acertos AS FLOAT)) FROM dbo.TrilhaQuiz", conn))
        {
            var result = cmd.ExecuteScalar();
            return result == null || result == DBNull.Value ? (double?)null : Convert.ToDouble(result);
        }
    }
}
