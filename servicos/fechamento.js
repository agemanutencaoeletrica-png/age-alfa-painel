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

  window.AGE_FECH = { ver: ver };
})();
