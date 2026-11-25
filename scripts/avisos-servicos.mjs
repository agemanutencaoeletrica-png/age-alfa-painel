// Avisos dos SERVIÇOS no Telegram.
//   node scripts/avisos-servicos.mjs resumo   → todo dia às 7h (Brasília): serviços e compromissos do dia, por funcionário, e os atrasados
//   node scripts/avisos-servicos.mjs vespera  → a cada 30 min: serviços de amanhã (a partir das 18h) e os de hoje ainda não avisados (a partir das 8h)
// Cada serviço é avisado uma vez por data prevista (se você mudar a data, avisa de novo). Não manda nada quando não há o que avisar.
// Segredos (os mesmos do lembrete de impostos): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, LEMBRETE_CHAVE.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ICONE = { eletrica: "⚡", pintura: "🎨" };
const ICONE_AG = { visita: "🏠", reuniao: "🤝", servico: "🔧", prazo: "⏰", lembrete: "🔔", outro: "📌" };
const corta = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const dataCurta = (iso) => { const [a, m, d] = String(iso).split("-").map(Number); const dt = new Date(Date.UTC(a, m - 1, d)); return `${SEM[dt.getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`; };
const ddmm = (iso) => String(iso).split("-").reverse().slice(0, 2).join("/");

function linhaServico(s) {
  const estado = s.status === "em_andamento" ? " (em andamento)" : s.status === "aguardando" ? " (aguardando)" : "";
  return `  ${ICONE[s.categoria] || "🔧"} ${s.cliente || "Serviço"}${s.descricao ? " — " + corta(s.descricao, 120) : ""}${estado}` + (s.endereco ? `\n     📍 ${corta(s.endereco, 100)}` : "");
}
function porFuncionario(lista) {
  const g = new Map();
  for (const s of lista) { const k = s.funcionario || "Sem responsável definido"; if (!g.has(k)) g.set(k, []); g.get(k).push(s); }
  return [...g.entries()].map(([nome, itens]) => `👷 ${nome}\n${itens.map(linhaServico).join("\n")}`);
}
// o Telegram aceita até 4096 caracteres por mensagem: divide nos blocos, sem cortar um bloco no meio
export function dividir(blocos, max = 3800) {
  const msgs = []; let atual = "";
  for (const b of blocos) {
    if (atual && (atual + "\n\n" + b).length > max) { msgs.push(atual); atual = b; }
    else atual = atual ? atual + "\n\n" + b : b;
  }
  if (atual) msgs.push(atual);
  return msgs;
}

export function montarResumo(d) {
  const sv = d.servicos || [], co = d.compromissos || [], at = d.atrasados || [];
  if (!sv.length && !co.length && !at.length) return [];
  const blocos = [`🗓 AGE — resumo de hoje (${dataCurta(d.hoje)})\n${sv.length} serviço(s) · ${co.length} compromisso(s)`];
  if (sv.length) blocos.push(...porFuncionario(sv));
  if (co.length) blocos.push("📅 Compromissos\n" + co.map((c) => `  ${ICONE_AG[c.tipo] || "📌"} ${c.hora ? c.hora + " " : ""}${corta(c.titulo, 100)}${c.onde ? " — 📍 " + corta(c.onde, 80) : ""}${c.responsavel ? " (" + c.responsavel + ")" : ""}`).join("\n"));
  if (at.length) blocos.push(`⚠ Atrasados (${at.length}): data prevista já passou e ainda estão abertos\n` + at.slice(0, 15).map((s) => `  • ${s.cliente || "Serviço"}${s.descricao ? " — " + corta(s.descricao, 80) : ""} (${ddmm(s.data)})${s.funcionario ? " · " + s.funcionario : ""}`).join("\n") + (at.length > 15 ? `\n  … e mais ${at.length - 15}` : ""));
  return dividir(blocos);
}
export function montarVespera(lista) {
  if (!lista.length) return [];
  const amanha = lista.filter((s) => s.dia !== "hoje"), hoje = lista.filter((s) => s.dia === "hoje"), blocos = [];
  if (amanha.length) { blocos.push(`🔧 AGE — serviços de amanhã (${dataCurta(amanha[0].data)}): ${amanha.length}`); blocos.push(...porFuncionario(amanha)); }
  if (hoje.length) { blocos.push(`🔧 AGE — serviços marcados para HOJE depois do resumo (${hoje.length})`); blocos.push(...porFuncionario(hoje)); }
  return dividir(blocos);
}

async function principal(modo) {
  const env = process.env;
  const faltando = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "LEMBRETE_CHAVE"].filter((k) => !env[k]);
  if (faltando.length) { console.error("Faltam os segredos do GitHub: " + faltando.join(", ") + ". Veja servicos/LEIA-ME.md (Lembrete no Telegram)."); process.exit(1); }
  const cfg = (() => { try { return readFileSync(new URL("../servicos/config.js", import.meta.url), "utf8"); } catch { return ""; } })();
  const pega = (nome) => (cfg.match(new RegExp(nome + '\\s*:\\s*"([^"]+)"')) || [])[1];
  const URL_SB = (env.SUPABASE_URL || pega("SUPABASE_URL") || "").replace(/\/$/, ""), KEY_SB = env.SUPABASE_ANON_KEY || pega("SUPABASE_ANON_KEY"), API_TG = (env.TELEGRAM_API || "https://api.telegram.org").replace(/\/$/, "");
  if (!URL_SB || !KEY_SB) { console.error("Não achei a URL e a chave pública do Supabase em servicos/config.js."); process.exit(1); }
  async function rpc(nome, corpo) {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/${nome}`, { method: "POST", headers: { apikey: KEY_SB, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${nome}: ${r.status} ${txt.slice(0, 200)}`);
    return txt ? JSON.parse(txt) : null;
  }
  let msgs, ids;
  if (modo === "resumo") { const d = await rpc("resumo_diario", { p_chave: env.LEMBRETE_CHAVE }); msgs = montarResumo(d); ids = (d.servicos || []).map((s) => s.id); }
  else if (modo === "vespera") { const l = await rpc("lembretes_servicos", { p_chave: env.LEMBRETE_CHAVE }); msgs = montarVespera(l); ids = l.map((s) => s.id); }
  else { console.error('Use: node scripts/avisos-servicos.mjs resumo   ou   vespera'); process.exit(1); }
  if (!msgs.length) { console.log("Nada para avisar agora: nenhuma mensagem enviada."); return; }
  for (const texto of msgs) {
    const resp = await fetch(`${API_TG}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: texto, disable_web_page_preview: true }) });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok || !corpo.ok) { console.error("O Telegram recusou a mensagem: " + (corpo.description || resp.status) + ". Confira o token do bot e o chat id (e se você já tocou em Iniciar no bot)."); process.exit(1); }   // não marca: tenta de novo na próxima rodada
  }
  if (ids.length) await rpc("servicos_avisados", { p_chave: env.LEMBRETE_CHAVE, p_ids: ids });
  console.log(`Aviso enviado (${modo}): ${msgs.length} mensagem(ns), ${ids.length} serviço(s) marcado(s).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal(process.argv[2]).catch((e) => { console.error("Não consegui avisar: " + e.message); process.exit(1); });
