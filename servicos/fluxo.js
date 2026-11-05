// Painel do dono — 📈 FLUXO DE CAIXA PROJETADO
// Entradas previstas (notas emitidas ainda não recebidas) menos saídas previstas (compras a pagar, DAS estimado e o que você lançar),
// a partir do saldo do banco que você informar. Mostra semana a semana e avisa se o saldo vai ficar negativo.
// Lançamentos manuais (contas fixas, aluguel, parcelamento, entradas combinadas) ficam na tabela fluxo_previsto.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, CHAVE = "age_fluxo_v1", dados = null, semTabela = false, carregando = false;
  var REC = { "": "Não repete", semanal: "Toda semana", quinzenal: "A cada 15 dias", mensal: "Todo mês" };

  function cfg() {
    var o = {}; try { o = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { o = {}; }
    var pz = o.prazo === undefined || o.prazo === null || o.prazo === "" ? 30 : Number(o.prazo);
    return { prazo: Math.max(0, Math.min(180, isFinite(pz) ? pz : 30)), dias: [30, 60, 90].indexOf(Number(o.dias)) >= 0 ? Number(o.dias) : 60, das: o.das !== false };
  }
  function salvarCfg(c) { try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch (e) { /* sem armazenamento */ } }
  function iso(d) { return A.isoLocal(d); }
  function dia(s) { return new Date(s + "T12:00:00"); }
  function soma(s, n) { var d = dia(s); d.setDate(d.getDate() + n); return iso(d); }
  function mais(s, m) { var d = dia(s), alvo = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + m); var ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(alvo, ult)); return iso(d); }
  function seg(s) { var d = dia(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function din(v) { return A.dinheiro(r2(v)); }

  function carregar(depois) {
    if (carregando) return; carregando = true;
    Promise.resolve(P.sb.from("fluxo_previsto").select("*").order("data").limit(2000)).then(function (r) {
      if (r.error) throw r.error; dados = r.data || []; semTabela = false;
    }).catch(function (e) {
      var m = String((e && (e.message || e.code)) || e); if (/does not exist|schema cache|PGRST205|42P01/i.test(m)) { semTabela = true; dados = []; } else { semTabela = false; dados = []; A.avisar(A.msgErro ? A.msgErro(e) : m, "erro"); }
    }).then(function () { carregando = false; depois(); });
  }

  // ---------- monta os eventos futuros ----------
  function eventos(c, hoje, fim) {
    var ev = [];
    var add = function (data, desc, valor, tipo, origem, extra) { ev.push(Object.assign({ data: data, desc: desc, valor: r2(valor), tipo: tipo, origem: origem, atrasada: false }, extra || {})); };
    // notas emitidas e ainda não recebidas
    (P.S.receitas || []).forEach(function (n) {
      if (n.recebido || n.avulso) return;
      var v = Number(n.valor) || 0; if (!(v > 0)) return;
      var prev = soma(String(n.emitida_em).slice(0, 10), c.prazo), atr = prev < hoje;
      add(atr ? hoje : prev, "Nota " + (n.numero_nota || "s/ nº") + " · " + (n.cliente || "cliente") + (atr ? " (atrasada)" : ""), v, "entrada", "nota", { atrasada: atr, previsto: prev });
    });
    // compras/despesas ainda não pagas
    (P.S.compras || []).forEach(function (x) {
      if (x.pago !== false) return;
      var v = Number(x.valor) || 0; if (!(v > 0)) return;
      var prev = x.vencimento ? String(x.vencimento).slice(0, 10) : hoje, atr = prev < hoje;
      add(atr ? hoje : prev, "Compra a pagar · " + (x.fornecedor || x.descricao || "sem nome") + (atr ? " (vencida)" : ""), v, "saida", "compra", { atrasada: atr, previsto: prev });
    });
    // DAS estimado das notas de cada mês (vence dia 20 do mês seguinte)
    if (c.das && window.AGE_FAT && window.AGE_FAT.dasDaNota) {
      var meses = {};
      (P.S.receitas || []).forEach(function (n) { if (n.avulso) return; var m = String(n.emitida_em).slice(0, 7); meses[m] = (meses[m] || 0) + (window.AGE_FAT.dasDaNota(n) || 0); });
      Object.keys(meses).forEach(function (m) {
        var venc = mais(m + "-20", 1); if (venc < hoje || venc > fim || !(meses[m] > 0)) return;
        add(venc, "DAS estimado das notas de " + m.slice(5) + "/" + m.slice(0, 4) + " (estimativa)", meses[m], "saida", "das");
      });
    }
    // lançamentos manuais
    (dados || []).forEach(function (x) {
      if (x.tipo !== "entrada" && x.tipo !== "saida") return;
      var v = Number(x.valor) || 0; if (!(v > 0)) return;
      if (x.recorrencia) {
        var passo = x.recorrencia === "semanal" ? 7 : x.recorrencia === "quinzenal" ? 15 : 0, d = String(x.data).slice(0, 10), n = 0, lim = x.ate ? String(x.ate).slice(0, 10) : fim;
        while (d <= fim && d <= lim && n < 400) {
          if (d >= hoje) add(d, x.descricao || (x.tipo === "entrada" ? "Entrada prevista" : "Saída prevista"), v, x.tipo, "manual", { id: x.id, rec: x.recorrencia });
          n++; d = passo ? soma(d, passo) : mais(String(x.data).slice(0, 10), n);
        }
      } else if (!x.baixado) {
        var prev = String(x.data).slice(0, 10), atr = prev < hoje;
        if (prev <= fim) add(atr ? hoje : prev, (x.descricao || (x.tipo === "entrada" ? "Entrada prevista" : "Saída prevista")) + (atr ? " (atrasado)" : ""), v, x.tipo, "manual", { id: x.id, atrasada: atr, previsto: prev });
      }
    });
    return ev.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : (a.tipo === "entrada" ? -1 : 1); });
  }

  function saldoAtual() {
    var s = (dados || []).filter(function (x) { return x.tipo === "saldo"; }).sort(function (a, b) { return String(a.data) < String(b.data) ? 1 : -1; })[0];
    return s ? { valor: Number(s.valor) || 0, data: String(s.data).slice(0, 10), id: s.id } : null;
  }

  function ver(c, ctx) {
    P = ctx;
    if (dados === null) { c.innerHTML = '<div class="cartao vazio">Carregando o fluxo de caixa...</div>'; carregar(function () { ver(c, P); }); return; }
    var cf = cfg(), hoje = iso(new Date()), fim = soma(hoje, cf.dias), sd = saldoAtual(), ev = eventos(cf, hoje, fim);
    var saldo0 = sd ? sd.valor : 0, acum = saldo0, menor = { v: saldo0, d: hoje }, negativo = null, ent = 0, sai = 0, semanas = {}, ordem = [];
    ev.forEach(function (e) {
      acum = r2(acum + (e.tipo === "entrada" ? e.valor : -e.valor)); e.saldo = acum;
      if (e.tipo === "entrada") ent += e.valor; else sai += e.valor;
      if (acum < menor.v) menor = { v: acum, d: e.data };
      if (acum < 0 && !negativo) negativo = e.data;
      var k = seg(e.data); if (!semanas[k]) { semanas[k] = { e: 0, s: 0, fim: acum }; ordem.push(k); }
      if (e.tipo === "entrada") semanas[k].e += e.valor; else semanas[k].s += e.valor; semanas[k].fim = acum;
    });
    var tile = function (rot, v, cor, sub) { return '<div class="ladrilho" style="border-left:4px solid var(--' + cor + ')"><div class="r">' + rot + '</div><div class="v" style="font-size:1.25em;font-weight:700">' + v + "</div>" + (sub ? '<div class="peq mudo">' + sub + "</div>" : "") + "</div>"; };
    var velho = sd && sd.data < hoje;
    c.innerHTML = '<p class="peq mudo">Entradas previstas menos saídas previstas, a partir do <b>saldo do banco</b> que você informar. Notas ainda não recebidas entram ' + cf.prazo + ' dia(s) depois da emissão; compras a pagar, no vencimento.</p>' +
      (semTabela ? '<div class="aviso">Para guardar saldo e lançamentos, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>fluxo_previsto</b>). Enquanto isso o fluxo mostra só notas e compras.</div>' : "") +
      '<div class="acoes" style="margin-top:0"><button class="prim" id="fx-saldo">🏦 Saldo do banco</button><button id="fx-ent">➕ Entrada prevista</button><button id="fx-sai">➖ Saída prevista</button><button id="fx-cfg">⚙ Ajustes</button></div>' +
      (!sd ? '<div class="aviso">Informe o <b>saldo do banco</b> de hoje (botão 🏦) para o saldo projetado fazer sentido. Sem ele, a conta começa em R$ 0,00.</div>' : velho ? '<div class="aviso">O saldo informado é de ' + esc(A.data(dia(sd.data))) + ': atualize em 🏦 para o fluxo ficar certo.</div>' : "") +
      (negativo ? '<div class="aviso erro">⚠️ O saldo fica <b>negativo</b> a partir de <b>' + esc(A.data(dia(negativo))) + "</b> (menor saldo: " + din(menor.v) + " em " + esc(A.data(dia(menor.d))) + "). Veja o que dá para antecipar ou adiar.</div>" : ev.length ? '<div class="aviso ok">✔ O saldo não fica negativo nos próximos ' + cf.dias + " dias (menor saldo: " + din(menor.v) + " em " + esc(A.data(dia(menor.d))) + ").</div>" : "") +
      '<div class="grade">' + tile("🏦 Saldo hoje", din(saldo0), "prim", sd ? "informado em " + esc(A.data(dia(sd.data))) : "") + tile("➕ Entradas previstas", din(ent), "bom", cf.dias + " dias") + tile("➖ Saídas previstas", din(sai), "critico", cf.dias + " dias") + tile("📈 Saldo no fim", din(acum), acum < 0 ? "critico" : "bom", "em " + esc(A.data(dia(fim)))) + "</div>" +
      (ordem.length ? '<h3 style="margin:14px 0 4px">Semana a semana</h3><div class="tabela-caixa"><table><thead><tr><th>Semana</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Saldo no fim</th></tr></thead><tbody>' +
        ordem.map(function (k) { var w = semanas[k]; return "<tr><td>" + esc(A.data(dia(k)).slice(0, 5)) + " a " + esc(A.data(dia(soma(k, 6))).slice(0, 5)) + '</td><td class="num">' + din(w.e) + '</td><td class="num">' + din(w.s) + '</td><td class="num"><b style="color:var(--' + (w.fim < 0 ? "critico" : "bom") + ')">' + din(w.fim) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
        '<h3 style="margin:14px 0 4px">Lançamento a lançamento</h3><div class="tabela-caixa"><table><thead><tr><th>Data</th><th>O quê</th><th class="num">Valor</th><th class="num">Saldo</th><th></th></tr></thead><tbody>' +
        ev.map(function (e) {
          return "<tr><td>" + esc(A.data(dia(e.data)).slice(0, 5)) + "</td><td>" + esc(e.desc) + (e.rec ? ' <span class="selo">' + esc(REC[e.rec]) + "</span>" : "") + (e.origem === "manual" ? "" : ' <span class="selo">automático</span>') + '</td><td class="num" style="color:var(--' + (e.tipo === "entrada" ? "bom" : "critico") + ')">' +
            (e.tipo === "entrada" ? "+ " : "− ") + din(e.valor) + '</td><td class="num"><b style="color:var(--' + (e.saldo < 0 ? "critico" : "bom") + ')">' + din(e.saldo) + "</b></td><td>" + (e.id ? '<button class="peq" data-fx-ed="' + e.id + '">Editar</button>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="cartao vazio">Nada previsto para os próximos ' + cf.dias + " dias. Lance entradas e saídas ou emita notas.</div>") +
      '<p class="peq mudo" style="margin-top:10px">É uma <b>projeção</b>: o DAS é estimativa, e notas atrasadas contam como recebidas hoje. Não inclui o pagamento da equipe pelo ponto nem o honorário do contador: lance como saída (pode repetir toda semana ou todo mês).</p>';
    $("#fx-saldo", c).onclick = function () { formSaldo(c); };
    $("#fx-ent", c).onclick = function () { formItem(c, "entrada", null); };
    $("#fx-sai", c).onclick = function () { formItem(c, "saida", null); };
    $("#fx-cfg", c).onclick = function () { ajustes(c); };
    $$("[data-fx-ed]", c).forEach(function (b) { b.onclick = function () { formItem(c, null, (dados || []).filter(function (x) { return x.id === b.dataset.fxEd; })[0]); }; });
  }

  function salvar(op, c, j) {
    return Promise.resolve(op).then(function (r) { if (r && r.error) throw r.error; dados = null; if (j) j.fechar(); ver(c, P); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
  }
  function formSaldo(c) {
    var sd = saldoAtual(), j = A.janela('<label for="fs-v">Saldo da conta hoje (R$)</label><input id="fs-v" inputmode="decimal" placeholder="0,00"><label for="fs-d">Data do saldo</label><input type="date" id="fs-d">' +
      '<p class="mudo peq">Use o saldo do app do banco. Atualize de vez em quando para o fluxo continuar certo.</p><div class="acoes"><button class="prim" id="fs-ok">Salvar</button></div>', { titulo: "🏦 Saldo do banco", semRascunho: true }), el = j.el;
    $("#fs-v", el).value = sd ? Number(sd.valor).toFixed(2).replace(".", ",") : ""; $("#fs-d", el).value = iso(new Date());
    $("#fs-ok", el).onclick = function () {
      var v = A.lerNumero($("#fs-v", el).value); if (v === null || isNaN(v)) { A.avisar("Informe o saldo.", "erro"); return; }
      if (v < 0 && !A.confirmar("O saldo está negativo (" + din(v) + "). Confirma?")) return;
      salvar(P.sb.from("fluxo_previsto").insert({ tipo: "saldo", data: $("#fs-d", el).value, valor: r2(v) }), c, j);
    };
  }
  function formItem(c, tipo, x) {
    tipo = tipo || x.tipo;
    var j = A.janela('<label for="fi-d">Descrição</label><input id="fi-d" maxlength="200" placeholder="' + (tipo === "entrada" ? "Ex.: Pagamento combinado do cliente X" : "Ex.: Aluguel, parcelamento, contador") + '">' +
      '<div class="duas"><div><label for="fi-v">Valor (R$)</label><input id="fi-v" inputmode="decimal"></div><div><label for="fi-dt">Data</label><input type="date" id="fi-dt"></div></div>' +
      '<div class="duas"><div><label for="fi-rec">Repete</label><select id="fi-rec">' + Object.keys(REC).map(function (k) { return '<option value="' + k + '">' + REC[k] + "</option>"; }).join("") + '</select></div><div><label for="fi-ate">Repete até (opcional)</label><input type="date" id="fi-ate"></div></div>' +
      '<div class="acoes"><button class="prim" id="fi-ok">Salvar</button>' + (x ? '<button id="fi-baixa">✔ Já foi feito</button><button class="perigo" id="fi-del">Apagar</button>' : "") + "</div>", { titulo: (tipo === "entrada" ? "➕ Entrada" : "➖ Saída") + " prevista", semRascunho: true }), el = j.el;
    $("#fi-d", el).value = x ? x.descricao || "" : ""; $("#fi-v", el).value = x ? Number(x.valor).toFixed(2).replace(".", ",") : ""; $("#fi-dt", el).value = x ? String(x.data).slice(0, 10) : iso(new Date());
    $("#fi-rec", el).value = x && x.recorrencia ? x.recorrencia : ""; $("#fi-ate", el).value = x && x.ate ? String(x.ate).slice(0, 10) : "";
    $("#fi-ok", el).onclick = function () {
      var v = A.lerNumero($("#fi-v", el).value), dt = $("#fi-dt", el).value;
      if (!(v > 0)) { A.avisar("Informe o valor.", "erro"); return; } if (!dt) { A.avisar("Informe a data.", "erro"); return; }
      var d = { tipo: tipo, descricao: $("#fi-d", el).value.trim() || null, valor: r2(v), data: dt, recorrencia: $("#fi-rec", el).value || null, ate: $("#fi-ate", el).value || null, baixado: false };
      salvar(x ? P.sb.from("fluxo_previsto").update(d).eq("id", x.id) : P.sb.from("fluxo_previsto").insert(d), c, j);
    };
    if (x) {
      $("#fi-baixa", el).onclick = function () {
        if (x.recorrencia) { A.avisar("Item que se repete: apague ou ajuste a data/o fim da repetição.", "erro"); return; }
        salvar(P.sb.from("fluxo_previsto").update({ baixado: true }).eq("id", x.id), c, j);
      };
      $("#fi-del", el).onclick = function () { if (!A.confirmar("Apagar este lançamento previsto?")) return; salvar(P.sb.from("fluxo_previsto").delete().eq("id", x.id), c, j); };
    }
  }
  function ajustes(c) {
    var cf = cfg(), j = A.janela('<label for="fa-p">Prazo médio para os clientes pagarem (dias depois da nota)</label><input id="fa-p" inputmode="numeric">' +
      '<label for="fa-h">Olhar para frente</label><select id="fa-h"><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select>' +
      '<label class="marca-linha"><input type="checkbox" id="fa-das"> Incluir o DAS estimado (vence dia 20 do mês seguinte)</label>' +
      '<p class="mudo peq">O prazo vale para todas as notas ainda não recebidas. Se um cliente costuma atrasar, aumente o prazo.</p><div class="acoes"><button class="prim" id="fa-ok">Salvar</button></div>', { titulo: "⚙ Ajustes do fluxo", semRascunho: true }), el = j.el;
    $("#fa-p", el).value = cf.prazo; $("#fa-h", el).value = String(cf.dias); $("#fa-das", el).checked = cf.das;
    $("#fa-ok", el).onclick = function () { salvarCfg({ prazo: Math.max(0, Math.min(180, parseInt($("#fa-p", el).value, 10) || 0)), dias: Number($("#fa-h", el).value), das: $("#fa-das", el).checked }); j.fechar(); ver(c, P); };
  }

  window.AGE_FLUXO = { ver: ver, recarregar: function () { dados = null; } };
})();
