// Painel do dono — 👥 CLIENTES: quem já pediu serviço ou orçamento, desde quando e de que tipo.
// Não tem cadastro à parte: junta os clientes que já estão no painel (obras/serviços e orçamentos) por nome, mostra a data em que
// cada um apareceu pela primeira vez e separa o que cada um pediu (Elétrica, Pintura, Câmeras, TI...). Só lê os dados: não grava nada.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { busca: "", tipo: "", de: "", ate: "" };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function chave(nome) { return semAcento(nome).replace(/[^a-z0-9]/g, ""); }
  function dia(v) { return v ? A.isoLocal(new Date(v)) : ""; }   // data local (AAAA-MM-DD) de um instante
  var STATUS_SERV = { aberto: "Aberto", em_andamento: "Em andamento", aguardando: "Aguardando aprovação", concluido: "Concluído", cancelado: "Cancelado" };
  var STATUS_ORC = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };

  // tipos de serviço de uma área (a de orçamento "eletrica_pintura" vale pelas duas)
  function tiposDe(cat) {
    if (!cat) return ["Sem tipo"];
    if (cat === "eletrica_pintura" || cat === "ambos") return ["Elétrica", "Pintura"];
    return [P.catNome ? P.catNome(cat) : (A.CATEG[cat] ? A.CATEG[cat].nome : String(cat))];
  }

  // monta a lista de clientes a partir do que já existe no painel
  function montar() {
    var S = P.S, mapa = {}, obraChave = {};
    function cli(nome) {
      var k = chave(nome); if (!k) return null;
      if (!mapa[k]) mapa[k] = { k: k, nome: String(nome).trim(), tel: "", doc: "", end: "", desde: "", itens: [] };
      return mapa[k];
    }
    function desde(c, d) { if (d && (!c.desde || d < c.desde)) c.desde = d; }
    (S.obras || []).forEach(function (o) {
      var c = cli(o.cliente); if (!c) return;
      obraChave[o.id] = c.k;
      desde(c, dia(o.criado_em)); c.cadastro = true;
      c.tel = c.tel || o.telefone || ""; c.end = c.end || o.endereco || "";
    });
    (S.serv || []).forEach(function (s) {
      var k = obraChave[s.obra_id], c = k && mapa[k]; if (!c) return;
      var d = dia(s.criado_em); desde(c, d);
      tiposDe(s.categoria).forEach(function (t) {
        c.itens.push({ origem: "Serviço", data: d, tipo: t, texto: String(s.descricao || "").split("\n")[0].slice(0, 90), status: STATUS_SERV[s.status] || s.status || "" });
      });
    });
    (S.orc || []).forEach(function (o) {
      var k = o.obra_id && obraChave[o.obra_id], c = k ? mapa[k] : cli(o.cliente); if (!c) return;
      var d = dia(o.criado_em); desde(c, d);
      c.tel = c.tel || o.telefone || ""; c.doc = c.doc || o.documento || ""; c.end = c.end || o.endereco || "";
      tiposDe(o.categoria).forEach(function (t, i) {
        c.itens.push({ oid: o.id, origem: "Orçamento nº " + String(o.numero || "").padStart(4, "0"), data: d, tipo: t, texto: o.status ? STATUS_ORC[o.status] || o.status : "",
          status: i === 0 && o.status === "aprovado" ? A.dinheiro(o.total || 0) : "", aprovado: i === 0 && o.status === "aprovado" ? Number(o.total) || 0 : 0 });
      });
    });
    var lista = Object.keys(mapa).map(function (k) {
      var c = mapa[k], tipos = {};
      c.itens.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
      c.itens.forEach(function (i) { tipos[i.tipo] = (tipos[i.tipo] || 0) + 1; });
      c.tipos = tipos;
      c.nServ = c.itens.filter(function (i) { return i.origem === "Serviço"; }).length;
      var oids = {}; c.itens.forEach(function (i) { if (i.oid) oids[i.oid] = 1; }); c.nOrc = Object.keys(oids).length;
      c.aprovado = c.itens.reduce(function (s, i) { return s + (i.aprovado || 0); }, 0);
      c.ultima = c.itens.length ? c.itens[0].data : c.desde;
      return c;
    });
    return lista;
  }

  function csv(lista) {
    if (!lista.length) { A.avisar("Nada para exportar com este filtro."); return; }
    var cel = function (t) { t = String(t === null || t === undefined ? "" : t); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var linhas = [["Cliente", "Telefone", "CPF/CNPJ", "Cliente desde", "Tipos de serviço", "Serviços", "Orçamentos", "Aprovado (R$)", "Última atividade"]];
    lista.forEach(function (c) {
      linhas.push([c.nome, c.tel, c.doc, A.dataSimples(c.desde), Object.keys(c.tipos).join(" / "), c.nServ, c.nOrc, c.aprovado ? String(c.aprovado.toFixed(2)).replace(".", ",") : "", A.dataSimples(c.ultima)]);
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "clientes-" + A.isoLocal(new Date()) + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function ver(c, ctx) {
    P = ctx;
    var todos = montar().sort(function (a, b) { return a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : a.nome.localeCompare(b.nome); });
    var tiposTodos = {};
    todos.forEach(function (x) { Object.keys(x.tipos).forEach(function (t) { tiposTodos[t] = (tiposTodos[t] || 0) + 1; }); });
    var nomesTipos = Object.keys(tiposTodos).sort(function (a, b) { return tiposTodos[b] - tiposTodos[a]; });
    var hoje = new Date(), lim30 = A.isoLocal(new Date(hoje.getTime() - 30 * 864e5));
    var novos30 = todos.filter(function (x) { return x.desde >= lim30; }).length;
    // novos clientes por mês (últimos 6)
    var meses = [], i;
    for (i = 5; i >= 0; i--) { var m = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); meses.push({ k: m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0"), rot: String(m.getMonth() + 1).padStart(2, "0") + "/" + m.getFullYear(), n: 0 }); }
    todos.forEach(function (x) { meses.forEach(function (mm) { if (x.desde.slice(0, 7) === mm.k) mm.n++; }); });
    var maxM = Math.max.apply(null, meses.map(function (mm) { return mm.n; }).concat([1]));

    c.innerHTML = '<div class="cab-secao"><h2>👥 Clientes</h2><span><button id="cl-csv" title="Baixa a lista filtrada para abrir no Excel">⬇ Planilha (CSV)</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Reúne os clientes que já estão no painel (serviços e orçamentos), com a <b>data em que apareceram pela primeira vez</b> e o <b>tipo de serviço</b> que pediram. Não precisa cadastrar de novo.</p>' +
      '<div class="cartao"><b>' + todos.length + "</b> cliente(s) · <b>" + novos30 + "</b> novo(s) nos últimos 30 dias" +
      (nomesTipos.length ? '<div style="margin-top:8px">' + nomesTipos.map(function (t) { return '<button class="peq" data-tipo="' + esc(t) + '">' + esc(t) + " · " + tiposTodos[t] + "</button> "; }).join("") + "</div>" : "") +
      '<div class="peq" style="margin-top:10px"><b>Novos clientes por mês</b>' + meses.map(function (mm) {
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><span style="width:64px">' + mm.rot + '</span><span style="background:var(--prim,#14325c);height:10px;border-radius:5px;width:' + Math.round(mm.n / maxM * 160) + 'px;min-width:' + (mm.n ? 6 : 0) + 'px"></span><span>' + mm.n + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="filtros"><input type="search" id="cl-busca" placeholder="🔍 Buscar nome, telefone ou CPF/CNPJ" value="' + esc(filtro.busca) + '"><select id="cl-tipo" aria-label="Tipo de serviço"><option value="">Todos os tipos de serviço</option>' +
      nomesTipos.map(function (t) { return '<option value="' + esc(t) + '"' + (filtro.tipo === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" +
      '<label class="peq">Desde <input type="date" id="cl-de" value="' + esc(filtro.de) + '"></label><label class="peq">até <input type="date" id="cl-ate" value="' + esc(filtro.ate) + '"></label></div>' +
      '<div id="cl-lista"></div>';

    function listar() {
      var b = semAcento(filtro.busca), dd = String(filtro.busca || "").replace(/\D/g, "");
      var ls = todos.filter(function (x) {
        if (filtro.tipo && !x.tipos[filtro.tipo]) return false;
        if (filtro.de && x.desde < filtro.de) return false;
        if (filtro.ate && x.desde > filtro.ate) return false;
        if (!b) return true;
        return semAcento(x.nome).indexOf(b) >= 0 || (dd.length >= 3 && (String(x.tel || "").replace(/\D/g, "").indexOf(dd) >= 0 || String(x.doc || "").replace(/\D/g, "").indexOf(dd) >= 0));
      });
      var r = $("#cl-lista", c);
      if (!ls.length) { r.innerHTML = '<div class="cartao mudo">Nenhum cliente com este filtro.</div>'; r._ls = ls; return; }
      r._ls = ls;
      r.innerHTML = ls.map(function (x) {
        var fone = String(x.tel || "").replace(/\D/g, "");
        return '<div class="cartao"><div><b>' + esc(x.nome) + "</b> " + Object.keys(x.tipos).map(function (t) { return '<span class="selo">' + esc(t) + (x.tipos[t] > 1 ? " ×" + x.tipos[t] : "") + "</span>"; }).join(" ") + "</div>" +
          '<div class="peq mudo">Cliente desde <b>' + esc(A.dataSimples(x.desde)) + "</b> · " + x.nServ + " serviço(s) · " + x.nOrc + " orçamento(s)" + (x.aprovado ? " · aprovado " + A.dinheiro(x.aprovado) : "") +
          (x.ultima && x.ultima !== x.desde ? " · última atividade " + esc(A.dataSimples(x.ultima)) : "") + "</div>" +
          (x.tel || x.doc || x.end ? '<div class="peq">' + [x.tel ? (fone.length >= 10 ? '<a href="https://wa.me/' + (fone.length <= 11 ? "55" : "") + fone + '" target="_blank" rel="noopener">📲 ' + esc(x.tel) + "</a>" : esc(x.tel)) : "", x.doc ? esc(x.doc) : "", x.end ? esc(x.end) : ""].filter(Boolean).join(" · ") + "</div>" : "") +
          (x.itens.length ? '<details class="peq" style="margin-top:6px"><summary>Ver o que pediu</summary>' + x.itens.map(function (i) {
            return "<div>" + esc(A.dataSimples(i.data)) + " · <b>" + esc(i.tipo) + "</b> · " + esc(i.origem) + (i.texto ? " · " + esc(i.texto) : "") + (i.status ? " · " + esc(i.status) : "") + "</div>";
          }).join("") + "</details>" : "") + "</div>";
      }).join("");
    }
    $("#cl-busca", c).oninput = function () { filtro.busca = this.value; listar(); };
    $("#cl-tipo", c).onchange = function () { filtro.tipo = this.value; listar(); };
    $("#cl-de", c).onchange = function () { filtro.de = this.value; listar(); };
    $("#cl-ate", c).onchange = function () { filtro.ate = this.value; listar(); };
    $$("[data-tipo]", c).forEach(function (bt) { bt.onclick = function () { filtro.tipo = filtro.tipo === bt.dataset.tipo ? "" : bt.dataset.tipo; $("#cl-tipo", c).value = filtro.tipo; listar(); }; });
    $("#cl-csv", c).onclick = function () { csv($("#cl-lista", c)._ls || []); };
    listar();
  }

  window.AGE_CLI = { ver: ver, _montar: function (ctx) { P = ctx; return montar(); } };
})();
