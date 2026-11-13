// Painel do dono — 🤝 PARCEIROS › 💼 SERVIÇOS FECHADOS com cada parceiro: o que foi combinado, o valor, a entrada, o adiantamento
// e o restante, cada um com data e horário, e o que já foi pago. Tabelas parceiro_servicos e parceiro_pagamentos (supabase.sql).
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, fila = Promise.resolve();
  var TIPOS = { entrada: "Entrada", adiantamento: "Adiantamento", restante: "Restante", parcela: "Parcela" };
  var STATUS = { aberto: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };

  function hoje() { return A.isoLocal(new Date()); }
  function num(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function campo(v) { return v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2).replace(".", ","); }
  function lerValor(t) { var s = String(t || "").trim(); return s ? A.lerNumero(s) : null; }
  function dinheiro(v) { return A.dinheiro(num(v)); }
  function hh(t) { return t ? String(t).slice(0, 5) : ""; }
  function servicosDe(pid) { return ((P && P.S.parcServ) || []).filter(function (s) { return s.parceiro_id === pid; }).sort(function (a, b) { return (b.fechado_em || "") < (a.fechado_em || "") ? -1 : 1; }); }
  function pagsDe(sid) {
    return ((P && P.S.parcPag) || []).filter(function (x) { return x.servico_id === sid; })
      .sort(function (a, b) { return ((a.data || "9999") + (a.hora || "")) < ((b.data || "9999") + (b.hora || "")) ? -1 : 1; });
  }
  function contas(s) {
    var ps = pagsDe(s.id), pago = 0, lancado = 0;
    ps.forEach(function (x) { lancado += Number(x.valor); if (x.pago_em) pago += Number(x.valor); });
    return { ps: ps, pago: num(pago), falta: num(Math.max(0, Number(s.valor_total) - pago)), semLancar: num(Number(s.valor_total) - lancado) };
  }
  // resumo para o cartão do parceiro
  function resumo(pid) {
    var ss = servicosDe(pid).filter(function (s) { return s.status !== "cancelado"; });
    if (!ss.length) return null;
    var tot = 0, pago = 0, falta = 0;
    ss.forEach(function (s) { var c = contas(s); tot += Number(s.valor_total); pago += c.pago; falta += c.falta; });
    return { n: ss.length, total: num(tot), pago: num(pago), falta: num(falta) };
  }
  function enfileirar(fn) { var r = fila.then(fn); fila = r.catch(function () { /* o erro vai para quem chamou */ }); return r; }

  // ---------------- janela do parceiro ----------------
  function abrir(parc, depois) {
    if (P.S.semParcServ) { A.avisar("Para usar, rode o impostos.sql / supabase.sql atualizado no Supabase (tabelas parceiro_servicos e parceiro_pagamentos).", "erro"); return; }
    var j = A.janela('<div id="ps-corpo"></div>', { titulo: "💼 Serviços fechados — " + (P.nomeProprio ? P.nomeProprio(parc.nome, true) : parc.nome), semRascunho: true, larga: true, aoFechar: function () { if (depois) depois(); } }), el = j.el;
    function desenhar() {
      var ss = servicosDe(parc.id), r = resumo(parc.id);
      $("#ps-corpo", el).innerHTML = '<div class="acoes" style="margin-bottom:8px"><button class="prim" id="ps-novo">+ Serviço fechado</button></div>' +
        (r ? '<div class="cartao"><b>' + r.n + " serviço(s)</b> · combinado <b>" + dinheiro(r.total) + "</b> · pago <b>" + dinheiro(r.pago) + "</b> · falta pagar <b>" + dinheiro(r.falta) + "</b></div>" : "") +
        (ss.length ? ss.map(cartao).join("") : '<div class="cartao mudo">Nenhum serviço fechado com este parceiro. Toque em “+ Serviço fechado”.</div>') +
        '<div class="acoes"><button id="ps-fechar">Fechar</button></div>';
      $("#ps-novo", el).onclick = function () { editar(null); };
      $("#ps-fechar", el).onclick = function () { j.fechar(); };
      $$("[data-s-ed]", el).forEach(function (b) { b.onclick = function () { editar(P.porId(P.S.parcServ, b.dataset.sEd)); }; });
      $$("[data-s-ap]", el).forEach(function (b) { b.onclick = function () { apagar(P.porId(P.S.parcServ, b.dataset.sAp)); }; });
      $$("[data-s-mais]", el).forEach(function (b) { b.onclick = function () { maisPagamento(b.dataset.sMais); }; });
      $$("tr[data-pg]", el).forEach(ligarLinha);
    }
    function cartao(s) {
      var c = contas(s), dd = s.status === "aberto";
      return '<div class="cartao"' + (s.status === "cancelado" ? ' style="opacity:.6"' : "") + '><div style="float:right"><button class="peq" data-s-ed="' + esc(s.id) + '">✏️ Editar</button> <button class="peq" data-s-ap="' + esc(s.id) + '" title="Apagar este serviço e os pagamentos dele">🗑</button></div>' +
        "<div><b>" + esc(s.descricao) + '</b> <span class="selo' + (dd ? "" : s.status === "concluido" ? " bom" : " atencao") + '">' + esc(STATUS[s.status] || s.status) + "</span></div>" +
        '<div class="peq mudo">' + (s.fechado_em ? "Fechado em " + esc(A.dataSimples(s.fechado_em)) : "") + "</div>" +
        '<div style="margin-top:6px"><b>Combinado: ' + dinheiro(s.valor_total) + "</b> · pago <b>" + dinheiro(c.pago) + "</b> · falta pagar <b>" + dinheiro(c.falta) + "</b></div>" +
        (Math.abs(c.semLancar) >= 0.01 ? '<div class="peq" style="color:var(--atencao)">⚠ ' + (c.semLancar > 0 ? "Ainda sem data/lançamento: " + dinheiro(c.semLancar) + ". Toque em “+ Pagamento”." : "Os pagamentos lançados passam do combinado em " + dinheiro(-c.semLancar) + ".") + "</div>" : "") +
        (s.obs ? '<div class="obs-destaque">📌 ' + esc(s.obs) + "</div>" : "") +
        '<div class="tabela-caixa"><table style="width:100%;margin-top:6px"><thead><tr><th>Tipo</th><th>Valor</th><th>Data</th><th>Horário</th><th>Pago</th><th></th></tr></thead><tbody>' + c.ps.map(linha).join("") + "</tbody></table></div>" +
        '<div style="margin-top:6px"><button class="peq" data-s-mais="' + esc(s.id) + '">+ Pagamento</button> <span class="peq mudo">Mude data, horário ou valor direto na linha: salva sozinho.</span></div></div>';
    }
    function linha(x) {
      var atras = !x.pago_em && x.data && x.data < hoje();
      return '<tr data-pg="' + esc(x.id) + '"' + (atras ? ' style="background:var(--critico-f)"' : "") + '><td><select class="pg-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (x.tipo === k ? " selected" : "") + ">" + TIPOS[k] + "</option>"; }).join("") + "</select></td>" +
        '<td><input class="pg-val" inputmode="decimal" style="width:96px" value="' + campo(x.valor) + '"></td><td><input type="date" class="pg-data" value="' + esc(x.data || "") + '"></td><td><input type="time" class="pg-hora" value="' + esc(hh(x.hora)) + '"></td>' +
        '<td><label class="marca-linha" style="font-weight:400"><input type="checkbox" class="pg-pago"' + (x.pago_em ? " checked" : "") + "> " + (x.pago_em ? esc(A.dataSimples(x.pago_em)) : "") + '</label></td><td><button class="peq pg-del" title="Apagar este pagamento">✕</button></td></tr>';
    }
    function ligarLinha(tr) {
      var id = tr.dataset.pg;
      function salvar() {
        var val = lerValor($(".pg-val", tr).value);
        if (val === null || val < 0) { A.avisar("Confira o valor.", "erro"); return; }
        gravarPag(id, { tipo: $(".pg-tipo", tr).value, valor: val, data: $(".pg-data", tr).value || null, hora: $(".pg-hora", tr).value || null }).then(function () { A.avisar("✓ Salvo", "ok"); desenhar(); }).catch(P.falhou);
      }
      ["pg-tipo", "pg-val", "pg-data", "pg-hora"].forEach(function (c) { $("." + c, tr).onchange = salvar; });
      $(".pg-pago", tr).onchange = function () {
        var pago = this.checked; gravarPag(id, { pago_em: pago ? hoje() : null }).then(function () { A.avisar(pago ? "✅ Marcado como pago" : "Voltou para a pagar", "ok"); desenhar(); }).catch(P.falhou);
      };
      $(".pg-del", tr).onclick = function () {
        var x = P.porId(P.S.parcPag, id); if (!x || !A.confirmar("Apagar este pagamento (" + (TIPOS[x.tipo] || x.tipo) + ", " + dinheiro(x.valor) + ")?")) return;
        P.q(P.sb.from("parceiro_pagamentos").delete().eq("id", id)).then(function () { P.tirar(P.S.parcPag, id); desenhar(); }).catch(P.falhou);
      };
    }
    function gravarPag(id, d) {
      return enfileirar(function () { return P.q(P.sb.from("parceiro_pagamentos").update(d).eq("id", id).select().single()).then(function (n) { P.trocar(P.S.parcPag, n); return n; }); });
    }
    function maisPagamento(sid) {
      var s = P.porId(P.S.parcServ, sid), c = contas(s);
      P.q(P.sb.from("parceiro_pagamentos").insert({ servico_id: sid, tipo: c.ps.length ? "parcela" : "entrada", valor: Math.max(0, c.semLancar), data: hoje() }).select().single())
        .then(function (n) { P.S.parcPag.push(n); desenhar(); A.avisar("Pagamento acrescentado: ajuste tipo, valor, data e horário.", "ok"); }).catch(P.falhou);
    }
    function apagar(s) {
      if (!s) return; var n = pagsDe(s.id).length;
      if (!A.confirmar("Apagar o serviço “" + s.descricao + "” e os " + n + " pagamento(s) dele?\n\nIsso não tem volta. Se o serviço só terminou, prefira mudar para “Concluído” em ✏️ Editar.")) return;
      P.q(P.sb.from("parceiro_servicos").delete().eq("id", s.id)).then(function () {
        P.tirar(P.S.parcServ, s.id); P.S.parcPag = P.S.parcPag.filter(function (x) { return x.servico_id !== s.id; }); A.avisar("Serviço apagado", "ok"); desenhar();
      }).catch(P.falhou);
    }

    // ---- novo / editar serviço ----
    function editar(s) {
      var novo = !s;
      var jj = A.janela('<label for="sv-desc">Serviço fechado *</label><input id="sv-desc" maxlength="300" placeholder="Ex.: Projeto elétrico do galpão">' +
        '<div class="duas"><div><label for="sv-total">Valor combinado (R$) *</label><input id="sv-total" inputmode="decimal"></div><div><label for="sv-fecha">Fechado em</label><input type="date" id="sv-fecha"></div></div>' +
        (novo ? '<div class="cartao" style="margin-top:10px"><b>Entrada</b><div class="duas"><div><label for="sv-e-v">Valor (R$)</label><input id="sv-e-v" inputmode="decimal"></div><div><label for="sv-e-d">Data</label><input type="date" id="sv-e-d"></div></div><label for="sv-e-h">Horário</label><input type="time" id="sv-e-h"></div>' +
          '<div class="cartao"><b>Adiantamento</b><div class="duas"><div><label for="sv-a-v">Valor (R$)</label><input id="sv-a-v" inputmode="decimal"></div><div><label for="sv-a-d">Data</label><input type="date" id="sv-a-d"></div></div><label for="sv-a-h">Horário</label><input type="time" id="sv-a-h"></div>' +
          '<div class="cartao"><b>Restante: <span id="sv-r-v">R$ 0,00</span></b> <span class="peq mudo">(valor combinado − entrada − adiantamento)</span><div class="duas"><div><label for="sv-r-d">Data</label><input type="date" id="sv-r-d"></div><div><label for="sv-r-h">Horário</label><input type="time" id="sv-r-h"></div></div></div>'
          : '<label for="sv-st">Situação</label><select id="sv-st">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k] + "</option>"; }).join("") + "</select>") +
        '<label for="sv-obs">Observações</label><textarea id="sv-obs" rows="2" maxlength="3000"></textarea><p class="peq" id="sv-msg" style="color:var(--critico)"></p>' +
        '<div class="acoes"><button class="prim" id="sv-salvar">💾 Salvar</button><button id="sv-cancelar">Cancelar</button></div>', { titulo: novo ? "Novo serviço fechado" : "Editar serviço", semRascunho: true }), e2 = jj.el;
      if (P.ligarMaiuscula) { P.ligarMaiuscula($("#sv-desc", e2)); P.ligarMaiuscula($("#sv-obs", e2), true); }
      if (novo) $("#sv-fecha", e2).value = hoje();
      else { $("#sv-desc", e2).value = s.descricao; $("#sv-total", e2).value = campo(s.valor_total); $("#sv-fecha", e2).value = s.fechado_em || ""; $("#sv-st", e2).value = s.status; $("#sv-obs", e2).value = s.obs || ""; }
      function restante() { if (!novo) return 0; var r = num((lerValor($("#sv-total", e2).value) || 0) - (lerValor($("#sv-e-v", e2).value) || 0) - (lerValor($("#sv-a-v", e2).value) || 0)); $("#sv-r-v", e2).textContent = dinheiro(Math.max(0, r)); return r; }
      if (novo) ["#sv-total", "#sv-e-v", "#sv-a-v"].forEach(function (k) { $(k, e2).oninput = restante; });
      $("#sv-cancelar", e2).onclick = function () { jj.fechar(); };
      $("#sv-salvar", e2).onclick = function () {
        var msg = function (t) { $("#sv-msg", e2).textContent = t; }, desc = $("#sv-desc", e2).value.trim(), total = lerValor($("#sv-total", e2).value);
        if (!desc) return msg("Escreva o serviço fechado.");
        if (!(total >= 0) || total === null) return msg("Informe o valor combinado.");
        var dados = { parceiro_id: parc.id, descricao: desc, valor_total: total, fechado_em: $("#sv-fecha", e2).value || null, obs: $("#sv-obs", e2).value.trim() || null };
        var pags = [];
        if (novo) {
          var ev = lerValor($("#sv-e-v", e2).value) || 0, av = lerValor($("#sv-a-v", e2).value) || 0, rv = restante();
          if (rv < -0.004) return msg("Entrada + adiantamento passam do valor combinado.");
          if (ev > 0) pags.push({ tipo: "entrada", valor: ev, data: $("#sv-e-d", e2).value || null, hora: $("#sv-e-h", e2).value || null });
          if (av > 0) pags.push({ tipo: "adiantamento", valor: av, data: $("#sv-a-d", e2).value || null, hora: $("#sv-a-h", e2).value || null });
          if (rv > 0.004) pags.push({ tipo: "restante", valor: rv, data: $("#sv-r-d", e2).value || null, hora: $("#sv-r-h", e2).value || null });
        } else dados.status = $("#sv-st", e2).value;
        var b = this; A.ocupado(b, true, "Salvando...");
        P.q(novo ? P.sb.from("parceiro_servicos").insert(dados).select().single() : P.sb.from("parceiro_servicos").update(dados).eq("id", s.id).select().single()).then(function (n) {
          P.trocar(P.S.parcServ, n);
          if (!pags.length) return;
          return P.q(P.sb.from("parceiro_pagamentos").insert(pags.map(function (x) { return Object.assign({ servico_id: n.id }, x); })).select()).then(function (ls) { (ls || []).forEach(function (x) { P.S.parcPag.push(x); }); });
        }).then(function () { A.ocupado(b, false); jj.fechar(); A.avisar("Salvo", "ok"); desenhar(); }).catch(function (e) { A.ocupado(b, false); msg("Não salvou: " + A.msgErro(e)); });
      };
    }
    desenhar();
  }

  window.AGE_PARCSERV = { abrir: abrir, resumo: resumo, usar: function (ctx) { P = ctx; } };
})();
