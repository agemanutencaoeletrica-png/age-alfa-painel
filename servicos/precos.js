// Painel do dono — 💲 PREÇOS: tabela de preços dos serviços de elétrica e de pintura (mão de obra).
// O dono acrescenta, edita e apaga; pode carregar uma lista inicial (precos-base.js: serviços elétricos e a tabela ABRAPP de pintura).
// No orçamento, ao escrever a descrição de um item, os serviços da tabela aparecem como sugestão e trazem a unidade e o preço.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { cat: "eletrica", grupo: "", busca: "", semPreco: false, tipo: "" };
  function ehMaterial(x) { return /^Materiais/.test(String(x.grupo || "")); }
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
    var ls = daCat(filtro.cat).filter(function (x) { return !filtro.tipo || (filtro.tipo === "mat") === ehMaterial(x); }),
      base = (window.AGE_PRECOS_BASE || {})[filtro.cat], baseMat = (window.AGE_MATERIAIS_BASE || {})[filtro.cat];
    var grupos = []; ls.forEach(function (x) { var g = x.grupo || "Outros"; if (grupos.indexOf(g) < 0) grupos.push(g); });
    if (filtro.grupo && grupos.indexOf(filtro.grupo) < 0) filtro.grupo = "";
    var faltam = ls.filter(function (x) { return preco(x) === null; }).length;
    c.innerHTML = '<div class="cab-secao"><h2>💲 Tabela de preços</h2><span><button class="prim" id="pc-loja">📥 Lançar orçamento da loja</button> <button id="pc-novo">➕ Novo serviço</button>' +
      (base ? ' <button id="pc-base">📥 Carregar ' + (filtro.cat === "pintura" ? "tabela ABRAPP 2026" : "lista de serviços elétricos") + "</button>" : "") +
      (baseMat ? ' <button id="pc-base-mat">📥 Carregar lista de materiais (' + baseMat.itens.length + ")</button>" : "") +
      ' <button id="pc-ch">📊 O que os chamados pedem</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Preço da <b>mão de obra</b> de cada serviço. Acrescente e edite à vontade. No <b>orçamento</b>, ao escrever o item, o serviço aparece como sugestão já com a unidade e o preço.</p>' +
      '<div class="filtros">' + Object.keys(CATS).map(function (k) {
        return '<button class="' + (filtro.cat === k ? "prim" : "") + '" data-pccat="' + k + '">' + CATS[k] + " (" + daCat(k).length + ")</button>";
      }).join("") + "</div>" +
      '<div class="filtros">' + [["", "Tudo"], ["serv", "🔧 Serviços (mão de obra)"], ["mat", "🧱 Materiais"]].map(function (f) {
        return '<button class="' + (filtro.tipo === f[0] ? "prim" : "") + '" data-pctipo="' + f[0] + '">' + f[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="filtros"><select id="pc-grupo" aria-label="Grupo"><option value="">Todos os grupos</option>' + grupos.map(function (g) { return '<option' + (g === filtro.grupo ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("") + "</select>" +
      '<input type="search" id="pc-busca" placeholder="Buscar serviço..." value="' + esc(filtro.busca) + '">' +
      (faltam ? '<label class="marca-linha peq" style="font-weight:400"><input type="checkbox" id="pc-sem"' + (filtro.semPreco ? " checked" : "") + "> Só sem preço (" + faltam + ")</label>" : "") + "</div>" +
      (filtro.cat === "pintura" && ls.some(function (x) { return x.valor_min || x.valor_max; }) ?
        '<div class="aviso peq">Tabela ABRAPP: o preço é a <b>média</b> do mercado. Cobre perto do <b>mínimo</b> em obra simples, rápida e vazia; perto do <b>máximo</b> em obra difícil, alta, longe, com pressa ou cliente exigente.</div>' : "") +
      '<div id="pc-res"></div>';
    $$("[data-pccat]", c).forEach(function (b) { b.onclick = function () { filtro.cat = b.dataset.pccat; filtro.grupo = ""; ver(c, P); }; });
    $$("[data-pctipo]", c).forEach(function (b) { b.onclick = function () { filtro.tipo = b.dataset.pctipo; filtro.grupo = ""; ver(c, P); }; });
    $("#pc-grupo").onchange = function () { filtro.grupo = this.value; listar(); };
    $("#pc-busca").oninput = function () { filtro.busca = this.value; listar(); };
    if ($("#pc-sem")) $("#pc-sem").onchange = function () { filtro.semPreco = this.checked; listar(); };
    var mudou = function () { ver(c, P); };
    $("#pc-novo").onclick = function () { editar(null, mudou); };
    $("#pc-loja").onclick = function () { lancarLoja(mudou); };
    if ($("#pc-base")) $("#pc-base").onclick = function () { carregarBase(filtro.cat, this, mudou); };
    if ($("#pc-base-mat")) $("#pc-base-mat").onclick = function () { carregarBase(filtro.cat, this, mudou, window.AGE_MATERIAIS_BASE); };
    $("#pc-ch").onclick = function () { verChamados(filtro.cat, mudou); };
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
            var v = preco(x), fx = faixa(x), rh = ehMaterial(x) ? resumoHist(P.S, x.descricao) : null;
            return '<tr data-pc="' + x.id + '" style="cursor:pointer"><td>' + esc(x.descricao) + (x.obs ? '<div class="peq mudo">' + esc(x.obs) + "</div>" : "") + "</td>" +
              "<td>" + esc(x.un || "") + '</td><td class="dir" style="white-space:nowrap">' + (v === null ? '<span class="selo atencao">a definir</span>' : "<b>" + A.dinheiro(v) + "</b>") +
              (fx ? '<div class="peq mudo">' + fx + "</div>" : "") +
              (rh && rh.n > 1 ? '<div class="peq mudo">📈 ' + rh.n + " preços · menor " + esc(textoPreco(rh.menor)) + "</div>" : "") + '</td><td><button class="peq" data-pc-ed="' + x.id + '" aria-label="Editar">✏️</button></td></tr>';
          }).join("") + "</tbody></table></div></div>";
      }).join("") : '<div class="cartao vazio">' + (ls.length ? "Nenhum serviço neste filtro." :
        "Nenhum serviço de " + (filtro.cat === "pintura" ? "pintura" : "elétrica") + " ainda. Toque em ➕ Novo serviço" + (base ? " ou em 📥 Carregar para começar com a lista pronta" : "") + ".") + "</div>";
      $$("[data-pc]", r).forEach(function (tr) { tr.onclick = function () { editar(P.porId(lista(), tr.dataset.pc), mudou); }; });
    }
  }

  // ---------------- ações ----------------
  function carregarBase(cat, botao, mudou, fonte) {
    var base = (fonte || window.AGE_PRECOS_BASE || {})[cat]; if (!base) return;
    var tem = {}; lista().forEach(function (x) { if (x.categoria === cat) tem[semAcento(x.descricao)] = 1; });
    var novos = base.itens.filter(function (x) { return !tem[semAcento(x.descricao)]; });
    if (!novos.length) { A.avisar("Todos os itens da lista já estão na tabela.", "ok"); return; }
    var comPreco = novos.filter(function (x) { return x.valor !== null && x.valor !== undefined; }).length;
    if (!A.confirmar("Carregar " + novos.length + " item(ns) da " + base.nome + "?\n" + comPreco + " já vêm com preço" +
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
    }, Promise.resolve()).then(function () { A.avisar(linhas.length + " item(ns) carregado(s)", "ok"); mudou(); })
      .catch(function (e) { A.ocupado(botao, false); P.falhou(e); mudou(); });
  }

  function editar(x, mudou, inicial) {
    var novo = !x;
    x = x || Object.assign({ categoria: filtro.cat, grupo: filtro.grupo || "", descricao: "", un: "un", valor: null, valor_min: null, valor_max: null, obs: "" }, inicial || {});
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
      (x.fonte ? '<p class="peq mudo">Origem: ' + esc(x.fonte) + "</p>" : "") + (novo ? "" : htmlHistorico(P.S, x.descricao)),
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

  // ---------------- o que os chamados pedem ----------------
  // Lê a descrição de cada chamado (serviços do painel) e conta os tipos de serviço pedidos.
  // Um chamado pode pedir mais de um tipo (ex.: "tomada e cabeamento para as máquinas").
  // [nome, regra na descrição, palavra para achar o preço na tabela, grupo e unidade para criar o preço]
  var TIPOS_CH = {
    eletrica: [
      ["Ventiladores", /ventilador/, "ventilador", "Equipamentos", "un"],
      ["Tomadas (instalar / acrescentar / trocar)", /tomada/, "tomada", "Tomadas e interruptores", "un"],
      ["Interruptores", /interruptor/, "interruptor", "Tomadas e interruptores", "un"],
      ["Luminárias e lâmpadas (queimadas, novas)", /lumin[aá]ri|l[aâ]mpada|ilumina|refletor|plafon|\bled\b|spot/, "lumin", "Iluminação", "un"],
      ["Reator / driver", /reator|driver/, "reator", "Iluminação", "un"],
      ["Iluminação de emergência", /emerg[eê]ncia/, "emerg", "Iluminação", "un"],
      ["Sensor / fotocélula / relé", /sensor|fotoc[eé]lula|\brel[eé]\b|timer|temporizador/, "sensor", "Iluminação", "un"],
      ["Disjuntor / quadro elétrico", /disjuntor|quadro|\bdr\b|\bdps\b|barramento/, "quadro", "Quadros e proteção", "un"],
      ["Cabeamento / fiação / circuito", /cabeamento|cabiamento|\bcabos?\b|fia[cç][aã]o|\bfios?\b|circuito/, "circuito", "Circuitos e cabos", "m"],
      ["Infra (eletroduto, eletrocalha, canaleta)", /eletroduto|eletrocalha|perfilado|canaleta|tubula[cç]|\btubo/, "infra", "Infraestrutura", "m"],
      ["Falta de energia / curto / disjuntor desarmando", /curto|sem energia|falta de energia|queda de energia|desarm|\bpane\b|n[aã]o liga|parou de funcionar|faisca|fa[ií]sca|queimad[oa] (o|a) (fio|cabo)|cheiro de queimado|oscila/, "curto", "Serviços gerais", "un"],
      ["Portão eletrônico / automático", /port[aã]o (eletr|autom)|motor do port/, "port", "Equipamentos", "un"],
      ["Chuveiro", /chuveiro/, "chuveiro", "Equipamentos", "un"],
      ["Ar-condicionado", /ar[\s-]*condicionado|\bsplit\b/, "ar-condicionado", "Equipamentos", "un"],
      ["Exaustor / coifa", /exaust|coifa/, "exaustor", "Equipamentos", "un"],
      ["Ligação de máquina / equipamento (balcão, freezer, forno...)", /m[aá]quina|balc[aã]o|freezer|geladeira|c[aâ]mara fria|forno|motor|bomba|equipamento|empilhadeira|carregador/, "ligação", "Equipamentos", "un"],
      ["Letreiro / fachada", /letreiro|fachada|placa luminosa|luminoso/, "letreiro", "Iluminação", "un"],
      ["Padrão / medidor / entrada de energia", /padr[aã]o|medidor|cemig|entrada de energia|transformador/, "padrão", "Entrada e aterramento", "un"],
      ["Aterramento / para-raios", /aterramento|spda|para[\s-]*raio/, "aterramento", "Entrada e aterramento", "un"],
      ["Câmeras / rede / interfone", /c[aâ]mera|cftv|\brede\b|internet|l[oó]gica|interfone|campainha|alarme/, "rede", "Circuitos e cabos", "un"]
    ],
    pintura: [
      ["Demarcação / faixas / sinalização de piso", /demarca|faixa|zebrad|sinaliza|\bvagas?\b|\bpare\b|seta/, "demarca", "Piso e demarcação", "m"],
      ["Pintura de piso", /piso|ch[aã]o|epóxi|epoxi/, "piso", "Piso e demarcação", "m²"],
      ["Pintura de parede / teto / muro", /parede|teto|muro|forro|alvenaria|fachada|sala|banheiro|deposito|dep[oó]sito/, "látex", "Alvenarias e paredes", "m²"],
      ["Portão / grade / estrutura metálica", /port[aã]o|grade|corrim[aã]o|guarda[\s-]*corpo|estrutura|met[aá]lic|ferro|pilar|coluna|porta[\s-]*palete|prateleira|g[oô]ndola/, "esmalte", "Esmaltes, verniz e epóxi", "m²"],
      ["Porta / janela", /\bportas?\b(?![\s-]*palete)|janela|batente/, "porta", "Madeira e metal – imobiliário (manutenção leve)", "un"],
      ["Massa / reparo / trinca / infiltração", /massa|reboco|trinca|fissura|rachadura|infiltra|mofo|umidade|descascad|reparo|retoque/, "massa", "Massas e preenchimentos", "m²"],
      ["Textura / grafiato", /textura|grafiato/, "textura", "Texturas", "m²"],
      ["Telhado / calha", /telhado|telha|calha|rufo/, "calha", "Serviços diversos", "m"],
      ["Impermeabilização", /impermeabiliza|manta|laje/, "impermeabil", "Impermeabilização", "m²"]
    ]
  };
  function verChamados(cat, mudou) {
    var S = P.S, tipos = TIPOS_CH[cat];
    var ls = (S.serv || []).filter(function (sv) {
      var o = P.porId(S.obras || [], sv.obra_id);
      return sv.categoria === cat && o && !o.prefeitura_id && (sv.descricao || "").trim();
    });
    var res = tipos.map(function (t) { return { t: t, ch: [] }; }), fora = [];
    ls.forEach(function (sv) {
      var d = semAcento(sv.descricao).replace(/\s+/g, " "), achou = false;
      // ignora o "(fazer orçamento)" do começo para não confundir com o tipo do serviço
      res.forEach(function (r) { if (r.t[1].test(d)) { r.ch.push(sv); achou = true; } });
      if (!achou) fora.push(sv);
    });
    res = res.filter(function (r) { return r.ch.length; }).sort(function (a, b) { return b.ch.length - a.ch.length; });
    var precosCat = daCat(cat);
    function precoDo(t) { var k = semAcento(t[2]); return precosCat.filter(function (x) { return semAcento(x.descricao).indexOf(k) >= 0; }); }
    function obraDe(sv) { return P.porId(S.obras || [], sv.obra_id) || {}; }
    // valor da OS no portal do cliente quando o chamado só pede um tipo de serviço (referência do que já foi cobrado)
    function cobrado(r) {
      var vs = r.ch.filter(function (sv) { var o = obraDe(sv); return o.portal && Number(o.portal.valor) > 0 && res.filter(function (x) { return x.ch.indexOf(sv) >= 0; }).length === 1; })
        .map(function (sv) { return Number(obraDe(sv).portal.valor); });
      if (!vs.length) return "";
      var med = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
      return '<div class="peq">💼 Valor da OS no portal (' + vs.length + " chamado" + (vs.length > 1 ? "s" : "") + "): média <b>" + A.dinheiro(med) + "</b>" +
        (vs.length > 1 ? " · de " + A.dinheiro(Math.min.apply(null, vs)) + " a " + A.dinheiro(Math.max.apply(null, vs)) : "") + "</div>";
    }
    function exemplo(sv) {
      var o = obraDe(sv);
      return '<li class="peq">' + esc((o.chamado ? "nº " + o.chamado + " · " : "") + (o.cliente || "") + (sv.criado_em ? " · " + A.dataSimples(String(sv.criado_em).slice(0, 10)) : "")) + ": <i>" + esc(String(sv.descricao).slice(0, 160)) + "</i></li>";
    }
    var j = A.janela(
      '<p class="mudo peq" style="margin-top:0">O app leu a descrição de <b>' + ls.length + " chamado(s)</b> de " + (cat === "pintura" ? "pintura" : "elétrica") +
      " e separou pelo tipo de serviço pedido (um chamado pode entrar em mais de um tipo). Ao lado, o preço que está na sua tabela — os que faltam você cria com um toque.</p>" +
      (ls.length ? "" : '<div class="aviso">Nenhum chamado de ' + (cat === "pintura" ? "pintura" : "elétrica") + " com descrição no painel.</div>") +
      res.map(function (r, n) {
        var pcs = precoDo(r.t), comValor = pcs.filter(function (x) { return preco(x) !== null; });
        return '<div class="cartao"><div class="linha"><h3 style="margin:0">' + esc(r.t[0]) + '</h3><span class="selo">' + r.ch.length + " chamado" + (r.ch.length > 1 ? "s" : "") + "</span>" +
          (comValor.length ? '<span class="selo bom">💲 ' + comValor.slice(0, 2).map(function (x) { return esc(x.descricao) + " " + A.dinheiro(preco(x)) + "/" + esc(x.un); }).join(" · ") + (comValor.length > 2 ? " +" + (comValor.length - 2) : "") + "</span>" :
            '<span class="selo atencao">' + (pcs.length ? "na tabela, mas sem preço" : "sem preço na tabela") + "</span>") + "</div>" +
          cobrado(r) + "<ul style=\"margin:6px 0 0;padding-left:18px\">" + r.ch.slice(0, 3).map(exemplo).join("") + "</ul>" +
          (r.ch.length > 3 ? '<details><summary class="peq">ver os outros ' + (r.ch.length - 3) + '</summary><ul style="margin:4px 0 0;padding-left:18px">' + r.ch.slice(3, 60).map(exemplo).join("") + "</ul></details>" : "") +
          '<div class="acoes"><button class="peq" data-ch-criar="' + n + '">➕ Criar preço para “' + esc(r.t[0].split(" (")[0]) + "”</button></div></div>";
      }).join("") +
      (fora.length ? '<div class="cartao"><h3 style="margin:0">Outros (' + fora.length + ')</h3><p class="peq mudo">Chamados que não se encaixaram nos tipos acima — confira se algum serviço merece entrar na tabela.</p><ul style="margin:6px 0 0;padding-left:18px">' +
        fora.slice(0, 80).map(exemplo).join("") + "</ul></div>" : ""),
      { titulo: "📊 O que os chamados pedem — " + (cat === "pintura" ? "pintura" : "elétrica"), larga: true });
    $$("[data-ch-criar]", j.el).forEach(function (b) {
      b.onclick = function () {
        var t = res[Number(b.dataset.chCriar)].t;
        j.fechar();
        editar(null, mudou, { categoria: cat, grupo: t[3], descricao: t[0].split(" (")[0], un: t[4] });
      };
    });
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

  // ---------------- 📈 preços das lojas: acervo + histórico ----------------
  var GRUPO_NOTA = "Materiais (das notas e orçamentos das lojas)";
  function chaveMat(t) { return semAcento(t).replace(/\s+/g, " ").trim(); }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  // materiais das notas em 🧾 Compras por nome (refeito só quando as compras mudam)
  var idxC = { sig: null, m: {} };
  function indiceCompras(S) {
    var cs = S.compras || [], sig = cs.map(function (c) { return c.id + ":" + (c.itens || []).length + ":" + c.valor; }).join("|");
    if (idxC.sig === sig) return idxC.m;
    var m = {};
    cs.forEach(function (c) {
      if (c.tipo === "despesa") return;
      (c.itens || []).forEach(function (y) {
        var u = Number(y.unit) || (y.qtd > 0 && y.valor ? y.valor / y.qtd : 0), k = chaveMat(y.item);
        if (k && u > 0) (m[k] = m[k] || []).push({ loja: c.fornecedor || "", data: String(c.comprado_em || "").slice(0, 10), valor: Math.round(u * 100) / 100, un: y.un, origem: "nota" });
      });
    });
    idxC = { sig: sig, m: m };
    return m;
  }
  // todos os preços de loja do material (orçamentos de loja lançados + notas em 🧾 Compras), do mais novo para o mais antigo
  function historico(S, desc) {
    var k = chaveMat(desc), vistos = {}, h = [];
    if (!k) return h;
    function por(x) { var id = x.loja + "|" + x.data + "|" + x.valor; if (vistos[id]) return; vistos[id] = 1; h.push(x); }
    (S.precosHist || []).forEach(function (x) { if (x.chave === k) por({ loja: x.loja || "", data: String(x.data).slice(0, 10), valor: Number(x.valor), un: x.un, origem: x.origem, documento: x.documento }); });
    (indiceCompras(S)[k] || []).forEach(por);
    return h.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) || a.valor - b.valor; });
  }
  // { ultimo, menor, n } para mostrar ao lado do material
  function resumoHist(S, desc) {
    var h = historico(S, desc); if (!h.length) return null;
    var menor = h.slice().sort(function (a, b) { return a.valor - b.valor; })[0];
    return { ultimo: h[0], menor: menor, n: h.length };
  }
  function textoPreco(x) { return A.dinheiro(x.valor) + (x.loja ? " " + x.loja : "") + (x.data ? " " + A.dataSimples(x.data) : ""); }
  // guarda o que a loja passou: material novo entra no acervo (💲 tabela), o que já tem fica com o preço mais novo, e todo preço vai
  // para o histórico (o mesmo orçamento lançado de novo não repete). lista: [{descricao, un, unit}]; info: {loja, cnpj, data, numero, origem}
  // devolve { linhas: [{descricao, un, valor, situacao: novo|atualizado|igual|antigo|servico, antes}], novos, atualizados, semHist }
  function guardarDaLoja(P, lista, cat, info) {
    var S = P.S; info = info || {};
    if ((cat !== "eletrica" && cat !== "pintura") || S.semPrecos) return Promise.resolve({ linhas: [], novos: 0, atualizados: 0 });
    var data = String(info.data || hoje()).slice(0, 10), loja = String(info.loja || "").trim().slice(0, 120);
    var obs = ("Preço da loja" + (loja ? " " + loja : "") + " em " + A.dataSimples(data)).slice(0, 300);
    var novos = [], mudar = [], hist = [], linhas = [], vistos = {};
    lista.forEach(function (x) {
      var v = Math.round((Number(x.unit) || 0) * 100) / 100, d = String(x.descricao || "").replace(/\s+/g, " ").trim(), k = chaveMat(d);
      if (!(v > 0) || d.length < 3 || vistos[k]) return;
      vistos[k] = 1;
      var ja = acharServico(S, cat, d), ant = resumoHist(S, d), l = { descricao: d, un: x.un || "un", valor: v, antes: ant ? ant.ultimo : null };
      if (!ja) { l.situacao = "novo"; novos.push({ categoria: cat, grupo: GRUPO_NOTA, descricao: d.slice(0, 300), un: x.un || "un", valor: v, obs: obs, fonte: "Nota" }); }
      else if (!ehMaterial(ja) && ja.fonte !== "Nota") l.situacao = "servico";   // nome igual a um serviço (mão de obra): não mexe
      else {
        if (!l.antes && preco(ja) !== null) l.antes = { valor: preco(ja), loja: "", data: String(ja.atualizado_em || "").slice(0, 10) };
        // (atualizado vira fonte "Nota": o preço com acréscimo do orçamento do cliente não sobrescreve o da loja)
        // preço mais antigo que o último guardado (orçamento velho lançado agora) vai só para o histórico
        if (ant && ant.ultimo.data > data) l.situacao = "antigo";
        else if (preco(ja) === v) l.situacao = "igual";
        else { l.situacao = "atualizado"; mudar.push({ id: ja.id, valor: v }); }
      }
      linhas.push(l);
      hist.push({ categoria: cat, descricao: d.slice(0, 300), chave: k, un: x.un || "un", valor: v, loja: loja, cnpj: info.cnpj || null, data: data, origem: info.origem || "orcamento_loja", documento: info.numero || null });
    });
    var ps = [], r = { linhas: linhas, novos: novos.length, atualizados: mudar.length, semHist: false };
    for (var i = 0; i < novos.length; i += 100) ps.push(P.q(P.sb.from("precos").insert(novos.slice(i, i + 100)).select()).then(function (ns) { ns.forEach(function (n) { P.trocar(S.precos, n); }); }));
    mudar.forEach(function (m) {
      ps.push(P.q(P.sb.from("precos").update({ valor: m.valor, obs: obs, fonte: "Nota", atualizado_em: new Date().toISOString() }).eq("id", m.id).select().single()).then(function (n) { P.trocar(S.precos, n); }));
    });
    // histórico: sem a tabela (supabase.sql não rodado), o acervo salva do mesmo jeito e avisa
    if (hist.length) ps.push(P.q(P.sb.from("precos_historico").upsert(hist, { onConflict: "chave,loja,data,valor", ignoreDuplicates: true }).select())
      .then(function (ns) { S.precosHist = (S.precosHist || []).concat(ns || []); S.semHist = false; }, function () { S.semHist = true; r.semHist = true; }));
    return Promise.all(ps).then(function () { return r; });
  }
  var SIT = { novo: ["🆕 novo no acervo", "bom"], atualizado: ["🔄 preço atualizado", "atencao"], igual: ["= mesmo preço", ""], antigo: ["📜 só no histórico (preço mais antigo)", ""], servico: ["serviço com o mesmo nome (não mexi)", ""] };
  function htmlResultado(r) {
    return '<div class="tabela-caixa"><table><thead><tr><th>Material</th><th>Un</th><th class="num">Preço</th><th class="num">Antes</th><th>No acervo</th></tr></thead><tbody>' +
      r.linhas.map(function (l) {
        var st = SIT[l.situacao] || [l.situacao, ""], a = l.antes, dif = a && a.valor ? Math.round((l.valor - a.valor) / a.valor * 100) : 0;
        return "<tr><td>" + esc(l.descricao) + "</td><td>" + esc(l.un) + '</td><td class="num"><b>' + A.dinheiro(l.valor) + '</b></td><td class="num peq">' +
          (a ? esc(textoPreco(a)) + (dif ? ' <span class="selo ' + (dif > 0 ? "critico" : "bom") + '">' + (dif > 0 ? "+" : "") + dif + "%</span>" : "") : "—") +
          '</td><td><span class="selo ' + st[1] + '">' + st[0] + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  // nº do orçamento da loja no texto ("ORÇAMENTO Nº: 14/034/035877")
  function numeroOrc(t) { var m = /or[cç]amento\s*(?:n[ºo°.]*|n[uú]mero)\s*:?\s*([A-Z0-9][\w\/.-]{2,30})/i.exec(String(t || "")); return m ? m[1] : null; }
  // loja pelo CNPJ: a já cadastrada, a de uma nota anterior ou o cadastro público
  function nomeLoja(S, d) {
    if (d.fornecedor) return Promise.resolve(d.fornecedor);
    var F = window.AGE_FORN, cj = String(d.cnpj || "").replace(/\D/g, "");
    if (!cj) return Promise.resolve("");
    var f = F && F.achar(S, d.cnpj, null); if (f) return Promise.resolve(f.nome);
    var ant = (S.compras || []).filter(function (x) { return x.fornecedor && String(x.cnpj || "").replace(/\D/g, "") === cj; })[0]; if (ant) return Promise.resolve(ant.fornecedor);
    var ja = (S.precosHist || []).filter(function (x) { return x.loja && String(x.cnpj || "").replace(/\D/g, "") === cj; })[0]; if (ja) return Promise.resolve(ja.loja);
    return (F ? F.consultar(d.cnpj) : Promise.resolve(null)).then(function (c) { return (c && c.nome) || "CNPJ " + d.cnpj; }, function () { return "CNPJ " + d.cnpj; });
  }

  // 📥 lançar orçamento (ou nota) da loja direto no acervo: PDF e XML salvam sozinhos; foto passa antes pela conferência
  function lancarLoja(mudou) {
    var CP = window.AGE_COMPRAS;
    if (!CP) { A.avisar("O leitor de notas não carregou. Recarregue a página.", "erro"); return; }
    var fechou = false;
    var j = A.janela('<p class="peq mudo" style="margin-top:0">Escolha o <b>orçamento da loja</b> (PDF, foto ou o XML da nota). Pode escolher vários de uma vez. ' +
      "Os materiais que ainda não estão no acervo entram, os que já estão ficam com o <b>preço mais novo</b> e todo preço fica no <b>📈 histórico</b> (loja e data).</p>" +
      '<div class="acoes" style="margin-top:0"><button class="prim" id="ll-arq-b">📄 Escolher arquivo(s)</button></div>' +
      '<input type="file" id="ll-arq" multiple accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml" class="oculto"><div id="ll-res"></div>',
      { titulo: "📥 Lançar orçamento da loja", larga: true, aoFechar: function () { fechou = true; mudou(); } });
    $("#ll-arq-b", j.el).onclick = function () { $("#ll-arq", j.el).value = ""; $("#ll-arq", j.el).click(); };
    $("#ll-arq", j.el).onchange = function () { var fs = Array.prototype.slice.call(this.files || []); if (fs.length) lancarArquivos(fs, j.el); };
    function lancarArquivos(fs, el) {
      var res = $("#ll-res", el);
      fs.reduce(function (pr, f) {
        return pr.then(function () {
          var cx = document.createElement("div"); cx.className = "cartao"; cx.style.marginTop = "8px"; res.insertBefore(cx, res.firstChild);
          cx.innerHTML = '<span class="carregando"></span> Lendo ' + esc(f.name) + "...";
          return CP.lerUmaNota(f, function (t) { cx.textContent = t; }).then(function (rl) {
            var d = rl.dados || {}, itens = (d.itens || []).map(function (x) {
              var qtd = Number(x.qtd) || 1;
              return { descricao: String(x.item || "").replace(/\s+/g, " ").trim(), un: String(x.un || "un").toLowerCase().replace(/\.$/, ""), qtd: qtd, unit: Number(x.unit) || (Number(x.valor) > 0 ? Math.round(x.valor / qtd * 100) / 100 : 0), ok: true };
            }).filter(function (x) { return x.descricao; });
            if (!itens.length) { cx.innerHTML = "<b>" + esc(f.name) + '</b>: <span class="selo critico">não achei materiais com preço</span> <span class="peq mudo">Tente o PDF original ou o XML da nota.</span>'; return; }
            var foto = /^image\//.test(f.type);
            return nomeLoja(P.S, d).then(function (loja) {
              var info = { loja: loja, cnpj: d.cnpj || null, data: d.data, numero: numeroOrc(rl.bruto) || d.numero || null, origem: rl.bruto && /<infNFe/i.test(rl.bruto) ? "nota" : "orcamento_loja" };
              var cat = CP.areaPelosItens(itens.map(function (x) { return { item: x.descricao }; })) || filtro.cat;
              var ja = info.numero && (P.S.precosHist || []).filter(function (x) { return x.documento === info.numero && x.loja === loja; })[0];
              var cab = "<b>" + esc(loja || "Loja não identificada") + "</b>" + (info.numero ? " · orçamento nº " + esc(info.numero) : "") + (info.data ? " · " + esc(A.dataSimples(info.data)) : "") +
                " · " + itens.length + " material(is)" + (d.valor ? " · total " + A.dinheiro(d.valor) : "") +
                (ja ? '<div class="aviso peq" style="margin-top:6px">Este orçamento já tinha sido lançado em ' + esc(A.dataSimples(String(ja.criado_em || ja.data).slice(0, 10))) + ": nada se repete no histórico.</div>" : "");
              function salvarAgora(lista, c2) {
                cx.innerHTML = cab + '<div class="peq" style="margin-top:6px"><span class="carregando"></span> Salvando no acervo...</div>';
                return guardarDaLoja(P, lista, c2, info).then(function (r) {
                  var ig = r.linhas.length - r.novos - r.atualizados;
                  cx.innerHTML = cab + '<div class="aviso ok" style="margin-top:6px">✅ Salvo em ' + CATS[c2] + ": <b>" + r.novos + "</b> novo(s) no acervo, <b>" + r.atualizados + "</b> com preço atualizado" + (ig ? ", " + ig + " sem mudança" : "") + "." +
                    (r.semHist ? "<br>⚠ O 📈 histórico não foi gravado: rode o <b>supabase.sql</b> no Supabase (tabela precos_historico)." : " Preços guardados no 📈 histórico.") + "</div>" + htmlResultado(r);
                  A.avisar("📥 " + (loja || "Orçamento") + ": " + r.novos + " novo(s), " + r.atualizados + " atualizado(s)", "ok");
                }).catch(function (e) { cx.innerHTML = cab + '<div class="aviso erro">Não salvou: ' + esc(A.msgErro(e)) + "</div>"; });
              }
              if (!foto) return salvarAgora(itens, cat);
              // foto: a leitura pode errar — confere antes de salvar
              cx.innerHTML = cab + '<p class="peq mudo" style="margin:4px 0">Foto: confira o nome e o preço (a leitura pode errar) e desmarque o que não vai.</p>' +
                '<div class="tabela-caixa"><table><thead><tr><th></th><th>Material</th><th>Un</th><th class="num">Preço (un.)</th></tr></thead><tbody>' + itens.map(function (x, n) {
                  return '<tr data-ll="' + n + '"><td><input type="checkbox" class="ll-ok" checked aria-label="Usar"></td><td><input class="ll-desc" maxlength="300" style="min-width:180px"></td><td>' + esc(x.un) +
                    '</td><td><input class="ll-unit" inputmode="decimal" style="width:100px"></td></tr>';
                }).join("") + "</tbody></table></div>" +
                '<div class="linha"><select class="ll-cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (k === cat ? " selected" : "") + ">" + CATS[k] + "</option>"; }).join("") + '</select><button class="prim ll-salvar">Salvar no acervo</button></div>';
              $$("tr[data-ll]", cx).forEach(function (tr) {
                var x = itens[Number(tr.dataset.ll)];
                $(".ll-desc", tr).value = x.descricao; $(".ll-unit", tr).value = x.unit ? A.numero(x.unit, 2) : "";
                tr.oninput = tr.onchange = function () { x.ok = $(".ll-ok", tr).checked; x.descricao = $(".ll-desc", tr).value.trim(); x.unit = A.lerNumero($(".ll-unit", tr).value); };
              });
              $(".ll-salvar", cx).onclick = function () { salvarAgora(itens.filter(function (x) { return x.ok && x.descricao; }), $(".ll-cat", cx).value); };
            });
          }).catch(function (e) { cx.innerHTML = "<b>" + esc(f.name) + '</b>: <span class="selo critico">não consegui ler</span> ' + esc(A.msgErro(e)); });
        });
      }, Promise.resolve()).then(function () { if (!fechou) $("#ll-arq-b", el).textContent = "📄 Lançar outro"; });
    }
  }
  function htmlHistorico(S, desc) {
    var h = historico(S, desc);
    if (!h.length) return "";
    var menor = Math.min.apply(null, h.map(function (x) { return x.valor; }));
    return '<details open style="margin-top:10px"><summary><b>📈 Preços das lojas (' + h.length + ")</b></summary>" +
      '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Loja</th><th class="num">Preço (un.)</th><th></th></tr></thead><tbody>' +
      h.slice(0, 60).map(function (x) {
        return "<tr><td>" + esc(A.dataSimples(x.data)) + "</td><td>" + esc(x.loja || "—") + (x.documento ? ' <span class="peq mudo">nº ' + esc(x.documento) + "</span>" : "") + '</td><td class="num"><b>' + A.dinheiro(x.valor) + "</b></td><td>" +
          (h.length > 1 && x.valor === menor ? '<span class="selo bom">menor</span> ' : "") + '<span class="peq mudo">' + (x.origem === "nota" ? "nota" : "orçamento") + "</span></td></tr>";
      }).join("") + "</tbody></table></div></details>";
  }

  window.AGE_PRECOS = { ver: ver, paraOrcamento: paraOrcamento, acharServico: acharServico, guardarDaLoja: guardarDaLoja, historico: historico, resumoHist: resumoHist, textoPreco: textoPreco, htmlResultado: htmlResultado, nomeLoja: nomeLoja, numeroOrc: numeroOrc };
})();
