// Trilha da Inclusão CAR - utilitários compartilhados pelos handlers ASP.NET.

using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Script.Serialization;

public static class Helpers
{
    public static string CleanText(string value, int maxLen)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var collapsed = Regex.Replace(value, @"\s+", " ").Trim();
        return collapsed.Length > maxLen ? collapsed.Substring(0, maxLen) : collapsed;
    }

    public static void WriteJson(HttpContext context, int statusCode, object payload)
    {
        context.Response.StatusCode = statusCode;
        // Definir só o charset no Content-Type não é suficiente: sem isto,
        // o Response.Write pode gravar os bytes usando o encoding padrão do
        // servidor (ex.: Windows-1252 num Windows em português), corrompendo
        // acentos mesmo com o cabeçalho dizendo "utf-8".
        context.Response.ContentEncoding = Encoding.UTF8;
        context.Response.ContentType = "application/json; charset=utf-8";
        var serializer = new JavaScriptSerializer();
        context.Response.Write(serializer.Serialize(payload));
    }

    public static Dictionary<string, object> ReadJsonBody(HttpContext context)
    {
        string body;
        using (var reader = new System.IO.StreamReader(context.Request.InputStream, Encoding.UTF8))
        {
            body = reader.ReadToEnd();
        }
        if (string.IsNullOrWhiteSpace(body)) return new Dictionary<string, object>();
        var serializer = new JavaScriptSerializer();
        return serializer.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
    }

    public static string GetString(Dictionary<string, object> data, string key)
    {
        object value;
        if (data != null && data.TryGetValue(key, out value)) return value as string;
        return null;
    }
}
