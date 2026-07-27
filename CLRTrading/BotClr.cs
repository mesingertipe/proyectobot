using System;
using System.Data.SqlTypes;
using Microsoft.SqlServer.Server;
using System.Data.SqlClient;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Authentication;
using System.Globalization;
using static BotClr;
public class BotClr
{
    // === CONFIG === (colócalo en tablas seguras o SQL Credential Manager)
    static readonly string OPENAI_KEY = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "your-api-key-here";
    static readonly string OPENAI_ASSISTANT_ID = Environment.GetEnvironmentVariable("OPENAI_ASSISTANT_ID") ?? "asst_sg0q8lXjHTwFvYqHImWqqwTj";   // crea uno propio
    static readonly string BINGX_KEY = Environment.GetEnvironmentVariable("BINGX_KEY") ?? "3MH0NTdDc7ZDClNoVdHofyToIEAoEmbzvnIsVmd7FXs0Nhy5BASpq6r4aaIPNfWJJtnfrA8DZhBCtH9Aqag6w";
    static readonly string BINGX_SECRET = Environment.GetEnvironmentVariable("BINGX_SECRET") ?? "mm0mRIQa0Og8khw1Vtb9gDbVJNayvwxrBje85w1YpBMrsFZu515bjT2tNVsVMzNMEzwA5kq1em7WQWb2y4Nuw";
    static readonly string BINGX_BASE = "https://open-api.bingx.com"; // v2 domain

    // ===== Modelos DTO =====
    // ===== DTOs =====
    [DataContract]
    public class TP
    {
        [DataMember] public int index { get; set; }
        [DataMember] public decimal price { get; set; }
        [DataMember] public decimal qty_pct { get; set; }
    }

    [DataContract]
    public class SignalDto
    {
        [DataMember] public string symbol { get; set; }
        [DataMember] public string side { get; set; }
        [DataMember] public decimal entry_trigger { get; set; }
        [DataMember] public decimal stop_loss { get; set; }
        [DataMember] public TP[] take_profits { get; set; }

        // extras
        public string raw_json { get; set; }
        public string analysis_text { get; set; }
    }

        public class Kline
        {
            public long time { get; set; }
            public decimal open { get; set; }
            public decimal high { get; set; }
            public decimal low { get; set; }
            public decimal close { get; set; }
            public decimal volume { get; set; }
        }

    // ===== Helper JSON =====
    static T FromJson<T>(string json)
    {
        var serializer = new DataContractJsonSerializer(typeof(T));
        using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
        {
            return (T)serializer.ReadObject(ms);
        }
    }


