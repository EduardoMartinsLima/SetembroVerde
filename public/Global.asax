<%@ Application Language="C#" %>

<script runat="server">
    void Application_Start(object sender, EventArgs e)
    {
        try
        {
            Store.EnsureSchema();
            System.Diagnostics.Trace.TraceInformation("Conexão com o SQL Server estabelecida e tabelas verificadas.");
        }
        catch (Exception ex)
        {
            // As páginas estáticas continuam no ar mesmo se isso falhar — só os
            // formulários (api/*.ashx) vão retornar erro até a conexão ser corrigida.
            System.Diagnostics.Trace.TraceError("Falha ao preparar o banco de dados no início: " + ex.ToString());
        }
    }
</script>
