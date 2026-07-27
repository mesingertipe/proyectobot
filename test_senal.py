from openai import OpenAI
import os
# Usa tu API Key
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-api-key-here"))


prompt = (
    "Eres Crypto Quant, especializado en trading intradía (NO scalping).\n"
    "Debes generar señales claras y analíticas.\n\n"
    "Formato de salida:\n"
    "{\n"
    "  \"symbol\": \"BTCUSDT\",\n"
    "  \"side\": \"BUY\" o \"SELL\",\n"
    "  \"entry_trigger\": 108200,\n"
    "  \"stop_loss\": 113200,\n"
    "  \"take_profits\": [\n"
    "    {\"index\": 1, \"price\": 110000, \"qty_pct\": 0.5},\n"
    "    {\"index\": 2, \"price\": 111500, \"qty_pct\": 0.5}\n"
    "  ],\n"
    "  \"risk_reward\": \"1:2\"\n"
    "}\n\n"
    "Después de ese bloque JSON, añade un breve análisis en texto (máx 3 líneas)."
)

response = client.responses.create(
    model="gpt-4o",
    input=prompt
)

print("\n=== Señal generada ===")
print(response.output_text)
