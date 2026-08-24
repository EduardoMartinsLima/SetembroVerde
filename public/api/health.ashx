<%@ WebHandler Language="C#" Class="HealthHandler" %>

using System;
using System.Data.SqlClient;
using System.Web;

// Diagnóstico rápido: abra /api/health.ashx no navegador depois do deploy
// para confirmar que o ASP.NET está rodando e conseguindo falar com o SQL Server.
public class HealthHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        try
        {
            using (var conn = Db.GetConnection())
            using (var cmd = new SqlCommand("SELECT @@VERSION", conn))
            {
                var version = (string)cmd.ExecuteScalar();
                var primeiraLinha = version != null ? version.Split('\n')[0].Trim() : null;
                Helpers.WriteJson(context, 200, new { ok = true, sqlServerVersion = primeiraLinha });
            }
        }
        catch (Exception ex)
        {
            Helpers.WriteJson(context, 500, new { ok = false, erro = ex.Message });
        }
    }

    public bool IsReusable { get { return false; } }
}