    [SqlProcedure]
    public static void usp_DebugKlines(SqlString symbol, SqlString timeframe, SqlInt32 numCandles)
    {
        // en tu clase BotClr (ejecutar al inicio de cada SP)
        System.Net.ServicePointManager.Expect100Continue = true;
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Ssl3 | SecurityProtocolType.Tls | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls12;

        var klines = GetRecentKlines(symbol.Value, timeframe.Value, numCandles.Value).GetAwaiter().GetResult();

        InsertDebug("KLINES", string.Join("\n", klines.Select(k =>
           $"{k.time},{k.open},{k.high},{k.low},{k.close},{k.volume}"))).Wait();

        foreach (var k in klines)
        {
            var dt = DateTimeOffset.FromUnixTimeMilliseconds(k.time).UtcDateTime;
            SqlContext.Pipe.Send($"{dt:yyyy-MM-dd HH:mm} O:{k.open} H:{k.high} L:{k.low} C:{k.close} V:{k.volume}");
        }
    }
    // ===== Procedimiento principal =====
    [SqlProcedure]
    public static void usp_GetSignalAndExecute(SqlString symbol, SqlDecimal qty, SqlString timeframe, SqlInt32 numCandles)
    {
        // en tu clase BotClr (ejecutar al inicio de cada SP)
ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        // 1. Traer velas de BingX
        var klines = GetRecentKlines(symbol.Value, timeframe.Value, numCandles.Value).GetAwaiter().GetResult();
        // Después de traer velas
        InsertDebug("KLINES", string.Join("\n", klines.Select(k =>
            $"{k.time},{k.open},{k.high},{k.low},{k.close},{k.volume}"))).Wait();

        var klines200 = GetRecentKlines(symbol.Value, timeframe.Value, 200).GetAwaiter().GetResult();
        // Después de traer velas
        // 2. Obtener señal de OpenAI con esos datos
        var signal = GetSignalFromResponses(symbol.Value, klines, klines200).GetAwaiter().GetResult();
        long signalId = InsertSignal(signal).GetAwaiter().GetResult();

        // 3. Ejecutar orden principal (market)
        var orderId = PlaceEntryOrderOnBingX(signal, qty.Value).GetAwaiter().GetResult();
        long localOrderId = InsertOrder(signalId, signal.symbol, signal.side, qty.Value, "NEW", orderId, signal.stop_loss, signal.take_profits[0].price, signal.entry_trigger).GetAwaiter().GetResult();
        InsertEvent(localOrderId, "PLACED", "{}").Wait();
        // 2. Esperar hasta que la posición esté abierta
        bool positionOpen = false;
        for (int i = 0; i < 30; i++) // reintenta 30 veces
        {
            Task.Delay(2000).GetAwaiter().GetResult(); ; // espera 2 segundos
            if (HasOpenPosition(signal.symbol, signal.side).GetAwaiter().GetResult())
            {
                positionOpen = true;
                break;
            }
        }

        // Si hay más TPs, crear reduce-only adicionales
        for (int i = 0; i < signal.take_profits.Length; i++)
        {
            var tp = signal.take_profits[i];
            decimal partialQty = qty.Value * (decimal)tp.qty_pct;

            string respTP = PlaceExtraTP(signal.symbol, signal.side, partialQty, tp.price).GetAwaiter().GetResult();
            InsertTP(localOrderId,i+1, tp.price, partialQty).GetAwaiter().GetResult();
        }
    }

