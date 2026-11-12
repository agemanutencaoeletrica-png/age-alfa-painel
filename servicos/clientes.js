// Painel do dono — 👥 CLIENTES: quem já pediu serviço ou orçamento, desde quando e de que tipo.
// Não tem cadastro à parte: junta os clientes que já estão no painel (obras/serviços e orçamentos) por nome, mostra a data em que
// cada um apareceu pela primeira vez e separa o que cada um pediu (Elétrica, Pintura, Câmeras, TI...). Só lê os dados: não grava nada.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { busca: "", tipo: "", de: "", ate: "" };
  var raiz = null, fila = Promise.resolve();

  // o que já foi gravado em minúsculas aparece com a maiúscula inicial (nome: cada palavra; observação: cada linha)
  function nm(t) { return P && P.nomeProprio ? P.nomeProprio(t, true) : String(t || ""); }
  function ob(t) { return P && P.maiusculaInicial ? P.maiusculaInicial(t, true) : String(t || ""); }
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
    var S = P.S, mapa = {}, obraChave = {}, fora = {};
    function cli(nome) {
      var k = chave(nome); if (!k) return null;
      if (!mapa[k]) mapa[k] = { k: k, nome: String(nome).trim(), tel: "", doc: "", end: "", desde: "", itens: [] };
      return mapa[k];
    }
    function desde(c, d) { if (d && (!c.desde || d < c.desde)) c.desde = d; }
    (S.obras || []).forEach(function (o) {
      // lojas da rede (Supermercados BH, postos...) e prefeituras não são clientes: ficam nas abas Lojas e Prefeitura
      if (o.loja_id || o.prefeitura_id || o.chamado) { fora[o.id] = 1; return; }
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
      if (o.obra_id && fora[o.obra_id]) return;
      var k = o.obra_id && obraChave[o.obra_id], c = k ? mapa[k] : cli(o.cliente); if (!c) return;
      var d = dia(o.criado_em); desde(c, d);
      c.tel = c.tel || o.telefone || ""; c.doc = c.doc || o.documento || ""; c.end = c.end || o.endereco || "";
      tiposDe(o.categoria).forEach(function (t, i) {
        c.itens.push({ oid: o.id, origem: "Orçamento nº " + String(o.numero || "").padStart(4, "0"), data: d, tipo: t, texto: o.status ? STATUS_ORC[o.status] || o.status : "",
          status: i === 0 && o.status === "aprovado" ? A.dinheiro(o.total || 0) : "", aprovado: i === 0 && o.status === "aprovado" ? Number(o.total) || 0 : 0 });
      });
    });
    // ficha editada por você: vale a data de cadastro e os tipos de serviço que você escolheu; cliente só da ficha também aparece
    (S.fichas || []).forEach(function (f) {
      var c = mapa[f.chave] || (mapa[f.chave] = { k: f.chave, nome: String(f.nome || "").trim(), tel: "", doc: "", end: "", desde: "", itens: [] }); if (!c.nome && !f.nome) return;
      if (f.nome) c.nome = f.nome;   // o nome que você corrigiu vale (os serviços e orçamentos antigos continuam com o nome de antes)
      c.ficha = f; c.manual = !c.cadastro && !c.itens.length;
      if (f.cadastrado_em) c.desde = f.cadastrado_em;
      if (!c.desde) c.desde = dia(f.criado_em);
      c.tel = f.telefone || c.tel; c.obs = f.obs || "";
      if (Array.isArray(f.tipos)) c.tiposEdit = f.tipos;
      c.oculto = !!f.oculto;
    });
    var lista = Object.keys(mapa).map(function (k) {
      var c = mapa[k], tipos = {};
      c.itens.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
      c.itens.forEach(function (i) { tipos[i.tipo] = (tipos[i.tipo] || 0) + 1; });
      c.tiposAuto = tipos;
      if (c.tiposEdit) { tipos = {}; c.tiposEdit.forEach(function (n) { tipos[n] = c.tiposAuto[n] || 0; }); }
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
    P = ctx; raiz = c;
    var todosAll = montar().sort(function (a, b) { return a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : a.nome.localeCompare(b.nome); });
    var todos = todosAll.filter(function (x) { return !x.oculto; });   // os apagados da lista não entram nas contas
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

    c.innerHTML = '<div class="cab-secao"><h2>👥 Clientes</h2><span><button class="prim" id="cl-novo">+ Novo cliente</button> <button id="cl-csv" title="Baixa a lista filtrada para abrir no Excel">⬇ Planilha (CSV)</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Reúne os clientes que já estão no painel (serviços e orçamentos), com a <b>data em que apareceram pela primeira vez</b> e o <b>tipo de serviço</b> que pediram. Não precisa cadastrar de novo.</p>' +
      '<div class="cartao"><b>' + todos.length + "</b> cliente(s) · <b>" + novos30 + "</b> novo(s) nos últimos 30 dias" +
      (nomesTipos.length ? '<div style="margin-top:8px">' + nomesTipos.map(function (t) { return '<button class="peq" data-tipo="' + esc(t) + '">' + esc(t) + " · " + tiposTodos[t] + "</button> "; }).join("") + "</div>" : "") +
      '<div class="peq" style="margin-top:10px"><b>Novos clientes por mês</b>' + meses.map(function (mm) {
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><span style="width:64px">' + mm.rot + '</span><span style="background:var(--prim,#14325c);height:10px;border-radius:5px;width:' + Math.round(mm.n / maxM * 160) + 'px;min-width:' + (mm.n ? 6 : 0) + 'px"></span><span>' + mm.n + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="filtros"><input type="search" id="cl-busca" placeholder="🔍 Buscar nome, telefone ou CPF/CNPJ" value="' + esc(filtro.busca) + '"><select id="cl-tipo" aria-label="Tipo de serviço"><option value="">Todos os tipos de serviço</option>' +
      nomesTipos.map(function (t) { return '<option value="' + esc(t) + '"' + (filtro.tipo === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" +
      '<label class="peq"><input type="checkbox" id="cl-ocultos"' + (filtro.ocultos ? " checked" : "") + '> Mostrar apagados da lista (' + todosAll.filter(function (x) { return x.oculto; }).length + ')</label><label class="peq">Desde <input type="date" id="cl-de" value="' + esc(filtro.de) + '"></label><label class="peq">até <input type="date" id="cl-ate" value="' + esc(filtro.ate) + '"></label></div>' +
      '<div id="cl-lista"></div>';

    function listar() {
      var b = semAcento(filtro.busca), dd = String(filtro.busca || "").replace(/\D/g, "");
      var ls = (filtro.ocultos ? todosAll : todos).filter(function (x) {
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
        return '<div class="cartao"><div style="float:right"><button class="peq" data-ed="' + esc(x.k) + '">✏️ Editar</button></div><div><b>' + esc(nm(x.nome)) + "</b> " + (x.oculto ? '<span class="selo atencao">apagado da lista</span> ' : "") + Object.keys(x.tipos).map(function (t) { return '<span class="selo">' + esc(t) + (x.tipos[t] > 1 ? " ×" + x.tipos[t] : "") + "</span>"; }).join(" ") + "</div>" +
          '<div class="peq mudo">Cliente desde <b>' + esc(A.dataSimples(x.desde)) + "</b> · " + x.nServ + " serviço(s) · " + x.nOrc + " orçamento(s)" + (x.aprovado ? " · aprovado " + A.dinheiro(x.aprovado) : "") +
          (x.ultima && x.ultima !== x.desde ? " · última atividade " + esc(A.dataSimples(x.ultima)) : "") + "</div>" +
          (x.tel || x.doc || x.end ? '<div class="peq">' + [x.tel ? (fone.length >= 10 ? '<a href="https://wa.me/' + (fone.length <= 11 ? "55" : "") + fone + '" target="_blank" rel="noopener">📲 ' + esc(x.tel) + "</a>" : esc(x.tel)) : "", x.doc ? esc(x.doc) : "", x.end ? esc(x.end) : ""].filter(Boolean).join(" · ") + "</div>" : "") +
          (x.obs ? '<div class="peq mudo">' + esc(ob(x.obs)) + "</div>" : "") +
          (x.itens.length ? '<details class="peq" style="margin-top:6px"><summary>Ver o que pediu</summary>' + x.itens.map(function (i) {
            return "<div>" + esc(A.dataSimples(i.data)) + " · <b>" + esc(i.tipo) + "</b> · " + esc(i.origem) + (i.texto ? " · " + esc(i.texto) : "") + (i.status ? " · " + esc(i.status) : "") + "</div>";
          }).join("") + "</details>" : "") + "</div>";
      }).join("");
      $$("[data-ed]", r).forEach(function (bt) { bt.onclick = function () { editar(ls.filter(function (y) { return y.k === bt.dataset.ed; })[0]); }; });
    }
    $("#cl-busca", c).oninput = function () { filtro.busca = this.value; listar(); };
    $("#cl-tipo", c).onchange = function () { filtro.tipo = this.value; listar(); };
    $("#cl-ocultos", c).onchange = function () { filtro.ocultos = this.checked; listar(); };
    $("#cl-de", c).onchange = function () { filtro.de = this.value; listar(); };
    $("#cl-ate", c).onchange = function () { filtro.ate = this.value; listar(); };
    $$("[data-tipo]", c).forEach(function (bt) { bt.onclick = function () { filtro.tipo = filtro.tipo === bt.dataset.tipo ? "" : bt.dataset.tipo; $("#cl-tipo", c).value = filtro.tipo; listar(); }; });
    $("#cl-novo", c).onclick = function () { editar({ k: "", nome: "", tel: "", desde: A.isoLocal(new Date()), tiposAuto: {}, itens: [], novo: true }); };
    $("#cl-csv", c).onclick = function () { csv($("#cl-lista", c)._ls || []); };
    listar();
  }

  // ---------------- editar: salva sozinho a cada mudança ----------------
  // a ficha não tem "id": a chave (nome sem acento e sem espaços) identifica o cliente
  function guardarFicha(n) {
    var i = (P.S.fichas || []).findIndex(function (x) { return x.chave === n.chave; });
    if (i >= 0) P.S.fichas[i] = n; else P.S.fichas.push(n);
  }
  function gravar(c, dados) {
    var r = fila.then(function () {
      var f = (P.S.fichas || []).filter(function (x) { return x.chave === c.k; })[0], d = Object.assign({ chave: c.k, nome: c.nome }, dados);
      return P.q(f ? P.sb.from("clientes_ficha").update(d).eq("chave", c.k).select().single() : P.sb.from("clientes_ficha").insert(d).select().single())
        .then(function (n) { guardarFicha(n); return n; });
    });
    fila = r.catch(function () { /* o erro já vai para quem chamou; a fila segue */ });
    return r;
  }
  function editar(c) {
    if (P.S.semFichas) { A.avisar("Para editar, rode o supabase.sql no Supabase (tabela clientes_ficha). Depois recarregue o painel.", "erro"); return; }
    var nomes = {}; (P.tiposServico ? P.tiposServico() : []).concat(Object.keys(c.tiposAuto || {}), c.tiposEdit || []).forEach(function (n) { if (n && n !== "Sem tipo") nomes[n] = 1; });
    var marcados = c.tiposEdit ? c.tiposEdit.slice() : Object.keys(c.tiposAuto || {}).filter(function (n) { return n !== "Sem tipo"; });
    marcados.forEach(function (n) { nomes[n] = 1; });
    var j = A.janela(('<label for="cl-nome">Nome do cliente *</label><input id="cl-nome" maxlength="200" autocomplete="off">') +
      '<label for="cl-desde">Cliente desde (data de cadastro)</label><input type="date" id="cl-desde">' +
      '<label for="cl-tel">Telefone / WhatsApp</label><input id="cl-tel" type="tel" maxlength="40">' +
      '<label>Tipos de serviço</label><div id="cl-tipos"></div>' +
      '<div class="linha" style="margin-top:6px"><input id="cl-outro" maxlength="60" placeholder="Outro tipo (ex.: Ar-condicionado)" style="flex:1"><button class="peq" id="cl-add">+ Acrescentar</button></div>' +
      '<label for="cl-obs">Observações</label><textarea id="cl-obs" rows="3" maxlength="3000"></textarea>' +
      '<p class="peq mudo" id="cl-st" style="margin:8px 0 0">' + (c.novo ? "Escreva o nome para começar a salvar." : "Salva sozinho a cada mudança. Se preferir, toque em Salvar.") + "</p>" +
      '<div class="acoes">' + (c.tiposEdit ? '<button id="cl-auto" title="Volta a mostrar os tipos que o painel acha pelos serviços e orçamentos">↺ Tipos automáticos</button>' : "") + '<button class="prim" id="cl-salvar">💾 Salvar</button><button id="cl-fechar">Fechar</button>' + (c.novo && !c.k ? "" : c.oculto ? '<button id="cl-apagar" title="Mostra o cliente de novo na lista">↩ Mostrar de novo na lista</button>' : '<button class="perigo" id="cl-apagar">🗑 Apagar</button>') + "</div>",
      { titulo: c.novo ? "Novo cliente" : "Cliente: " + nm(c.nome), semRascunho: true, aoFechar: function () { clearTimeout(timer); if (pend) salvar(); if (raiz) fila.then(function () { ver(raiz, P); }); } });
    var el = j.el, timer = null, pend = false, el_ = el;
    function desenharTipos() {
      $("#cl-tipos", el).innerHTML = Object.keys(nomes).map(function (n) {
        return '<label class="marca-linha" style="font-weight:400"><input type="checkbox" data-t="' + esc(n) + '"' + (marcados.indexOf(n) >= 0 ? " checked" : "") + "> " + esc(n) + "</label>";
      }).join("");
      $$("[data-t]", el).forEach(function (cx) { cx.onchange = function () { marcados = $$("[data-t]", el).filter(function (z) { return z.checked; }).map(function (z) { return z.dataset.t; }); agendar(); }; });
    }
    function st(txt, erro) { var s = $("#cl-st", el); s.textContent = txt; s.className = "peq " + (erro ? "" : "mudo"); s.style.color = erro ? "var(--critico,#b00020)" : ""; }
    function salvar() {
      pend = false;
      var nm = $("#cl-nome", el).value.trim();
      if (!nm) { st("Escreva o nome do cliente.", true); return Promise.resolve(false); }
      var k = chave(nm); if (!k) { st("Nome inválido.", true); return Promise.resolve(false); }
      if (!c.k) c.k = k;   // cliente novo: o primeiro nome escrito vira a chave; depois só muda o nome mostrado
      c.nome = nm;
      st("Salvando...");
      return gravar(c, { nome: nm, telefone: $("#cl-tel", el).value.trim() || null, cadastrado_em: $("#cl-desde", el).value || null, tipos: marcados, obs: $("#cl-obs", el).value.trim() || null })
        .then(function () { c.tiposEdit = marcados; st("✓ Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); return true; })
        .catch(function (e) { st("Não salvou: " + A.msgErro(e) + ". Toque em Salvar para tentar de novo.", true); return false; });
    }
    function agendar() { pend = true; clearTimeout(timer); timer = setTimeout(salvar, 600); }
    if (P.ligarNome) { P.ligarNome($("#cl-nome", el)); P.ligarMaiuscula($("#cl-outro", el)); P.ligarMaiuscula($("#cl-obs", el), true); }
    $("#cl-nome", el).value = nm(c.nome); $("#cl-desde", el).value = c.desde || ""; $("#cl-tel", el).value = c.tel || ""; $("#cl-obs", el).value = ob(c.obs);
    desenharTipos();
    ["#cl-desde", "#cl-tel", "#cl-obs", "#cl-nome"].forEach(function (s) { if ($(s, el)) { $(s, el).oninput = agendar; $(s, el).onchange = agendar; } });
    $("#cl-add", el).onclick = function () {
      var n = $("#cl-outro", el).value.trim(); if (!n) return;
      n = n.charAt(0).toUpperCase() + n.slice(1); nomes[n] = 1; if (marcados.indexOf(n) < 0) marcados.push(n);
      $("#cl-outro", el).value = ""; desenharTipos(); agendar();
    };
    if ($("#cl-auto", el)) $("#cl-auto", el).onclick = function () {
      gravar(c, { tipos: null }).then(function () { c.tiposEdit = null; j.fechar(); }).catch(function (e) { st("Não salvou: " + A.msgErro(e), true); });
    };
    if ($("#cl-apagar", el)) $("#cl-apagar", el).onclick = function () {
      var temReg = (c.itens || []).length > 0 || c.cadastro;
      if (c.oculto) { gravar(c, { oculto: false }).then(function () { c.oculto = false; j.fechar(); A.avisar("Cliente de volta na lista", "ok"); }).catch(function (e) { st("Não salvou: " + A.msgErro(e), true); }); return; }
      if (!A.confirmar(temReg
        ? "Apagar " + c.nome + " da lista de Clientes?\n\nOs serviços e orçamentos dele NÃO são apagados: continuam nas abas deles. Só some desta lista (dá para ver de novo em “Mostrar apagados da lista”)."
        : "Apagar " + c.nome + " da lista de Clientes?\n\nEste cadastro não tem serviço nem orçamento, então é apagado de vez.")) return;
      var f = (P.S.fichas || []).filter(function (x) { return x.chave === c.k; })[0];
      clearTimeout(timer); pend = false;
      fila = fila.catch(function () {}).then(function () {
        if (!temReg) return f ? P.q(P.sb.from("clientes_ficha").delete().eq("chave", c.k)).then(function () { P.S.fichas = P.S.fichas.filter(function (x) { return x.chave !== c.k; }); }) : null;
        var d = { chave: c.k, nome: c.nome, oculto: true };
        return P.q(f ? P.sb.from("clientes_ficha").update(d).eq("chave", c.k).select().single() : P.sb.from("clientes_ficha").insert(d).select().single()).then(function (n) { guardarFicha(n); });
      }).then(function () { j.fechar(); A.avisar("Apagado da lista de Clientes", "ok"); }).catch(function (e) { st("Não apagou: " + A.msgErro(e), true); });
    };
    $("#cl-salvar", el).onclick = function () { clearTimeout(timer); salvar(); };
    $("#cl-fechar", el).onclick = function () { j.fechar(); };
  }

  window.AGE_CLI = { ver: ver, _montar: function (ctx) { P = ctx; return montar(); } };
})();
