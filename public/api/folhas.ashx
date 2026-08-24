<%@ WebHandler Language="C#" Class="FolhasHandler" %>

using System;
using System.Web;

// Estação 05 — "Minha Folha na Árvore"
public class FolhasHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        if (context.Request.HttpMethod != "POST")
        {
            Helpers.WriteJson(context, 405, new { erro = "Método não permitido." });
            return;
        }
        if (RateLimiter.IsLimited(context.Request.UserHostAddress))
        {
            Helpers.WriteJson(context, 429, new { erro = "Muitos envios. Tente novamente em instantes." });
            return;
        }
        try
        {
            var data = Helpers.ReadJsonBody(context);
            var texto = Helpers.CleanText(Helpers.GetString(data, "texto"), 120);
            if (string.IsNullOrEmpty(texto))
            {
                Helpers.WriteJson(context, 400, new { erro = "Complete a frase antes de enviar." });
                return;
            }
            Store.InsertFolha(texto);
            Helpers.WriteJson(context, 201, new { ok = true });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.TraceError(ex.ToString());
            Helpers.WriteJson(context, 500, new { erro = "Erro interno do servidor. Verifique a conexão com o SQL Server." });
        }
    }

    public bool IsReusable { get { return false; } }
}
