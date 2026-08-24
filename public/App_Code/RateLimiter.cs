// Proteção simples contra spam, sem guardar identificação de quem enviou:
// só uma janela deslizante em memória, por IP, para limitar a taxa de envio.

using System;
using System.Collections.Generic;

public static class RateLimiter
{
    private static readonly Dictionary<string, List<DateTime>> Hits = new Dictionary<string, List<DateTime>>();
    private static readonly object Lock = new object();
    private const int WindowSeconds = 60;
    private const int MaxRequests = 10;

    public static bool IsLimited(string ip)
    {
        if (string.IsNullOrEmpty(ip)) ip = "anon";
        lock (Lock)
        {
            var now = DateTime.UtcNow;
            List<DateTime> list;
            if (!Hits.TryGetValue(ip, out list))
            {
                list = new List<DateTime>();
                Hits[ip] = list;
            }
            list.RemoveAll(t => (now - t).TotalSeconds >= WindowSeconds);
            list.Add(now);
            return list.Count > MaxRequests;
        }
    }
}
