<%@ WebHandler Language="C#" Class="QuizHandler" %>

using System;
using System.Web;

// Estação 06 — "Quiz da Inclusão"
public class QuizHandler : IHttpHandler
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
            var acertos = ToInt(data, "acertos", -1);
            var total = ToInt(data, "total", -1);
            if (acertos < 0 || total != 5 || acertos > total)
            {
                Helpers.WriteJson(context, 400, new { erro = "Resultado de quiz inválido." });
                return;
            }
            Store.InsertQuiz(acertos, total);
            Helpers.WriteJson(context, 201, new { ok = true });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.TraceError(ex.ToString());
            Helpers.WriteJson(context, 500, new { erro = "Erro interno do servidor. Verifique a conexão com o SQL Server." });
        }
    }

    private static int ToInt(System.Collections.Generic.Dictionary<string, object> data, string key, int fallback)
    {
        object value;
        if (!data.TryGetValue(key, out value) || value == null) return fallback;
        try { return Convert.ToInt32(value); }
        catch { return fallback; }
    }

    public bool IsReusable { get { return false; } }
}
