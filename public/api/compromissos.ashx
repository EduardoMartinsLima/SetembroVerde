<%@ WebHandler Language="C#" Class="CompromissosHandler" %>

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Web;

// Estação 04 — "Meu Compromisso"
public class CompromissosHandler : IHttpHandler
{
    private static readonly string[] ItensPermitidos = {
        "Respeito a autonomia das pessoas.",
        "Pergunto antes de ajudar.",
        "Não reproduzo preconceitos.",
        "Respeito as diferenças.",
        "Evito atitudes capacitistas.",
        "Procuro perceber e eliminar barreiras.",
        "Trato todos com respeito e dignidade.",
        "Procuro aprender mais sobre inclusão."
    };

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

            // JavaScriptSerializer desserializa um array JSON como ArrayList
            // (não como object[]), então o cast precisa passar por IEnumerable.
            object itensRaw;
            var itens = new List<string>();
            if (data.TryGetValue("itens", out itensRaw))
            {
                var itensEnumerable = itensRaw as IEnumerable;
                if (itensEnumerable != null)
                {
                    foreach (var item in itensEnumerable)
                    {
                        var texto = item as string;
                        if (!string.IsNullOrEmpty(texto) && ItensPermitidos.Contains(texto))
                        {
                            itens.Add(texto);
                        }
                    }
                }
            }

            var compromisso = Helpers.CleanText(Helpers.GetString(data, "compromisso"), 300);

            if (itens.Count == 0 && string.IsNullOrEmpty(compromisso))
            {
                Helpers.WriteJson(context, 400, new { erro = "Selecione ao menos uma atitude ou escreva seu compromisso." });
                return;
            }

            Store.InsertCompromisso(itens, compromisso);
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
