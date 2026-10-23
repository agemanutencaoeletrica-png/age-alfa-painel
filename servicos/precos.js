// Painel do dono — 💲 PREÇOS: tabela de preços dos serviços de elétrica e de pintura (mão de obra).
// O dono acrescenta, edita e apaga; pode carregar uma lista inicial (precos-base.js: serviços elétricos e a tabela ABRAPP de pintura).
// No orçamento, ao escrever a descrição de um item, os serviços da tabela aparecem como sugestão e trazem a unidade e o preço.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { cat: "eletrica", grupo: "", busca: "", semPreco: false };
  var CATS = { eletrica: "⚡ Elétrica", pintura: "🎨 Pintura" };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function lista() { return (P && P.S.precos) || []; }
  function daCat(cat) {
    return lista().filter(function (x) { return x.ativo !== false && x.categoria === cat; })
      .sort(function (a, b) { return String(a.grupo || "~").localeCompare(String(b.grupo || "~"), "pt") || ordem(a.descricao).localeCompare(ordem(b.descricao), "pt"); });
  }
  // "até 3 m de altura" antes de "acima de 3 m" do mesmo serviço
  function ordem(t) { return String(t || "").replace(" (até 3 m de altura)", " (1").replace(" (acima de 3 m)", " (2"); }
  function preco(x) { return x.valor === null || x.valor === undefined || x.valor === "" ? null : Number(x.valor); }
  function faixa(x) { return x.valor_min || x.valor_max ? A.dinheiro(Number(x.valor_min) || 0) + " a " + A.dinheiro(Number(x.valor_max) || 0) : ""; }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    if (P.S.semPrecos) {
      c.innerHTML = '<div class="cab-secao"><h2>💲 Tabela de preços</h2></div><div class="aviso">Para usar esta parte, rode no Supabase o <b>supabase.sql</b> atualizado (bloco <b>“Tabela de preços”</b>) e depois <code>notify pgrst, \'reload schema\';</code>' +
        (P.S.erroPrecos ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroPrecos) + "</div>" : "") + "</div>";
      return;
    }
    var ls = daCat(filtro.cat), base = (window.AGE_PRECOS_BASE || {})[filtro.cat];
    var grupos = []; ls.forEach(function (x) { var g = x.grupo || "Outros"; if (grupos.indexOf(g) < 0) grupos.push(g); });
    if (filtro.grupo && grupos.indexOf(filtro.grupo) < 0) filtro.grupo = "";
    var faltam = ls.filter(function (x) { return preco(x) === null; }).length;
    c.innerHTML = '<div class="cab-secao"><h2>💲 Tabela de preços</h2><span><button class="prim" id="pc-novo">➕ Novo serviço</button>' +
      (base ? ' <button id="pc-base">📥 Carregar ' + (filtro.cat === "pintura" ? "tabela ABRAPP 2026" : "lista de serviços elétricos") + "</button>" : "") + "</span></div>" +
      '<p class="mudo peq" style="margin-top:-4px">Preço da <b>mão de obra</b> de cada serviço. Acrescente e edite à vontade. No <b>orçamento</b>, ao escrever o item, o serviço aparece como sugestão já com a unidade e o preço.</p>' +
      '<div class="filtros">' + Object.keys(CATS).map(function (k) {
        return '<button class="' + (filtro.cat === k ? "prim" : "") + '" data-pccat="' + k + '">' + CATS[k] + " (" + daCat(k).length + ")</button>";
      }).join("") + "</div>" +
      '<div class="filtros"><select id="pc-grupo" aria-label="Grupo"><option value="">Todos os grupos</option>' + grupos.map(function (g) { return '<option' + (g === filtro.grupo ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("") + "</select>" +
      '<input type="search" id="pc-busca" placeholder="Buscar serviço..." value="' + esc(filtro.busca) + '">' +
      (faltam ? '<label class="marca-linha peq" style="font-weight:400"><input type="checkbox" id="pc-sem"' + (filtro.semPreco ? " checked" : "") + "> Só sem preço (" + faltam + ")</label>" : "") + "</div>" +
      (filtro.cat === "pintura" && ls.some(function (x) { return x.valor_min || x.valor_max; }) ?
        '<div class="aviso peq">Tabela ABRAPP: o preço é a <b>média</b> do mercado. Cobre perto do <b>mínimo</b> em obra simples, rápida e vazia; perto do <b>máximo</b> em obra difícil, alta, longe, com pressa ou cliente exigente.</div>' : "") +
      '<div id="pc-res"></div>';
    $$("[data-pccat]", c).forEach(function (b) { b.onclick = function () { filtro.cat = b.dataset.pccat; filtro.grupo = ""; ver(c, P); }; });
    $("#pc-grupo").onchange = function () { filtro.grupo = this.value; listar(); };
    $("#pc-busca").oninput = function () { filtro.busca = this.value; listar(); };
    if ($("#pc-sem")) $("#pc-sem").onchange = function () { filtro.semPreco = this.checked; listar(); };
    var mudou = function () { ver(c, P); };
    $("#pc-novo").onclick = function () { editar(null, mudou); };
    if ($("#pc-base")) $("#pc-base").onclick = function () { carregarBase(filtro.cat, this, mudou); };
    listar();

    function listar() {
      var b = semAcento(filtro.busca);
      var vs = ls.filter(function (x) {
        if (filtro.grupo && (x.grupo || "Outros") !== filtro.grupo) return false;
        if (filtro.semPreco && preco(x) !== null) return false;
        return !b || semAcento(x.descricao + " " + (x.grupo || "") + " " + (x.obs || "")).indexOf(b) >= 0;
      });
      var r = $("#pc-res"), por = {};
      vs.forEach(function (x) { var g = x.grupo || "Outros"; (por[g] = por[g] || []).push(x); });
      r.innerHTML = vs.length ? Object.keys(por).map(function (g) {
        return '<div class="cartao"><h3 style="margin:0 0 6px">' + esc(g) + ' <span class="mudo peq">(' + por[g].length + ")</span></h3>" +
          '<div class="tabela-caixa"><table><thead><tr><th>Serviço</th><th>Un</th><th class="dir">Preço</th><th></th></tr></thead><tbody>' +
          por[g].map(function (x) {
            var v = preco(x), fx = faixa(x);
            return '<tr data-pc="' + x.id + '" style="cursor:pointer"><td>' + esc(x.descricao) + (x.obs ? '<div class="peq mudo">' + esc(x.obs) + "</div>" : "") + "</td>" +
              "<td>" + esc(x.un || "") + '</td><td class="dir" style="white-space:nowrap">' + (v === null ? '<span class="selo atencao">a definir</span>' : "<b>" + A.dinheiro(v) + "</b>") +
              (fx ? '<div class="peq mudo">' + fx + "</div>" : "") + '</td><td><button class="peq" data-pc-ed="' + x.id + '" aria-label="Editar">✏️</button></td></tr>';
          }).join("") + "</tbody></table></div></div>";
      }).join("") : '<div class="cartao vazio">' + (ls.length ? "Nenhum serviço neste filtro." :
        "Nenhum serviço de " + (filtro.cat === "pintura" ? "pintura" : "elétrica") + " ainda. Toque em ➕ Novo serviço" + (base ? " ou em 📥 Carregar para começar com a lista pronta" : "") + ".") + "</div>";
      $$("[data-pc]", r).forEach(function (tr) { tr.onclick = function () { editar(P.porId(lista(), tr.dataset.pc), mudou); }; });
    }
  }

  // ---------------- ações ----------------
  function carregarBase(cat, botao, mudou) {
    var base = (window.AGE_PRECOS_BASE || {})[cat]; if (!base) return;
    var tem = {}; lista().forEach(function (x) { if (x.categoria === cat) tem[semAcento(x.descricao)] = 1; });
    var novos = base.itens.filter(function (x) { return !tem[semAcento(x.descricao)]; });
    if (!novos.length) { A.avisar("Todos os serviços da lista já estão na tabela.", "ok"); return; }
    var comPreco = novos.filter(function (x) { return x.valor !== null && x.valor !== undefined; }).length;
    if (!A.confirmar("Carregar " + novos.length + " serviço(s) da " + base.nome + "?\n" + comPreco + " já vêm com preço" +
      (novos.length - comPreco ? " e " + (novos.length - comPreco) + " ficam “a definir” para você preencher" : "") +
      ".\nOs que você já tem na tabela não são repetidos nem alterados.")) return;
    var linhas = novos.map(function (x) {
      return { categoria: cat, grupo: x.grupo, descricao: x.descricao, un: x.un || "un", valor: x.valor === undefined ? null : x.valor,
        valor_min: x.valor_min || null, valor_max: x.valor_max || null, fonte: base.fonte };
    });
    A.ocupado(botao, true, "Carregando...");
    var lotes = []; for (var i = 0; i < linhas.length; i += 100) lotes.push(linhas.slice(i, i + 100));
    lotes.reduce(function (pr, lote) {
      return pr.then(function () { return P.q(P.sb.from("precos").insert(lote).select()).then(function (ns) { ns.forEach(function (n) { P.trocar(P.S.precos, n); }); }); });
    }, Promise.resolve()).then(function () { A.avisar(linhas.length + " serviço(s) carregado(s)", "ok"); mudou(); })
      .catch(function (e) { A.ocupado(botao, false); P.falhou(e); mudou(); });
  }

  function editar(x, mudou) {
    var novo = !x;
    x = x || { categoria: filtro.cat, grupo: filtro.grupo || "", descricao: "", un: "un", valor: null, valor_min: null, valor_max: null, obs: "" };
    var grupos = []; lista().forEach(function (y) { if (y.grupo && grupos.indexOf(y.grupo) < 0) grupos.push(y.grupo); });
    var uns = P.UNIDADES.concat(["km"]); if (x.un && uns.indexOf(x.un) < 0) uns.push(x.un);
    var j = A.janela(
      '<div class="duas"><div><label for="pc-cat">Área</label><select id="pc-cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + CATS[k] + "</option>"; }).join("") + "</select></div>" +
      '<div><label for="pc-gr">Grupo</label><input id="pc-gr" list="pc-dl-gr" maxlength="120" placeholder="Ex.: Tomadas e interruptores"><datalist id="pc-dl-gr">' +
      grupos.map(function (g) { return '<option value="' + esc(g) + '">'; }).join("") + "</datalist></div></div>" +
      '<label for="pc-desc">Serviço *</label><input id="pc-desc" maxlength="300" placeholder="Ex.: Instalação de tomada">' +
      '<div class="duas"><div><label for="pc-un">Unidade</label><select id="pc-un">' + uns.map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("") + "</select></div>" +
      '<div><label for="pc-val">Preço (R$)</label><input id="pc-val" inputmode="decimal" placeholder="vazio = a definir"></div></div>' +
      '<div class="duas"><div><label for="pc-min">Mínimo (R$, opcional)</label><input id="pc-min" inputmode="decimal"></div><div><label for="pc-max">Máximo (R$, opcional)</label><input id="pc-max" inputmode="decimal"></div></div>' +
      '<div id="pc-faixa" class="acoes"></div>' +
      '<label for="pc-obs">Observação</label><input id="pc-obs" maxlength="300" placeholder="Ex.: material não incluso, acima de 3 m...">' +
      '<div class="acoes"><button class="prim" id="pc-salvar">Salvar</button>' + (novo ? "" : '<button class="perigo" id="pc-apagar">Apagar</button>') + "</div>" +
      (x.fonte ? '<p class="peq mudo">Origem: ' + esc(x.fonte) + "</p>" : ""),
      { titulo: novo ? "Novo serviço" : "Editar serviço" });
    var el = j.el, num = function (v) { return v === null || v === undefined || v === "" ? "" : A.numero(Number(v)); };
    $("#pc-cat", el).value = x.categoria; $("#pc-gr", el).value = x.grupo || ""; $("#pc-desc", el).value = x.descricao || ""; $("#pc-un", el).value = x.un || "un";
    $("#pc-val", el).value = num(x.valor); $("#pc-min", el).value = num(x.valor_min); $("#pc-max", el).value = num(x.valor_max); $("#pc-obs", el).value = x.obs || "";
    // atalhos: usar o mínimo / a média / o máximo da faixa como preço
    function atalhos() {
      var mn = A.lerNumero($("#pc-min", el).value), mx = A.lerNumero($("#pc-max", el).value), f = $("#pc-faixa", el);
      if (!(mn > 0 && mx > 0)) { f.innerHTML = ""; return; }
      var md = Math.round((mn + mx) / 2 * 100) / 100;
      f.innerHTML = '<span class="peq mudo">Usar como preço:</span>' + [["Mínimo", mn], ["Meio da faixa", md], ["Máximo", mx]].map(function (o) {
        return '<button class="peq" data-pc-usa="' + o[1] + '">' + o[0] + " " + A.dinheiro(o[1]) + "</button>";
      }).join("");
      $$("[data-pc-usa]", f).forEach(function (b) { b.onclick = function () { $("#pc-val", el).value = A.numero(Number(b.dataset.pcUsa)); }; });
    }
    $("#pc-min", el).oninput = $("#pc-max", el).oninput = atalhos; atalhos();
    $("#pc-salvar", el).onclick = function () {
      var desc = $("#pc-desc", el).value.trim();
      if (!desc) { A.avisar("Escreva o nome do serviço.", "erro"); return; }
      var lido = function (id) { var t = $(id, el).value.trim(); return t ? Math.round(A.lerNumero(t) * 100) / 100 : null; };
      var d = { categoria: $("#pc-cat", el).value, grupo: P.nulo($("#pc-gr", el).value.trim()), descricao: desc, un: $("#pc-un", el).value,
        valor: lido("#pc-val"), valor_min: lido("#pc-min"), valor_max: lido("#pc-max"), obs: P.nulo($("#pc-obs", el).value.trim()), atualizado_em: new Date().toISOString() };
      var igual = lista().filter(function (y) { return y.id !== x.id && y.categoria === d.categoria && semAcento(y.descricao) === semAcento(desc); })[0];
      if (igual && !A.confirmar("Já existe “" + igual.descricao + "” nesta área. Salvar mesmo assim?")) return;
      var b = this; A.ocupado(b, true, "Salvando...");
      var pr = novo ? P.sb.from("precos").insert(d).select().single() : P.sb.from("precos").update(d).eq("id", x.id).select().single();
      P.q(pr).then(function (n) { P.trocar(P.S.precos, n); filtro.cat = n.categoria; j.fechar(); A.avisar("Salvo", "ok"); mudou(); })
        .catch(function (e) { A.ocupado(b, false); P.falhou(e); });
    };
    if ($("#pc-apagar", el)) $("#pc-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar “" + x.descricao + "” da tabela de preços?")) return;
      P.q(P.sb.from("precos").delete().eq("id", x.id)).then(function () { P.tirar(P.S.precos, x.id); j.fechar(); mudou(); }).catch(P.falhou);
    };
  }

  // ---------------- para o orçamento ----------------
  // serviços da área do orçamento (elétrica e pintura juntos quando a área é as duas ou está em branco)
  function paraOrcamento(S, cat) {
    var cs = cat === "eletrica" || cat === "pintura" ? [cat] : ["eletrica", "pintura"];
    return (S.precos || []).filter(function (x) { return x.ativo !== false && cs.indexOf(x.categoria) >= 0; });
  }
  function acharServico(S, cat, desc) {
    var d = semAcento(desc); if (!d) return null;
    return paraOrcamento(S, cat).filter(function (x) { return semAcento(x.descricao) === d; })[0] || null;
  }

  window.AGE_PRECOS = { ver: ver, paraOrcamento: paraOrcamento, acharServico: acharServico };
})();
