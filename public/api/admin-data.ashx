<%@ WebHandler Language="C#" Class="AdminDataHandler" %>

using System;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Web;

// Painel do RH — protegido por chave simples (AdminKey em appSettings.config)
public class AdminDataHandler : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        var adminKey = ConfigurationManager.AppSettings["AdminKey"];
        var key = context.Request.QueryString["key"];
        if (string.IsNullOrEmpty(adminKey) || key != adminKey)
        {
            Helpers.WriteJson(context, 401, new { erro = "Acesso não autorizado." });
            return;
        }
        try
        {
            var respostas = Store.ReadRespostasTexto();
            var folhas = Store.ReadFolhasTexto();
            var compromissosCount = Store.Count("TrilhaCompromissos");
            var quizCount = Store.Count("TrilhaQuiz");
            var frequencia = Store.FrequenciaCompromissos();
            var media = Store.MediaAcertosQuiz();

            Helpers.WriteJson(context, 200, new
            {
                totais = new
                {
                    mensagensRecebidas = respostas.Count + folhas.Count,
                    compromissosRegistrados = compromissosCount,
                    respostasNoQuiz = quizCount,
                    mediaAcertosQuiz = media.HasValue
                        ? Math.Round(media.Value, 2).ToString(CultureInfo.InvariantCulture)
                        : null
                },
                respostas = respostas.Select(t => new { texto = t }).ToArray(),
                folhas = folhas.Select(t => new { texto = t }).ToArray(),
                frequenciaCompromissos = frequencia
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
