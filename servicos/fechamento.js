// Painel do dono — 📊 FECHAMENTO MENSAL dos chamados (Supermercados BH e outros clientes com portal):
// cada chamado concluído no mês com a data, a loja, o serviço realizado, a OS e o valor negociado no portal.
// Cole as listas/detalhes do portal (📋) e o app atualiza valores e finalizados; o total do mês é somado na hora.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { mes: "", loja: "", sit: "" };

  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }
  function finalizadoPortal(o) { var p = o.portal || {}; return /finaliz/i.test((p.status || "") + " " + (p.osSit || "")); }
  // chamados concluídos: todos os serviços concluídos no app (ou finalizado no portal); data = finalização no portal ou a última conclusão
  function linhas() {
    var r = [];
    P.S.obras.forEach(function (o) {
      if (!o.chamado || o.prefeitura_id) return;
      var sv = P.S.serv.filter(function (x) { return x.obra_id === o.id && x.status !== "cancelado"; });
      if (!sv.length) return;
      var feitos = sv.filter(function (x) { return x.status === "concluido"; }), fin = finalizadoPortal(o);
      if (!fin && feitos.length !== sv.length) return;
      var dt = (o.portal && o.portal.finalizado_em) || feitos.map(function (x) { return x.concluido_em || ""; }).sort().pop() || (o.portal && o.portal.lido_em) || o.criado_em;
      var rels = P.S.rel.filter(function (x) { return sv.some(function (s) { return s.id === x.servico_id; }); }).sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
      var servico = (rels[0] && (rels[0].tipo_servico || rels[0].descricao)) || P.resumoServ(sv[0], 90).replace(/^📋 \d+ · /, "");
      r.push({ obra: o, data: String(dt).slice(0, 10), loja: o.cliente, chamado: o.chamado, os: (o.portal || {}).os || "", servico: String(servico || "").split("\n")[0].slice(0, 140),
        area: sv.map(function (x) { return x.categoria; }).filter(function (v, i, a) { return a.indexOf(v) === i; }), valor: Number((o.portal || {}).valor) || 0, fin: fin });
    });
    return r.sort(function (a, b) { return a.data.localeCompare(b.data); });
  }
  function nomeMes(m) { var d = new Date(m + "-15T12:00:00"); return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }

  function ver(c, ctx) {
    P = ctx;
    var todas = linhas(), meses = {};
    todas.forEach(function (x) { meses[x.data.slice(0, 7)] = 1; });
    var atual = A.isoLocal(new Date()).slice(0, 7);
    meses[atual] = 1;
    if (!filtro.mes) filtro.mes = atual;
    var ls = todas.filter(function (x) { return x.data.slice(0, 7) === filtro.mes && (!filtro.loja || x.loja === filtro.loja) &&
      (!filtro.sit || (filtro.sit === "fin" ? x.fin : filtro.sit === "falta" ? !x.fin : !x.valor)); });
    var lojasMes = {}; todas.filter(function (x) { return x.data.slice(0, 7) === filtro.mes; }).forEach(function (x) { lojasMes[x.loja] = 1; });
    var total = ls.reduce(function (t, x) { return t + x.valor; }, 0), semValor = ls.filter(function (x) { return !x.valor; }).length, falta = ls.filter(function (x) { return !x.fin; });
    c.innerHTML = '<div class="cab-secao"><h2>📊 Fechamento mensal dos chamados</h2><span><button class="prim" id="fe-colar">📋 Colar do portal</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Cole as páginas de <b>Ordens de serviço</b> e <b>Finalizados</b> (ou os Detalhes) do portal: o app atualiza valores e finalizados e soma o mês.</p>' +
      '<div class="filtros"><select id="fe-mes" aria-label="Mês">' + Object.keys(meses).sort().reverse().map(function (m) { return '<option value="' + m + '">' + esc(nomeMes(m)) + "</option>"; }).join("") + "</select>" +
      '<select id="fe-loja" aria-label="Loja"><option value="">Todas as lojas</option>' + Object.keys(lojasMes).sort().map(function (l) { return '<option value="' + esc(l) + '">' + esc(l) + "</option>"; }).join("") + "</select>" +
      '<select id="fe-sit" aria-label="Situação"><option value="">Todos</option><option value="fin">✅ Finalizados no portal</option><option value="falta">⏳ Falta finalizar no portal</option><option value="semvalor">💲 Sem valor</option></select></div>' +
      '<div class="grade"><div class="ladrilho"><div class="r">Total do mês</div><div class="v" style="font-size:1.3em">' + dinheiro(total) + "</div></div>" +
      '<div class="ladrilho"><div class="r">Chamados concluídos</div><div class="v">' + ls.length + "</div></div>" +
      '<div class="ladrilho"><div class="r">⏳ Falta finalizar no portal</div><div class="v">' + falta.length + '</div><div class="d">' + dinheiro(falta.reduce(function (t, x) { return t + x.valor; }, 0)) + "</div></div>" +
      (semValor ? '<div class="ladrilho"><div class="r">💲 Sem valor</div><div class="v">' + semValor + '</div><div class="d">cole a lista de Ordens de serviço</div></div>' : "") + "</div>" +
      (ls.length ? '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Chamado</th><th>Loja</th><th>Serviço realizado</th><th>OS</th><th>Portal</th><th class="num">Valor</th></tr></thead><tbody>' +
        ls.map(function (x) {
          return "<tr><td>" + esc(A.dataSimples(x.data)) + "</td><td><b>" + esc(x.chamado) + "</b></td><td>" + esc(x.loja) + "</td><td>" + x.area.map(function (a) { return A.seloCategoria(a); }).join("") + " " + esc(x.servico) +
            "</td><td>" + esc(x.os) + "</td><td>" + (x.fin ? '<span class="selo bom">✅ finalizado</span>' : '<span class="selo atencao">⏳ finalizar</span>') +
            '</td><td class="num"><button class="peq" data-fe-valor="' + x.obra.id + '" title="Corrigir o valor">' + (x.valor ? "<b>" + dinheiro(x.valor) + "</b>" : "💲 informar") + "</button></td></tr>";
        }).join("") + '<tr><td colspan="6"><b>Total ' + esc(nomeMes(filtro.mes)) + '</b></td><td class="num"><b>' + dinheiro(total) + "</b></td></tr></tbody></table></div>" +
        '<div class="acoes"><button id="fe-csv">⬇ Planilha (CSV)</button><button id="fe-comp">📤 Compartilhar fechamento</button></div>'
        : '<div class="cartao vazio">Nenhum chamado concluído neste mês.</div>');
    $("#fe-mes").value = filtro.mes; $("#fe-loja").value = filtro.loja; $("#fe-sit").value = filtro.sit;
    ["#fe-mes", "#fe-loja", "#fe-sit"].forEach(function (id) { $(id).onchange = function () { filtro.mes = $("#fe-mes").value; filtro.loja = $("#fe-loja").value; filtro.sit = $("#fe-sit").value; ver(c, P); }; });
    $("#fe-colar").onclick = function () { P.importarChamado(); };
    $$("[data-fe-valor]", c).forEach(function (b) {
      b.onclick = function () {
        var o = P.porId(P.S.obras, b.dataset.feValor), atualV = (o.portal || {}).valor;
        var t = window.prompt("Valor do chamado " + o.chamado + " (R$):", atualV ? Number(atualV).toFixed(2).replace(".", ",") : "");
        if (t === null) return;
        var v = A.lerNumero(t);
        if (!(v >= 0)) return;
        P.q(P.sb.from("obras").update({ portal: Object.assign({}, o.portal || {}, { valor: v }) }).eq("id", o.id).select().single())
          .then(function (n) { P.trocar(P.S.obras, n); ver(c, P); }).catch(P.falhou);
      };
    });
    if ($("#fe-csv")) $("#fe-csv").onclick = function () { baixarCsv(ls); };
    if ($("#fe-comp")) $("#fe-comp").onclick = function () { A.compartilhar({ titulo: "Fechamento " + nomeMes(filtro.mes), texto: texto(ls, total) }); };
  }
  function texto(ls, total) {
    var porLoja = {};
    ls.forEach(function (x) { porLoja[x.loja] = (porLoja[x.loja] || 0) + x.valor; });
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Fechamento de " + nomeMes(filtro.mes) + "*\n" + ls.length + " chamados concluídos · *" + dinheiro(total) + "*\n\n" +
      ls.map(function (x) { return A.dataSimples(x.data).slice(0, 5) + " · " + x.chamado + " · " + x.loja + " · " + x.servico.slice(0, 60) + " · " + (x.valor ? dinheiro(x.valor) : "sem valor") + (x.fin ? "" : " (finalizar)"); }).join("\n") +
      "\n\nPor loja:\n" + Object.keys(porLoja).sort().map(function (l) { return "• " + l + ": " + dinheiro(porLoja[l]); }).join("\n");
  }
  function baixarCsv(ls) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var linhasCsv = [["Data de conclusão", "Chamado", "Loja", "Serviço realizado", "Área", "OS", "Situação no portal", "Valor (R$)"]];
    ls.forEach(function (x) {
      linhasCsv.push([A.dataSimples(x.data), x.chamado, x.loja, x.servico, x.area.map(function (a) { return A.CATEG[a].nome; }).join(" e "), x.os, x.fin ? "Finalizado" : "Falta finalizar", Number(x.valor).toFixed(2).replace(".", ",")]);
    });
    var csv = "﻿" + linhasCsv.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "fechamento-" + filtro.mes + ".csv");
  }


  // ---------- 🛒 Supermercados BH dentro de Orçamentos: valor de cada chamado, loja por loja ----------
  var filtroLoja = { mes: "", sit: "", busca: "" };
  function todosChamados() {
    var r = [];
    P.S.obras.forEach(function (o) {
      if (!o.chamado || o.prefeitura_id) return;
      var sv = P.S.serv.filter(function (x) { return x.obra_id === o.id && x.status !== "cancelado"; });
      var fin = finalizadoPortal(o), feitos = sv.filter(function (x) { return x.status === "concluido"; });
      var sit = fin ? "fin" : sv.length && feitos.length === sv.length ? "conc" : sv.some(function (x) { return x.status === "em_andamento"; }) ? "and" : sv.some(function (x) { return x.status === "aguardando"; }) ? "aguard" : "aberto";
      var orcs = (P.S.orc || []).filter(function (q) { return q.obra_id === o.id; }).sort(function (a, b) { return b.numero - a.numero; });
      r.push({ obra: o, loja: o.cliente || "Sem loja", chamado: o.chamado, data: String(o.chamado_aberto || o.criado_em || "").slice(0, 10), sit: sit,
        servico: sv.length ? String(P.resumoServ(sv[0], 90).replace(/^📋 \d+ · /, "")).split("\n")[0].slice(0, 130) : "", valor: Number((o.portal || {}).valor) || 0, orc: orcs[0] || null });
    });
    return r;
  }
  var SIT = { fin: ["✅ finalizado", "bom"], conc: ["✔ concluído", "bom"], and: ["🔧 em andamento", "atencao"], aguard: ["⏳ aguardando", "atencao"], aberto: ["📂 aberto", ""] };
  function porLoja(c, ctx) {
    P = ctx;
    var todos = todosChamados(), meses = {};
    todos.forEach(function (x) { if (x.data) meses[x.data.slice(0, 7)] = 1; });
    var b = String(filtroLoja.busca || "").toLowerCase().trim();
    var ls = todos.filter(function (x) {
      return (!filtroLoja.mes || x.data.slice(0, 7) === filtroLoja.mes) && (!filtroLoja.sit || (filtroLoja.sit === "semvalor" ? !x.valor : filtroLoja.sit === "abertos" ? x.sit !== "fin" && x.sit !== "conc" : x.sit === filtroLoja.sit)) &&
        (!b || (x.loja + " " + x.chamado + " " + x.servico).toLowerCase().indexOf(b) >= 0);
    });
    var lojas = {}; ls.forEach(function (x) { (lojas[x.loja] = lojas[x.loja] || []).push(x); });
    var nomes = Object.keys(lojas).sort(function (a, b) { return a.localeCompare(b, "pt-BR", { numeric: true }); });
    var total = ls.reduce(function (t, x) { return t + x.valor; }, 0), semValor = ls.filter(function (x) { return !x.valor; }).length;
    c.innerHTML = '<div class="cab-secao"><h2>🛒 Supermercados BH · chamados por loja</h2><span><button id="sb-colar" title="Cole as páginas do portal para atualizar valores e finalizados">📋 Colar do portal</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Aqui fica só o Supermercados BH, separado dos outros orçamentos. Informe o <b>valor de cada chamado</b>: o mesmo valor vale no 📊 Fechamento mensal.</p>' +
      '<div class="filtros"><select id="sb-mes" aria-label="Mês de abertura"><option value="">Todos os meses</option>' + Object.keys(meses).sort().reverse().map(function (m) { return '<option value="' + m + '">' + esc(nomeMes(m)) + "</option>"; }).join("") + "</select>" +
      '<select id="sb-sit" aria-label="Situação"><option value="">Todas as situações</option><option value="abertos">Em aberto (não concluídos)</option><option value="conc">Concluídos</option><option value="fin">Finalizados no portal</option><option value="semvalor">💲 Sem valor</option></select>' +
      '<input id="sb-busca" type="search" placeholder="🔍 Loja, chamado ou serviço" style="flex:1;min-width:160px"></div>' +
      '<div class="grade"><div class="ladrilho"><div class="r">Total dos chamados</div><div class="v" style="font-size:1.3em">' + dinheiro(total) + '</div></div><div class="ladrilho"><div class="r">Chamados</div><div class="v">' + ls.length + '</div><div class="d">' + nomes.length + " loja(s)</div></div>" +
      (semValor ? '<div class="ladrilho"><div class="r">💲 Sem valor</div><div class="v">' + semValor + "</div></div>" : "") + "</div>" +
      (nomes.length ? nomes.map(function (l) {
        var g = lojas[l].sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }), sub = g.reduce(function (t, x) { return t + x.valor; }, 0);
        return '<div class="cab-secao" style="margin-top:14px"><h3 style="margin:0">🏪 ' + esc(l) + '</h3><span><b>' + dinheiro(sub) + '</b> <span class="mudo peq">· ' + g.length + " chamado(s)</span></span></div>" +
          '<div class="tabela-caixa"><table><thead><tr><th>Chamado</th><th>Aberto</th><th>Serviço</th><th>Situação</th><th class="num">Valor</th></tr></thead><tbody>' +
          g.map(function (x) {
            var s = SIT[x.sit];
            return "<tr><td><b>" + esc(x.chamado) + "</b></td><td>" + esc(A.dataSimples(x.data).slice(0, 5)) + "</td><td>" + esc(x.servico) + (x.orc ? '<div class="mudo peq">orçamento nº ' + String(x.orc.numero).padStart(4, "0") + " · " + dinheiro(x.orc.total) + "</div>" : "") +
              '</td><td><span class="selo ' + s[1] + '">' + s[0] + '</span></td><td class="num"><button class="peq" data-sb-valor="' + x.obra.id + '" title="Informar ou corrigir o valor">' + (x.valor ? "<b>" + dinheiro(x.valor) + "</b>" : "💲 informar") + "</button>" +
              (!x.valor && x.orc && x.orc.total > 0 ? '<div><button class="peq" data-sb-orc="' + x.obra.id + '" title="Usa o total do orçamento como valor do chamado">↳ usar ' + dinheiro(x.orc.total) + "</button></div>" : "") + "</td></tr>";
          }).join("") + '<tr><td colspan="4"><b>Total ' + esc(l) + '</b></td><td class="num"><b>' + dinheiro(sub) + "</b></td></tr></tbody></table></div>";
      }).join("") + '<div class="acoes"><button id="sb-csv">⬇ Planilha (CSV)</button><button id="sb-comp">📤 Compartilhar por loja</button></div>' : '<div class="cartao vazio">Nenhum chamado com esses filtros.</div>');
    $("#sb-mes", c).value = filtroLoja.mes; $("#sb-sit", c).value = filtroLoja.sit; $("#sb-busca", c).value = filtroLoja.busca;
    ["#sb-mes", "#sb-sit"].forEach(function (id) { $(id, c).onchange = function () { filtroLoja.mes = $("#sb-mes", c).value; filtroLoja.sit = $("#sb-sit", c).value; porLoja(c, P); }; });
    $("#sb-busca", c).onchange = function () { filtroLoja.busca = this.value; porLoja(c, P); };
    $("#sb-colar", c).onclick = function () { P.importarChamado(); };
    function gravar(o, v) { return P.q(P.sb.from("obras").update({ portal: Object.assign({}, o.portal || {}, { valor: v }) }).eq("id", o.id).select().single()).then(function (n) { P.trocar(P.S.obras, n); porLoja(c, P); }).catch(P.falhou); }
    $$("[data-sb-valor]", c).forEach(function (bt) {
      bt.onclick = function () {
        var o = P.porId(P.S.obras, bt.dataset.sbValor), atual = (o.portal || {}).valor;
        var t = window.prompt("Valor do chamado " + o.chamado + " — " + (o.cliente || "") + " (R$):", atual ? Number(atual).toFixed(2).replace(".", ",") : "");
        if (t === null) return;
        var v = A.lerNumero(t); if (!(v >= 0)) { A.avisar("Valor inválido.", "erro"); return; }
        gravar(o, v);
      };
    });
    $$("[data-sb-orc]", c).forEach(function (bt) {
      bt.onclick = function () { var x = todosChamados().filter(function (y) { return y.obra.id === bt.dataset.sbOrc; })[0]; if (x && x.orc) gravar(x.obra, Number(x.orc.total)); };
    });
    if ($("#sb-csv", c)) $("#sb-csv", c).onclick = function () {
      var cel = function (v) { v = String(v === null || v === undefined ? "" : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var l = [["Loja", "Chamado", "Aberto em", "Serviço", "Situação", "Valor (R$)"]];
      nomes.forEach(function (n) { lojas[n].forEach(function (x) { l.push([n, x.chamado, A.dataSimples(x.data), x.servico, SIT[x.sit][0].replace(/^\S+\s/, ""), Number(x.valor).toFixed(2).replace(".", ",")]); }); });
      P.baixar(new Blob(["﻿" + l.map(function (r) { return r.map(cel).join(";"); }).join("\r\n")], { type: "text/csv;charset=utf-8" }), "supermercados-bh-chamados-" + A.isoLocal(new Date()) + ".csv");
    };
    if ($("#sb-comp", c)) $("#sb-comp", c).onclick = function () {
      A.compartilhar({ titulo: "Chamados Supermercados BH", texto: "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Chamados Supermercados BH*\nTotal: *" + dinheiro(total) + "* · " + ls.length + " chamado(s)\n" +
        nomes.map(function (n) { var g = lojas[n]; return "\n🏪 *" + n + "* — " + dinheiro(g.reduce(function (t, x) { return t + x.valor; }, 0)) + "\n" + g.map(function (x) { return "• " + x.chamado + " · " + x.servico.slice(0, 50) + " · " + (x.valor ? dinheiro(x.valor) : "sem valor"); }).join("\n"); }).join("\n") });
    };
  }

  window.AGE_FECH = { ver: ver, porLoja: porLoja };
})();
