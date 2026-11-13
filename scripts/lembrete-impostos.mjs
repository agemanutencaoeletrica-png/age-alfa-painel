// Lembrete de impostos e dívidas no Telegram.
// Roda todo dia pelo GitHub Actions (.github/workflows/lembrete-impostos.yml). Pergunta ao banco (Supabase) quais parcelas
// vencem nos próximos dias (por padrão, em até 2 dias), manda UMA mensagem no Telegram e marca essas parcelas como avisadas.
// Segredos (GitHub > Settings > Secrets and variables > Actions): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, LEMBRETE_CHAVE.
// A URL e a chave pública do Supabase vêm de servicos/config.js (não são segredo).
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

const reais = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = (iso) => iso.split("-").reverse().join("/");
const quando = (dias) => (dias < 0 ? `ATRASADA há ${-dias} dia${dias === -1 ? "" : "s"}` : dias === 0 ? "vence HOJE" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`);

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
    const parc = i.total ? `parcela ${i.numero} de ${i.total}` : `parcela ${i.numero}`;
    return `• ${i.nome}${i.orgao ? " (" + i.orgao + ")" : ""}\n  ${parc} — ${reais(i.valor)} — ${data(i.vencimento)} (${quando(i.dias)})`;
  });
  return `🔔 AGE — impostos a pagar\n\n${linhas.join("\n\n")}\n\nDepois de pagar, marque como paga na aba Impostos e dívidas do painel.`;
}

async function principal() {
  const itens = await rpc("lembretes_impostos", { p_chave: env.LEMBRETE_CHAVE });
  if (!itens.length) { console.log("Nada vence nos próximos dias: nenhuma mensagem enviada."); return; }

  const resp = await fetch(`${API_TG}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: montarMensagem(itens), disable_web_page_preview: true }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok || !corpo.ok) {
    console.error("O Telegram recusou a mensagem: " + (corpo.description || resp.status) + ". Confira o token do bot e o chat id (e se você já mandou /start para o bot).");
    process.exit(1);   // não marca como avisada: tenta de novo amanhã
  }
  await rpc("lembrete_marcar", { p_chave: env.LEMBRETE_CHAVE, p_ids: itens.map((i) => i.id) });
  console.log(`Aviso enviado: ${itens.length} parcela(s).`);
}
principal().catch((e) => { console.error("Não consegui avisar: " + e.message); process.exit(1); });
