<%@ WebHandler Language="C#" Class="StatsHandler" %>

using System;
using System.Web;

// Números públicos da campanha (painel de encerramento)
public class StatsHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        try
        {
            var respostas = Store.Count("TrilhaRespostas");
            var folhas = Store.Count("TrilhaFolhas");
            var compromissos = Store.Count("TrilhaCompromissos");
            var quiz = Store.Count("TrilhaQuiz");
            Helpers.WriteJson(context, 200, new
            {
                mensagensRecebidas = respostas + folhas,
                compromissosRegistrados = compromissos,
                respostasNoQuiz = quiz,
                participacoesTotais = respostas + folhas + compromissos + quiz
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.TraceError(ex.ToString());
            Helpers.WriteJson(context, 500, new { erro = "Erro interno do servidor. Verifique a conexão com o SQL Server." });
        }
    }

    public bool IsReusable { get { return false; } }
}
