// Painel do dono — 🗂 FICHA DA OBRA: uma tela por obra/cliente (ex.: DEVA) juntando o que já está lançado no app:
// orçamentos, notas fiscais, materiais (compras), mão de obra (pagamentos), avulsos, metragem, sobra e valores por m².
// Lê de 💼 Notas e resultado (AGE_FAT), dos orçamentos (P.S.orc), de 📈 Custo de obras e das cotações salvas da Calculadora. Só o dono vê.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, obrasCusto = [], cotacoes = [], busca = "";

  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function fq(v) { return String(Number(v) || 0).replace(".", ","); }
  function sa(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function dt(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function chaveNome(nome) { return sa(String(nome || "").replace(/\(.*?\)/g, "")).split(/\s+/).filter(function (w) { return w.length >= 3; })[0] || ""; }
  // metragem lembrada (a mesma da comparação da Calculadora)
  function lerAreas() { try { return JSON.parse(localStorage.getItem("age_comp_area") || "{}") || {}; } catch (e) { return {}; } }
  function guardarArea(k, v) { try { var o = lerAreas(); if (v > 0) o[k] = v; else delete o[k]; localStorage.setItem("age_comp_area", JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } }
  function areaDe(linhas) { var a = 0; (linhas || []).forEach(function (l) { if (l && l.tipo !== "material" && /^m(²|2)$/i.test(String(l.un || "").trim())) a += Number(l.qtd) || 0; }); return a; }

  function orcamentos(nome) {
    var ch = chaveNome(nome); if (!ch) return [];
    return ((P.S && P.S.orc) || []).filter(function (o) { return sa(o.cliente).indexOf(ch) >= 0; }).map(function (o) { var t = 0; try { t = P.calcOrc(o).total; } catch (e) { t = 0; } return { numero: o.numero, total: r2(t), data: o.criado_em, titulo: o.titulo || o.descricao || "" }; }).filter(function (o) { return o.total > 0; });
  }
  // de onde vem a metragem: Custo de obras (mesmo nome) > cotação salva com o mesmo nome > o que foi digitado antes
  function metragem(x) {
    var ch = chaveNome(x.nome), mem = lerAreas()[x.k];
    var oc = obrasCusto.filter(function (o) { return o.c.area > 0 && sa(o.nome).indexOf(ch) >= 0; })[0];
    if (oc) return { area: oc.c.area, de: "Custo de obras (“" + oc.nome + "”)", fixa: true };
    var ct = cotacoes.filter(function (y) { return ch && sa(y.nome).indexOf(ch) >= 0 && areaDe(y.linhas) > 0; })[0];
    if (mem) return { area: mem, de: "digitada por você" };
    if (ct) return { area: areaDe(ct.linhas), de: "cotação salva “" + ct.nome + "”" };
    return { area: 0, de: "" };
  }
  function resumo(x) {
    var notas = r2(x.notasV || x.portal || 0), custo = r2(x.mat + x.mo + x.av + (x.impEmp || 0)), ors = orcamentos(x.nome), orcado = r2(ors.reduce(function (s, o) { return s + o.total; }, 0)), m = metragem(x);
    var sobra = notas ? r2(notas - custo) : null;
    return { notas: notas, custo: custo, ors: ors, orcado: orcado, m: m, sobra: sobra, pct: notas ? sobra / notas * 100 : null, aReceber: x.notasV ? r2(x.notasV - x.recebido) : 0 };
  }
  function alertas(x, r) {
    var L = [];
    if (r.notas && x.mo === 0) L.push("sem mão de obra ligada (pagamentos sem “Obra / cliente” desta obra): a sobra aparece alta demais");
    if (r.orcado && r.notas && Math.abs(r.notas - r.orcado) >= 1) L.push("notas " + din(Math.abs(r.notas - r.orcado)) + (r.notas > r.orcado ? " acima" : " abaixo") + " da soma dos orçamentos (" + din(r.orcado) + ")");
    if (!(r.m.area > 0)) L.push("sem metragem: informe os m² para ver os valores por m²");
    if (r.aReceber > 0) L.push("a receber " + din(r.aReceber) + " das notas");
    return L;
  }

  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>🗂 Ficha da obra</h2></div><div class="cartao vazio">Carregando...</div>';
    var pa = window.AGE_CUSTOS && window.AGE_CUSTOS.todas ? window.AGE_CUSTOS.todas(P) : Promise.resolve([]);
    var pb = Promise.resolve(P.sb.from("calc_cotacoes").select("nome,linhas").limit(300)).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
    Promise.all([pa, pb]).then(function (r) { obrasCusto = r[0] || []; cotacoes = r[1] || []; desenhar(c); });
  }
  function desenhar(c) {
    if (!window.AGE_FAT || !window.AGE_FAT.resultadoTodos) { c.innerHTML = '<div class="aviso">Atualize a página (Ctrl+F5) para abrir a ficha da obra.</div>'; return; }
    var todos = window.AGE_FAT.resultadoTodos(P), sem = todos.filter(function (x) { return x.k === "-"; })[0], b = sa(busca);
    var L = todos.filter(function (x) { return x.k !== "-" && (x.entrada || x.gastos) && (!b || sa(x.nome).indexOf(b) >= 0); });
    c.innerHTML = '<div class="cab-secao"><h2>🗂 Ficha da obra</h2></div><p class="mudo peq" style="margin-top:-4px">Cada obra ou cliente com tudo junto: <b>orçamentos</b>, <b>notas fiscais</b>, <b>materiais</b>, <b>mão de obra</b>, <b>avulsos</b>, <b>metragem</b> e a <b>sobra por m²</b>. Vem do que você já lançou em Compras, Pagamentos e Notas e resultado, ligado pelo <b>mesmo nome de obra</b> (ex.: DEVA).</p>' +
      '<div class="filtros"><input type="search" id="fo-b" data-sem-correcao placeholder="🔍 Buscar obra ou cliente" value="' + esc(busca) + '"></div>' +
      (sem && (sem.gastos || sem.notasV) ? '<div class="aviso">⚠️ ' + din(sem.gastos + sem.notasV) + ' estão <b>sem obra definida</b> (compras sem “Para onde foi” ou pagamentos sem “Obra / cliente”). Em <b>💼 Notas e resultado › Resultado por obra</b>, toque em Ver e informe a obra.</div>' : "") +
      (L.length ? L.map(function (x, i) {
        var r = resumo(x), al = alertas(x, r);
        return '<div class="cartao"><div class="linha" style="gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b>' + esc(x.nome) + "</b>" +
          '<div class="peq" style="margin-top:4px">' + (r.orcado ? "Orçado <b>" + din(r.orcado) + "</b> · " : "") + "notas <b>" + (r.notas ? din(r.notas) : "—") + "</b> · custos <b>" + din(r.custo) + "</b>" + (r.sobra !== null ? ' · sobra <b style="color:var(--' + (r.sobra < 0 ? "critico" : "bom") + ')">' + din(r.sobra) + " (" + A.numero(r.pct, 1) + "%)</b>" : "") + "</div>" +
          '<div class="peq mudo">' + (r.m.area > 0 ? A.numero(r.m.area, 0) + " m² · cobrado " + (r.notas ? din(r2(r.notas / r.m.area)) : "—") + "/m² · custo " + din(r2(r.custo / r.m.area)) + "/m²" : "metragem não informada") + "</div>" +
          (al.length ? '<div class="peq" style="color:var(--atencao,#b7791f);margin-top:4px">⚠ ' + al.map(esc).join("<br>⚠ ") + "</div>" : "") +
          '</div><div class="acoes"><button class="peq prim" data-fo="' + i + '">Abrir a ficha</button></div></div></div>';
      }).join("") : '<div class="cartao vazio">' + (busca ? "Nenhuma obra com essa busca." : "Nada lançado ainda. Lance compras (Para onde foi), pagamentos (Obra / cliente) e notas de serviço com o mesmo nome de obra.") + "</div>");
    $("#fo-b", c).oninput = function () { busca = this.value; desenhar(c); var i = $("#fo-b", c); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$("[data-fo]", c).forEach(function (bt) { bt.onclick = function () { ficha(L[Number(bt.dataset.fo)], c); }; });
  }

  function ficha(x, c) {
    var r = resumo(x);
    function sec(tit, v, linhas) { return linhas.length ? '<h3 style="margin:12px 0 4px">' + tit + " · " + din(v) + '</h3><div class="peq">' + linhas.join("<br>") + "</div>" : ""; }
    var j = A.janela('<div id="fo-topo"></div>' +
      sec("📑 Orçamentos do app", r.orcado, r.ors.map(function (o) { return "Orçamento nº " + esc(o.numero) + " · " + esc(dt(o.data)) + " · <b>" + din(o.total) + "</b>" + (o.titulo ? " · " + esc(String(o.titulo).slice(0, 60)) : ""); })) +
      sec("🧾 Notas fiscais de serviço", r.notas, x.notas.map(function (n) { return "Nota nº " + esc(n.numero_nota || "s/ nº") + " · " + esc(dt(n.emitida_em)) + " · <b>" + din(n.valor) + "</b>" + (n.recebido ? " · recebida" : " · a receber") + (n.descricao ? " · " + esc(String(n.descricao).slice(0, 60)) : ""); })) +
      sec("🧱 Materiais", x.mat, x.compras.map(function (k) { return esc(dt(k.comprado_em)) + " · " + esc(k.fornecedor || "Loja") + " · <b>" + din(k.valor) + "</b>"; })) +
      sec("👷 Mão de obra paga", x.mo, x.pags.map(function (g) { return esc(dt(String(g.pago_em).slice(0, 10))) + " · " + esc(P.nomeFunc(g.funcionario_id) || g.favorecido || "—") + " · <b>" + din(g.valor) + "</b>"; })) +
      sec("⛽ Avulsos", x.av, x.desp.map(function (k) { return esc(dt(k.comprado_em)) + " · " + esc(k.fornecedor || "") + " " + esc(k.descricao || "") + " · <b>" + din(k.valor) + "</b>"; })) +
      '<div class="acoes" style="margin-top:12px"><button class="peq prim" id="fo-levar">📈 Levar para Custo de obras (concluída)</button><button class="peq" id="fo-comp">📤 Compartilhar resumo</button><button id="fo-x">Fechar</button></div>', { titulo: "🗂 " + x.nome, larga: true, semRascunho: true });
    var el = j.el;
    function topo() {
      var m = metragem(x), a = m.area, rr = resumo(x), notas = rr.notas, custo = rr.custo;
      function lad(t, v, cor) { return '<div class="ladrilho" style="border-left:4px solid var(--' + (cor || "prim") + ')"><div class="r">' + t + '</div><div class="v" style="font-size:1.1em">' + v + "</div></div>"; }
      $("#fo-topo", el).innerHTML = '<div class="grade">' + lad("📑 Orçado", rr.orcado ? din(rr.orcado) : "—") + lad("🧾 Notas", notas ? din(notas) : "—") + lad("💸 Custos", din(custo), "atencao") + lad("Sobra", rr.sobra === null ? "—" : din(rr.sobra) + " (" + A.numero(rr.pct, 1) + "%)", rr.sobra !== null && rr.sobra < 0 ? "critico" : "bom") + "</div>" +
        '<div class="linha" style="gap:8px;align-items:flex-end;margin-top:8px;flex-wrap:wrap"><label style="width:200px">Metragem (m²)<input id="fo-area" inputmode="decimal" value="' + (a ? esc(fq(a)) : "") + '"' + (m.fixa ? " disabled" : "") + '></label><span class="peq mudo" style="flex:1;min-width:220px">' + (m.de ? "Vem de: " + esc(m.de) + "." : "Digite uma vez: a metragem fica lembrada (e vale na comparação da Calculadora).") + "</span></div>" +
        (a > 0 ? '<div class="peq" style="margin-top:6px">Por m²: cobrado <b>' + (notas ? din(r2(notas / a)) : "—") + "</b> · materiais <b>" + din(r2(x.mat / a)) + "</b> · mão de obra <b>" + din(r2(x.mo / a)) + "</b> · custo total <b>" + din(r2(custo / a)) + "</b>" + (rr.sobra !== null ? " · sobra <b>" + din(r2(rr.sobra / a)) + "</b>" : "") + "</div>" : "") +
        alertas(x, rr).map(function (t) { return '<div class="peq" style="color:var(--atencao,#b7791f);margin-top:4px">⚠ ' + esc(t) + "</div>"; }).join("");
      var ia = $("#fo-area", el); if (ia && !ia.disabled) ia.oninput = function () { guardarArea(x.k, A.lerNumero(this.value) || 0); var pos = this.selectionStart; topo(); var n = $("#fo-area", el); n.focus(); n.setSelectionRange(pos, pos); };
    }
    topo();
    $("#fo-x", el).onclick = function () { j.fechar(); };
    $("#fo-comp", el).onclick = function () {
      var rr = resumo(x), a = rr.m.area;
      A.compartilhar({ titulo: "Ficha " + x.nome, texto: "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Ficha da obra: " + x.nome + "*\n" + (rr.orcado ? "📑 Orçado: " + din(rr.orcado) + "\n" : "") + "🧾 Notas: " + din(rr.notas) + "\n🧱 Materiais: " + din(x.mat) + "\n👷 Mão de obra: " + din(x.mo) + "\n⛽ Avulsos: " + din(x.av) + (x.impEmp ? "\n🏛️ Imposto: " + din(x.impEmp) : "") + "\nCusto total: " + din(rr.custo) + (rr.sobra !== null ? "\n*Sobra: " + din(rr.sobra) + " (" + A.numero(rr.pct, 1) + "%)*" : "") + (a > 0 ? "\n📐 " + A.numero(a, 0) + " m² · custo " + din(r2(rr.custo / a)) + "/m²" + (rr.notas ? " · cobrado " + din(r2(rr.notas / a)) + "/m²" : "") : "") });
    };
    $("#fo-levar", el).onclick = function () {
      if (!window.AGE_CUSTOS || !window.AGE_CUSTOS.inserirObra) { A.avisar("Atualize a página (Ctrl+F5).", "erro"); return; }
      if (obrasCusto.some(function (o) { return sa(o.nome) === sa(x.nome); }) && !A.confirmar("Já existe uma obra “" + x.nome + "” em Custo de obras. Levar de novo e criar outra?")) return;
      var rr = resumo(x), d = window.AGE_CUSTOS.dadosDeResultado(x, null, rr.m.area);
      window.AGE_CUSTOS.inserirObra(P, x.nome, "concluida", d).then(function () { A.avisar("Levada para 📈 Custo de obras como concluída. Abra lá para ajustar etapas, dias e equipe.", "ok"); })
        .catch(function (e) { A.avisar(/does not exist|schema cache|PGRST205|42P01/i.test(String(e && e.message)) ? "Rode o custos-obras.sql no Supabase para usar Custo de obras." : (A.msgErro ? A.msgErro(e) : e.message), "erro"); });
    };
  }

  window.AGE_FICHA = { ver: ver };
})();
