// Lembrete dos compromissos da Agenda no Telegram.
// Roda a cada 30 minutos pelo GitHub Actions (.github/workflows/lembrete-agenda.yml). Pergunta ao banco quais compromissos
// já entraram na hora de avisar (conforme o "Avisar no Telegram" de cada um), manda UMA mensagem e marca como avisados.
// Segredos (os mesmos do lembrete de impostos): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, LEMBRETE_CHAVE.
import { readFileSync } from "node:fs";

const env = process.env;
const faltando = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "LEMBRETE_CHAVE"].filter((k) => !env[k]);
if (faltando.length) {
  console.error("Faltam os segredos do GitHub: " + faltando.join(", ") + ". Veja servicos/LEIA-ME.md (Lembrete no Telegram).");
  process.exit(1);
}
const cfg = (() => { try { return readFileSync(new URL("../servicos/config.js", import.meta.url), "utf8"); } catch { return ""; } })();
const pega = (nome) => (cfg.match(new RegExp(nome + '\\s*:\\s*"([^"]+)"')) || [])[1];
const URL_SB = (env.SUPABASE_URL || pega("SUPABASE_URL") || "").replace(/\/$/, "");
const KEY_SB = env.SUPABASE_ANON_KEY || pega("SUPABASE_ANON_KEY");
const API_TG = (env.TELEGRAM_API || "https://api.telegram.org").replace(/\/$/, "");
if (!URL_SB || !KEY_SB) { console.error("Não achei a URL e a chave pública do Supabase em servicos/config.js."); process.exit(1); }

const ICONE = { visita: "🏠", reuniao: "🤝", servico: "🔧", prazo: "⏰", lembrete: "🔔", outro: "📌" };
const data = (iso) => iso.split("-").reverse().join("/");
const quando = (min) => {
  const m = Number(min);
  if (m <= -60) return `começou há ${Math.round(-m / 60)} h`;
  if (m < -1) return `começou há ${-m} min`;
  if (m <= 1) return "é agora";
  if (m < 60) return `começa em ${m} min`;
  if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return `começa em ${h} h${r ? " " + r + " min" : ""}`; }
  return `é em ${Math.round(m / 1440)} dia(s)`;
};

async function rpc(nome, corpo) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${nome}`, {
    method: "POST", headers: { apikey: KEY_SB, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

export function montarMensagem(itens) {
  const linhas = itens.map((i) => {
    const hora = i.hora ? ` às ${i.hora}` : " (dia todo)";
    return `${ICONE[i.tipo] || "📌"} ${i.titulo}\n  ${data(i.data)}${hora} — ${quando(i.minutos)}` + (i.onde ? `\n  📍 ${i.onde}` : "") + (i.obs ? `\n  ${String(i.obs).slice(0, 200)}` : "");
  });
  return `📅 AGE — compromisso${itens.length > 1 ? "s" : ""}\n\n${linhas.join("\n\n")}`;
}

async function principal() {
  const itens = await rpc("lembretes_agenda", { p_chave: env.LEMBRETE_CHAVE });
  if (!itens.length) { console.log("Nenhum compromisso para avisar agora."); return; }
  const resp = await fetch(`${API_TG}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: montarMensagem(itens), disable_web_page_preview: true }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok || !corpo.ok) {
    console.error("O Telegram recusou a mensagem: " + (corpo.description || resp.status) + ". Confira o token do bot e o chat id (e se você já mandou /start para o bot).");
    process.exit(1);   // não marca como avisado: tenta de novo na próxima rodada
  }
  await rpc("lembrete_agenda_marcar", { p_chave: env.LEMBRETE_CHAVE, p_ids: itens.map((i) => i.id) });
  console.log(`Aviso enviado: ${itens.length} compromisso(s).`);
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) principal().catch((e) => { console.error("Não consegui avisar: " + e.message); process.exit(1); });
