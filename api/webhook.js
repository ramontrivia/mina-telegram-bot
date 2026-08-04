// api/webhook.js
// Função serverless (Vercel) que recebe mensagens do bot do Telegram,
// consulta os dados do painel e responde usando a API do Claude.
//
// Variáveis de ambiente necessárias (configurar no painel da Vercel):
//   TELEGRAM_BOT_TOKEN   -> token que o @BotFather te deu
//   ANTHROPIC_API_KEY    -> chave da API do Claude (console.anthropic.com)
//   PAINEL_DATA_URL      -> https://www.triviaconect.com/dados-painel.json
//                           (arquivo publicado no mesmo repositório do painel;
//                           enquanto não estiver configurado, o bot usa o
//                           snapshot fixo abaixo como reserva)

const SNAPSHOT_RESERVA = {
  atualizado_em: "2026-07-29T15:00:00",
  kpis: {
    pct_atingido_mes: 65.2,
    massa_total_t: 1348692.6,
    volume_planejado_m3: 120054.42,
    volume_realizado_m3: 78329.29,
    variacao_m3: -41725.13
  },
  pilha: {
    nivel_atual: 9,
    pct_nivel_atual: 89.3,
    pct_capacidade_total: 10.3,
    capacidade_total_m3: 4690868.4,
    volume_acumulado_m3: 481675.93,
    niveis: [
      { nivel: 7, capacidade_m3: 63294.4 },
      { nivel: 8, capacidade_m3: 215830.16 },
      { nivel: 9, capacidade_m3: 226734.32 },
      { nivel: 10, capacidade_m3: 309249.2 },
      { nivel: 11, capacidade_m3: 348394.24 },
      { nivel: 12, capacidade_m3: 380809.2 },
      { nivel: 13, capacidade_m3: 403299.28 },
      { nivel: 14, capacidade_m3: 428926.96 },
      { nivel: 15, capacidade_m3: 444499.84 },
      { nivel: 16, capacidade_m3: 470668.56 },
      { nivel: 17, capacidade_m3: 491854.16 },
      { nivel: 18, capacidade_m3: 398817.28 },
      { nivel: 19, capacidade_m3: 300900.96 },
      { nivel: 20, capacidade_m3: 207589.84 }
    ]
  },
  diario: {
    meta_dia_m3: 3872.72,
    dia_anterior: "28/07/2026",
    realizado_dia_anterior_m3: 1932.39,
    pct_dia_anterior: 49.9
  }
};

async function buscarDadosAtuais() {
  const url = process.env.PAINEL_DATA_URL;
  if (!url) return SNAPSHOT_RESERVA;
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return SNAPSHOT_RESERVA;
    return await resp.json();
  } catch (e) {
    return SNAPSHOT_RESERVA;
  }
}

async function perguntarClaude(pergunta, dados) {
  const systemPrompt =
    "Você é o assistente da pilha de estéril ECHEMAT, de uma operação de mineração. " +
    "Responda em português, de forma direta e profissional, curto (poucas frases). " +
    "Você APENAS consulta e simula cenários com os dados fornecidos abaixo — nunca " +
    "afirme que alterou ou vai alterar qualquer valor real. " +
    "Se pedirem simulação, deixe claro que é uma projeção hipotética, não um dado real. " +
    "Dados atuais do painel (JSON):\n" + JSON.stringify(dados);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: pergunta }]
    })
  });
  const data = await resp.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "Não consegui gerar uma resposta agora, tenta de novo.";
}

async function responderTelegram(chatId, texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("Bot da pilha de estéril está no ar.");
    return;
  }
  try {
    const update = req.body;
    const msg = update.message;
    if (!msg || !msg.text) {
      res.status(200).json({ ok: true });
      return;
    }
    const dados = await buscarDadosAtuais();
    const resposta = await perguntarClaude(msg.text, dados);
    await responderTelegram(msg.chat.id, resposta);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: true, error: String(err) });
  }
}
