// Trilha da Inclusão CAR - utilitários compartilhados pelos handlers ASP.NET.

using System;
using System.Collections.Generic;
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
        context.Response.ContentType = "application/json; charset=utf-8";
        var serializer = new JavaScriptSerializer();
        context.Response.Write(serializer.Serialize(payload));
    }

    public static Dictionary<string, object> ReadJsonBody(HttpContext context)
    {
        string body;
        using (var reader = new System.IO.StreamReader(context.Request.InputStream))
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