    // ===== Consulta de velas BingX =====
        static async Task<List<Kline>> GetRecentKlines(string symbol, string interval, int limit)
        {
            System.Net.ServicePointManager.Expect100Continue = true;
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Ssl3 | SecurityProtocolType.Tls | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls12;
            HttpClientHandler clientHandler1 = new HttpClientHandler();
            clientHandler1.ServerCertificateCustomValidationCallback += (sender, cert, chain, sslPolicyErrors) => { return true; };
            clientHandler1.SslProtocols = SslProtocols.Tls12;

            var url = $"{BINGX_BASE}/openApi/swap/v3/quote/klines?symbol={symbol}&interval={interval}&limit={limit}";
            var http = new HttpClient(clientHandler1);
            var resp = await http.GetStringAsync(url);
            var klines = new List<Kline>();
            var ci = CultureInfo.InvariantCulture;

            // Extrae el bloque del array "data":  ..."data":[ {...},{...}, ... ]
            var dataMatch = Regex.Match(resp, "\"data\"\\s*:\\s*\\[(.*)\\]\\s*\\}", RegexOptions.Singleline);
            if (!dataMatch.Success) return klines;

            // Toma cada objeto { "open":"...", "close":"...", ... }
            var items = Regex.Matches(dataMatch.Groups[1].Value, "\\{[^\\}]*\\}");
            foreach (Match m in items)
            {
                string obj = m.Value;

                // Campo-agnóstico al orden de propiedades
                var open = decimal.Parse(Regex.Match(obj, "\"open\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value, ci);
                var high = decimal.Parse(Regex.Match(obj, "\"high\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value, ci);
                var low = decimal.Parse(Regex.Match(obj, "\"low\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value, ci);
                var close = decimal.Parse(Regex.Match(obj, "\"close\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value, ci);
                var volume = decimal.Parse(Regex.Match(obj, "\"volume\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value, ci);
                var time = long.Parse(Regex.Match(obj, "\"time\"\\s*:\\s*(\\d+)").Groups[1].Value, ci);

                klines.Add(new Kline
                {
                    time = time,
                    open = open,
                    high = high,
                    low = low,
                    close = close,
                    volume = volume
                });
            }

            // Ordena asc por tiempo (opcional)
            klines.Sort((a, b) => a.time.CompareTo(b.time));
            return klines;
    }

    // ===== OpenAI Responses API =====
    static async Task<SignalDto> GetSignalFromResponses(string symbol, List<Kline> klines, List<Kline> klines200)
    {
        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("Authorization", $"Bearer {OPENAI_KEY}");

        var candlesText = new StringBuilder();
        candlesText.AppendLine("Velas recientes (OHLCV, 20–50 velas de 1m):");
        foreach (var k in klines)
        {
            var dt = DateTimeOffset.FromUnixTimeMilliseconds(k.time).UtcDateTime;
            candlesText.AppendLine($"{dt:yyyy-MM-dd HH:mm} O:{k.open} H:{k.high} L:{k.low} C:{k.close} V:{k.volume}");
        }

        var candlesLong = new StringBuilder();
        candlesLong.AppendLine("Velas recientes (OHLCV, 200 velas de 1m):");
        foreach (var k in klines200)
        {
            var dt = DateTimeOffset.FromUnixTimeMilliseconds(k.time).UtcDateTime;
            candlesLong.AppendLine($"{dt:yyyy-MM-dd HH:mm} O:{k.open} H:{k.high} L:{k.low} C:{k.close} V:{k.volume}");
        }

        var prompt = $@"Eres Crypto Quant, especializado en trading de criptomonedas.
Tu enfoque es scalping: operaciones de minutos a pocas horas, con entradas rápidas y salidas precisas.
Debes generar señales claras basadas en soportes, resistencias, medias móviles, momentum y volumen.

📊 Datos recientes:
- Velas cortas (20–50 velas de 1 minuto):{candlesText}
- Velas largas (200 velas de 1 minuto para contexto intradía): {candlesLong}

⚙️ Reglas:\n
        - Solo señales de scalping (duración minutos a pocas horas).
        - El stop_loss debe estar SIEMPRE al 1% del entry_trigger
          (para BUY, 1% por debajo; para SELL, 1% por encima).
        - Take Profits deben calcularse con risk/reward mínimo de 1:2,
          y si la volatilidad y resistencias lo permiten, usar 1:3.
        - Si no hay espacio suficiente para un TP con al menos 1:2, no generes señal.
        - Entrega SIEMPRE la señal en JSON estandarizado con los campos:
          symbol, side, entry_trigger, stop_loss,
          take_profits:[{{index,price,qty_pct}}], risk_reward.
        ⚙️ Entrega la señal en formato JSON:
        {{
          ""symbol"": ""{symbol}"",
          ""side"": ""BUY"" o ""SELL"",
          ""entry_trigger"": número,
          ""stop_loss"": número,
          ""take_profits"": [
            {{""index"": 1, ""price"": número, ""qty_pct"": 0.5}},
            {{""index"": 2, ""price"": número, ""qty_pct"": 0.5}}
          ],
          ""risk_reward"": ""1:2"" o ""1:3""
        }}

Después del JSON, agrega un análisis breve (máx 3 líneas).
que justifique la señal y explique el contexto técnico.\n
No mezcles el JSON con el análisis.
";

        var safePrompt = prompt.Replace("\\", "\\\\")
                       .Replace("\"", "\\\"")
                       .Replace("\r", "\\r")
                       .Replace("\n", "\\n");

        var body = $@"{{
            ""model"": ""gpt-4o"",
            ""input"": ""{safePrompt}""
        }}";

        // Antes de enviar prompt a OpenAI
        InsertDebug("PROMPT", prompt).Wait();

        var resp = await http.PostAsync(
            "https://api.openai.com/v1/responses",
            new StringContent(body, Encoding.UTF8, "application/json")
        );
        var result = await resp.Content.ReadAsStringAsync();

        // 1. Extraer el campo "text"
        var textMatch = Regex.Match(result, "\"text\"\\s*:\\s*\"([\\s\\S]*?)\"\\s*\\}", RegexOptions.Singleline);
        var fullText = textMatch.Success ? textMatch.Groups[1].Value : "";

        // 2. Decodificar secuencias escapadas (\n, \")
        fullText = fullText.Replace("\\n", "\n").Replace("\\\"", "\"");

        // 3. Extraer el bloque JSON de dentro de ```json ... ```
        var jsonBlock = ExtractJsonBlock(fullText);

        // 4. Resto igual
        InsertDebug("OPENAI_RESPONSE", fullText).Wait();
        var sig = FromJson<SignalDto>(jsonBlock);
        sig.raw_json = jsonBlock;
        sig.analysis_text = fullText;
        return sig;

    }

    static string ExtractJsonBlock(string text)
    {
        var match = Regex.Match(text, "```json\\s*([\\s\\S]*?)\\s*```", RegexOptions.IgnoreCase);
        if (match.Success) return match.Groups[1].Value;

        match = Regex.Match(text, "(\\{[\\s\\S]*\\})");
        return match.Success ? match.Groups[1].Value : "{}";
    }

    // ===== Insertar en SQL =====
    static async Task<long> InsertSignal(SignalDto s)
    {
        var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"
INSERT INTO dbo.Signals(Symbol,Side,EntryTrigger,StopLoss,TakeProfitMain,RawJson,AnalysisText)
OUTPUT INSERTED.SignalId
VALUES (@sym,@side,@trig,@sl,@tp,@raw,@an)";
        cmd.Parameters.AddWithValue("@sym", s.symbol);
        cmd.Parameters.AddWithValue("@side", s.side);
        cmd.Parameters.AddWithValue("@trig", s.entry_trigger);
        cmd.Parameters.AddWithValue("@sl", s.stop_loss);
        cmd.Parameters.AddWithValue("@tp", s.take_profits.Length > 0 ? s.take_profits[1].price : 0);
        cmd.Parameters.AddWithValue("@raw", s.raw_json);
        cmd.Parameters.AddWithValue("@an", s.analysis_text ?? "");
        return (long)await cmd.ExecuteScalarAsync();
    }

    static async Task<long> InsertOrder(long signalId, string symbol, string side, decimal qty, string status, string exOrderId, decimal sl, decimal tp, decimal ep)
    {
        var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"
INSERT INTO dbo.Orders(SignalId,Symbol,Side,Qty,Status,ExchangeOrderId, CurrentSL, TakeProfit,EntryPrice)
OUTPUT INSERTED.OrderId
VALUES (@sid,@sym,@side,@qty,@st,@exid,@sl, @tp, @ep)";
        cmd.Parameters.AddWithValue("@sid", signalId);
        cmd.Parameters.AddWithValue("@sym", symbol);
        cmd.Parameters.AddWithValue("@side", side);
        cmd.Parameters.AddWithValue("@qty", qty);
        cmd.Parameters.AddWithValue("@st", status);
        cmd.Parameters.AddWithValue("@sl", sl);
        cmd.Parameters.AddWithValue("@tp", tp);
        cmd.Parameters.AddWithValue("@ep", ep);
        cmd.Parameters.AddWithValue("@exid", exOrderId ?? "");
        return (long)await cmd.ExecuteScalarAsync();
    }

    static async Task InsertTP(long orderId, int idx, decimal price, decimal qty)
    {
        var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.TPTargets(OrderId,TargetIndex,TargetPrice,TargetQty) VALUES(@o,@i,@p,@q)";
        cmd.Parameters.AddWithValue("@o", orderId);
        cmd.Parameters.AddWithValue("@i", idx);
        cmd.Parameters.AddWithValue("@p", price);
        cmd.Parameters.AddWithValue("@q", qty);
        await cmd.ExecuteNonQueryAsync();
    }

    static async Task InsertEvent(long orderId, string kind, string dataJson)
    {
        var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.OrderEvents(OrderId,Kind,DataJson) VALUES(@o,@k,@d)";
        cmd.Parameters.AddWithValue("@o", orderId);
        cmd.Parameters.AddWithValue("@k", kind);
        cmd.Parameters.AddWithValue("@d", dataJson ?? "");
        await cmd.ExecuteNonQueryAsync();
    }

    // ===== BingX: órdenes =====
    static async Task<string> PlaceEntryOrderOnBingX(SignalDto s, decimal qty)
    {
        decimal lastPrice = await GetLastPrice(s.symbol);

        if (s.side == "BUY")
        {
            if (s.stop_loss >= lastPrice)
                s.stop_loss = lastPrice * 0.99m;  // ajusta 1% debajo
            for (int i = 0; i < s.take_profits.Length; i++)
                if (s.take_profits[i].price <= lastPrice)
                    s.take_profits[i].price = lastPrice * 1.01m;
        }
        else // SELL
        {
            if (s.stop_loss <= lastPrice)
                s.stop_loss = lastPrice * 1.01m;
            for (int i = 0; i < s.take_profits.Length; i++)
                if (s.take_profits[i].price >= lastPrice)
                    s.take_profits[i].price = lastPrice * 0.99m;
        }
        var endpoint = "/openApi/swap/v2/trade/order";  // usar /order/test si quieres simular
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();

        // Definir side y positionSide
        string side = s.side.ToUpper(); // BUY o SELL
        string positionSide = side == "BUY" ? "LONG" : "SHORT";

        // JSON para Take Profit (usamos el primer TP del assistant como target principal)
        var tp = s.take_profits.Length > 0 ? s.take_profits[0].price : 0;
        string tpJson = "{\"type\":\"TAKE_PROFIT_MARKET\",\"stopPrice\":" + tp +
                        ",\"price\":" + tp + ",\"workingType\":\"MARK_PRICE\"}";

        // JSON para Stop Loss
        string slJson = "{\"type\":\"STOP_MARKET\",\"stopPrice\":" + s.stop_loss +
                        ",\"workingType\":\"MARK_PRICE\"}";

        string orderType = "LIMIT"; // ejemplo: usar LIMIT con entry_trigger
        string extraParams = $"&price={s.entry_trigger}";
        // Query string con todos los parámetros
        var query = $"symbol={s.symbol}" +
                    $"&side={side}" +
                    $"&positionSide=BOTH" +
                    $"&type={orderType}" +
                    extraParams +
                    $"&quantity={qty}" +
                    //$"&takeProfit={tpJson}" +
                    $"&stopLoss={slJson}" +
                    $"&timestamp={ts}";

        // Firmar la query
        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";

        // Enviar la petición
        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);

        var resp = await http.PostAsync(url, null);
        var body = await resp.Content.ReadAsStringAsync();
        InsertDebug("BODY BINX CREATE", body).Wait();

        return Regex.Match(body, "\"orderId\"\\s*:\\s*\"?([^\"]+)").Groups[1].Value;

    }

    static async Task<decimal> GetLastPrice(string symbol)
    {
        var url = $"{BINGX_BASE}/openApi/swap/v2/quote/price?symbol={symbol}";
        var http = new HttpClient();
        var resp = await http.GetStringAsync(url);

        var match = Regex.Match(resp, "\"price\":\"([0-9.]+)\"");
        return decimal.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
    }

    static async Task<string> PlaceExtraTP(string symbol, string side, decimal qty, decimal price)
    {
        var endpoint = "/openApi/swap/v2/trade/order";
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();

        // TP siempre se hace en el lado opuesto
        string opposite = side == "BUY" ? "SELL" : "BUY";
        string positionSide = side == "BUY" ? "LONG" : "SHORT";

        var query = $"symbol={symbol}" +
                    $"&side={opposite}" +
                    $"&positionSide=BOTH" +
                    $"&type=LIMIT" +
                    $"&reduceOnly=true" +
                    $"&quantity={qty}" +
                    $"&price={price}" +
                    $"&timestamp={ts}";

        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";

        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);

        var resp = await http.PostAsync(url, null);
        var body = await resp.Content.ReadAsStringAsync();
        
        InsertDebug("BODY BINX TAKE PROFIT", body).Wait();
        return body;
    }

    static async Task<bool> HasOpenPosition(string symbol, string side)
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var endpoint = "/openApi/swap/v2/user/positions";
        var query = $"symbol={symbol}&timestamp={ts}";
        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";

        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);

        var resp = await http.GetStringAsync(url);
        return resp.Contains("\"positionAmt\":\"0\"") == false;
    }

    // ===== Mover StopLoss a break-even =====
    static async Task<string> MoveStopLoss(string symbol, string side, decimal newStop)
    {
        var endpoint = "/openApi/swap/v2/trade/order";
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();

        string opposite = side == "BUY" ? "SELL" : "BUY";
        string positionSide = side == "BUY" ? "LONG" : "SHORT";

        var query = $"symbol={symbol}" +
                    $"&side={opposite}" +
                    $"&positionSide={positionSide}" +
                    $"&type=STOP_MARKET" +
                    $"&reduceOnly=true" +
                    $"&stopPrice={newStop}" +
                    $"&workingType=MARK_PRICE" +
                    $"&timestamp={ts}";

        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";

        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);
        var resp = await http.PostAsync(url, null);
        return await resp.Content.ReadAsStringAsync();
    }
    static async Task<string> PlaceReduceOnlyTP(string symbol, string side, decimal qty, decimal price)
    {
        var endpoint = "/openApi/swap/v2/trade/order";
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var opposite = side == "SELL" ? "BUY" : "SELL";
        //var query = $"symbol={symbol}&side={opposite}&positionSide={(opposite == "BUY" ? "LONG" : "SHORT")}&type=LIMIT&reduceOnly=true&quantity={qty}&price={price}&timestamp={ts}";
        var query = $"symbol={symbol}&side={opposite}&positionSide=BOTH&type=TAKE_PROFIT_MARKET&quantity={qty}&stopPrice={price}&timestamp={ts}";
        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";
        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);
        var resp = await http.PostAsync(url, null);
        var body = await resp.Content.ReadAsStringAsync();
        // Antes de enviar prompt a OpenAI
        InsertDebug("BODY BINX TAKE PROFIT", body).Wait();
        return body;
    }

    static async Task<string> PlaceReduceOnlySL(string symbol, string side, decimal qty, decimal slPrice)
    {
        var endpoint = "/openApi/swap/v2/trade/order";
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var opposite = side == "SELL" ? "BUY" : "SELL";
        //var query = $"symbol={symbol}&side={opposite}&positionSide={(opposite == "BUY" ? "LONG" : "SHORT")}&type=STOP_MARKET&reduceOnly=true&triggerPrice={slPrice}&quantity={qty}&timestamp={ts}";
        var query = $"symbol={symbol}&side={opposite}&positionSide=BOTH&type=STOP_MARKET&stopPrice={slPrice}&quantity={qty}&timestamp={ts}";
        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";
        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);
        var resp = await http.PostAsync(url, null);
        var body = await resp.Content.ReadAsStringAsync();
        InsertDebug("BODY BINX STOP LOSE", body).Wait();

        return body;
    }

    static string Sign(string query, string secret)
    {
        var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = h.ComputeHash(Encoding.UTF8.GetBytes(query));
        var sb = new StringBuilder();
        foreach (var b in hash) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    static async Task InsertDebug(string step, string data)
    {
        var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
        await conn.OpenAsync();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.BotDebugLog(Step, Data) VALUES(@s,@d)";
        cmd.Parameters.AddWithValue("@s", step);
        cmd.Parameters.AddWithValue("@d", data ?? "");
        await cmd.ExecuteNonQueryAsync();
    }

    [SqlProcedure]
    public static void usp_CheckPositionsAndTrail()
    {
        // en tu clase BotClr (ejecutar al inicio de cada SP)
        System.Net.ServicePointManager.Expect100Continue = true;
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Ssl3 | SecurityProtocolType.Tls | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls12;

        // 1. Traer todas las posiciones de la tabla
        using (var conn = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;"))
        {
            conn.Open();
            var cmd = new SqlCommand("SELECT OrderId,  Symbol, Side,CurrentSL,TakeProfit, isnull((SELECT TOP 1  [TargetPrice] FROM [TradingDB].[dbo].[TPTargets] T  WHERE T.[TargetPrice]<>TakeProfit and T.[TargetPrice]>TakeProfit AND  T.[OrderId]=dbo.Orders.OrderId  ORDER BY [TargetPrice] ASC),0) as TargetNext,ExchangeOrderId FROM dbo.Orders WHERE CreatedAt>DATEADD(DAY,-1,GETDATE()) and [ExchangeOrderId] is not null and [ExchangeOrderId] <>''", conn);
            using (var rdr = cmd.ExecuteReader())
            {
                while (rdr.Read())
                {
                    long id = rdr.GetInt64(0);
                    string symbol = rdr.GetString(1);
                    string side = rdr.GetString(2);
                    decimal currentSL = rdr.GetDecimal(3);
                    decimal takeProfit = rdr.GetDecimal(4);
                    decimal takeProfitNext = rdr.GetDecimal(5);
                    string ExchangeOrderId = rdr.GetString(6).Replace(",","");


                    // 2. Consultar último precio
                    decimal lastPrice = GetLastPrice(symbol).GetAwaiter().GetResult();

                    // 3. Calcular nuevo SL
                    decimal newSL = currentSL;
                    if (side == "BUY")
                    {
                        decimal candidate = (takeProfit+ (takeProfit+1/100));
                        if (lastPrice >= candidate) newSL = takeProfit+1;
                    }
                    else // SELL
                    {
                        decimal candidate = takeProfit - (takeProfit + 1 / 100);
                        if (lastPrice <= candidate) newSL = takeProfit-1;
                    }

                    // 4. Si hay cambio → mover SL en BingX y actualizar tabla
                    if (newSL != currentSL)
                    {
                        string resp = MoveStopLoss(symbol, side, newSL).GetAwaiter().GetResult();

                        var conn2 = new SqlConnection("Data Source=TECHDEVICE;Initial Catalog=TradingDB;Integrated Security=True;");
                        conn2.Open();
                        var upd = new SqlCommand("UPDATE dbo.Orders SET CurrentSL=@sl,TakeProfit=@tp, Status='MoveStopLoss',  UpdatedAt=SYSUTCDATETIME() WHERE OrderId=@id", conn2);
                        upd.Parameters.AddWithValue("@sl", newSL);
                        upd.Parameters.AddWithValue("@tp", takeProfitNext);
                        upd.Parameters.AddWithValue("@id", id);
                        upd.ExecuteNonQuery();
                        conn2.Close();
                        InsertDebug("TRALING","Order Id " + id.ToString() + " New Stop->" + newSL.ToString() + " New TakeProfit->" + takeProfitNext).Wait();

                    }

                }
            }
        }
    }
    [SqlProcedure]
    public static void usp_CheckOrderStatus(SqlString symbol, SqlString orderId)
    {
        string status = GetOrderStatus(symbol.Value, orderId.Value).GetAwaiter().GetResult();
        SqlContext.Pipe.Send($"Order {orderId.Value} on {symbol.Value} => {status}");
    }
    static async Task<string> GetOrderStatus(string symbol, string orderId)
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var endpoint = "/openApi/swap/v2/trade/order";
        var query = $"symbol={symbol}&orderId={orderId}&timestamp={ts}";
        var sig = Sign(query, BINGX_SECRET);
        var url = $"{BINGX_BASE}{endpoint}?{query}&signature={sig}";

        var http = new HttpClient();
        http.DefaultRequestHeaders.Add("X-BX-APIKEY", BINGX_KEY);
        var resp = await http.GetStringAsync(url);

        var match = Regex.Match(resp, "\"status\":\"(\\w+)\"");
        return match.Success ? match.Groups[1].Value : "UNKNOWN";
    }
}
