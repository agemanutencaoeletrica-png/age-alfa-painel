// Painel do dono — 🧮 CALCULADORA DE MÃO DE OBRA: escolha o serviço da tabela de preços (ABRAPP e a sua), digite a metragem
// e veja o valor. O preço unitário pode ser ajustado à vontade (ex.: tabela 10 / 25 / 40 → você usa 28) SEM mexer na tabela.
// A lista é salva sozinha neste aparelho e vira orçamento (mão de obra) com um toque. Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, CHAVE = "age_calc_v1";
  var estado = { cat: "pintura", linhas: [], busca: "", grupo: "", sel: "" };
  var CATS = { pintura: "🎨 Pintura", eletrica: "⚡ Elétrica" };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function ler() { try { var s = JSON.parse(localStorage.getItem(CHAVE) || "null"); if (s && Array.isArray(s.linhas)) { estado.cat = CATS[s.cat] ? s.cat : "pintura"; estado.linhas = s.linhas; } } catch (e) { /* sem armazenamento: começa vazio */ } }
  function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify({ cat: estado.cat, linhas: estado.linhas })); } catch (e) { /* ignora */ } }
  function f2(v) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fq(v) { return String(Number(v) || 0).replace(".", ","); }   // sem ponto de milhar: "2.920" seria lido como 2,92
  function n(x) { return x === null || x === undefined || x === "" ? null : Number(x); }

  // serviços da tabela: os da aba 💲 Preços (têm prioridade) + os da lista inicial que ainda não foram carregados lá
  function servicos(cat) {
    var out = [], vistos = {};
    ((P && P.S.precos) || []).forEach(function (x) {
      if (x.categoria !== cat || x.ativo === false || /^Materiais/.test(String(x.grupo || ""))) return;
      vistos[semAcento(x.descricao)] = 1;
      out.push({ grupo: x.grupo || "Outros", descricao: x.descricao, un: x.un || "un", valor: n(x.valor), min: n(x.valor_min), max: n(x.valor_max) });
    });
    var base = (window.AGE_PRECOS_BASE || {})[cat];
    if (base) base.itens.forEach(function (x) {
      if (vistos[semAcento(x.descricao)] || /^Materiais/.test(String(x.grupo || ""))) return;
      out.push({ grupo: x.grupo || "Outros", descricao: x.descricao, un: x.un || "un", valor: n(x.valor), min: n(x.valor_min), max: n(x.valor_max) });
    });
    return out;
  }
  function achar(cat, desc) { return servicos(cat).filter(function (s) { return s.descricao === desc; })[0] || null; }

  function totais() {
    var t = { seu: 0, media: 0, semMedia: 0 };
    estado.linhas.forEach(function (l) {
      t.seu += r2(l.qtd * l.valor);
      if (l.media !== null && l.media !== undefined) t.media += r2(l.qtd * l.media); else t.semMedia++;
    });
    t.seu = r2(t.seu); t.media = r2(t.media); return t;
  }
  function faixaTxt(l) { return l.min !== null && l.max !== null && l.min !== undefined ? "tabela: " + din(l.min) + " · média " + (l.media !== null ? din(l.media) : "—") + " · " + din(l.max) : (l.media !== null && l.media !== undefined ? "tabela: média " + din(l.media) : "sem preço na tabela"); }
  function aviso(l) {
    if (l.min !== null && l.min !== undefined && l.valor && l.valor < l.min) return '<span class="peq" style="color:var(--atencao,#b7791f)">abaixo do mínimo da tabela</span>';
    if (l.max !== null && l.max !== undefined && l.valor && l.valor > l.max) return '<span class="peq" style="color:var(--atencao,#b7791f)">acima do máximo da tabela</span>';
    return "";
  }

  // ---------------- tela ----------------
  function ver(c, ctx) { P = ctx; ler(); desenhar(c); }
  function desenhar(c) {
    var L = servicos(estado.cat), grupos = [];
    L.forEach(function (s) { if (grupos.indexOf(s.grupo) < 0) grupos.push(s.grupo); });
    if (estado.grupo && grupos.indexOf(estado.grupo) < 0) estado.grupo = "";
    c.innerHTML = '<div class="cab-secao"><h2>🧮 Calculadora de mão de obra</h2><span id="cl-status" class="mudo peq">salva sozinha neste aparelho</span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Escolha o serviço da tabela, digite a <b>metragem</b> e ajuste o <b>preço por unidade</b> como quiser (a tabela não muda). Os valores são só mão de obra, sem material.</p>' +
      '<div class="cartao"><div class="acoes" style="margin-top:0">' + Object.keys(CATS).map(function (k) { return '<button class="' + (k === estado.cat ? "prim" : "") + '" data-cat="' + k + '">' + CATS[k] + "</button>"; }).join("") + "</div>" +
      '<div class="linha" style="gap:8px;margin-top:8px"><input type="search" id="cl-busca" data-sem-correcao placeholder="🔍 Buscar serviço (ex.: vaga, pare, parede)" style="flex:2;min-width:180px" value="' + esc(estado.busca) + '">' +
      '<select id="cl-grupo" aria-label="Grupo" style="flex:1;min-width:150px"><option value="">Todos os grupos</option>' + grupos.map(function (g) { return '<option' + (g === estado.grupo ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("") + "</select></div>" +
      '<label for="cl-serv">Serviço</label><select id="cl-serv"></select>' +
      '<div class="duas"><div><label for="cl-metr" id="cl-metr-r">Metragem / quantidade</label><input id="cl-metr" inputmode="decimal" placeholder="Ex.: 120"></div>' +
      '<div><label for="cl-preco">Seu preço por unidade (R$)</label><input id="cl-preco" inputmode="decimal" placeholder="Ex.: 12,98"></div></div>' +
      '<div id="cl-ref" class="peq mudo" style="margin-top:6px"></div><input type="range" id="cl-slide" style="width:100%;display:none" aria-label="Ajustar o preço entre o mínimo e o máximo da tabela">' +
      '<div class="acoes"><button class="peq" id="cl-min">Mínimo</button><button class="peq" id="cl-med">Média</button><button class="peq" id="cl-max">Máximo</button>' +
      '<span id="cl-prev" style="margin-left:auto;font-weight:700"></span><button class="prim" id="cl-add">➕ Adicionar à lista</button></div></div>' +
      '<div id="cl-lista"></div>';
    $$("[data-cat]", c).forEach(function (b) { b.onclick = function () { estado.cat = b.dataset.cat; estado.grupo = ""; estado.busca = ""; estado.sel = ""; guardar(); desenhar(c); }; });
    $("#cl-busca", c).oninput = function () { estado.busca = this.value; opcoes(c); };
    $("#cl-grupo", c).onchange = function () { estado.grupo = this.value; opcoes(c); };
    $("#cl-serv", c).onchange = function () { estado.sel = this.value; escolher(c); };
    $("#cl-metr", c).oninput = function () { prever(c); };
    $("#cl-preco", c).oninput = function () { var s = achar(estado.cat, estado.sel); var v = A.lerNumero(this.value); if (s && $("#cl-slide", c).style.display !== "none") $("#cl-slide", c).value = v; prever(c); };
    $("#cl-slide", c).oninput = function () { $("#cl-preco", c).value = f2(this.value); prever(c); };
    $("#cl-min", c).onclick = function () { var s = achar(estado.cat, estado.sel); if (s && s.min !== null) fixar(c, s.min); };
    $("#cl-med", c).onclick = function () { var s = achar(estado.cat, estado.sel); if (s && s.valor !== null) fixar(c, s.valor); };
    $("#cl-max", c).onclick = function () { var s = achar(estado.cat, estado.sel); if (s && s.max !== null) fixar(c, s.max); };
    $("#cl-add", c).onclick = function () { adicionar(c); };
    opcoes(c); lista(c);
  }
  function opcoes(c) {
    var b = semAcento(estado.busca), g = {}, total = 0;
    servicos(estado.cat).forEach(function (s) {
      if ((estado.grupo && s.grupo !== estado.grupo) || (b && semAcento(s.descricao + " " + s.grupo).indexOf(b) < 0)) return;
      (g[s.grupo] = g[s.grupo] || []).push(s); total++;
    });
    $("#cl-serv", c).innerHTML = '<option value="">— escolha (' + total + " serviço(s)) —</option>" + Object.keys(g).map(function (k) {
      return '<optgroup label="' + esc(k) + '">' + g[k].map(function (s) { return '<option value="' + esc(s.descricao) + '"' + (s.descricao === estado.sel ? " selected" : "") + ">" + esc(s.descricao) + " · " + esc(s.un) + (s.valor !== null ? " · " + din(s.valor) : " · a definir") + "</option>"; }).join("") + "</optgroup>";
    }).join("");
    if (estado.sel && !$("#cl-serv", c).value) estado.sel = "";
    escolher(c, true);
  }
  function fixar(c, v) { $("#cl-preco", c).value = f2(v); if ($("#cl-slide", c).style.display !== "none") $("#cl-slide", c).value = v; prever(c); }
  function escolher(c, manter) {
    var s = achar(estado.cat, estado.sel), sl = $("#cl-slide", c);
    $("#cl-metr-r", c).textContent = s ? "Metragem / quantidade (" + s.un + ")" : "Metragem / quantidade";
    if (!s) { $("#cl-ref", c).textContent = ""; sl.style.display = "none"; prever(c); return; }
    $("#cl-ref", c).textContent = faixaTxt({ min: s.min, max: s.max, media: s.valor });
    if (s.min !== null && s.max !== null && s.max > s.min) { sl.style.display = ""; sl.min = s.min; sl.max = s.max; sl.step = "0.01"; } else sl.style.display = "none";
    if (!manter || !$("#cl-preco", c).value) { if (s.valor !== null) fixar(c, s.valor); else $("#cl-preco", c).value = ""; }
    prever(c);
  }
  function prever(c) {
    var q = A.lerNumero($("#cl-metr", c).value), v = A.lerNumero($("#cl-preco", c).value), s = achar(estado.cat, estado.sel);
    $("#cl-prev", c).innerHTML = s && q && v ? "= " + din(r2(q * v)) : "";
    $("#cl-add", c).disabled = !(s && q > 0 && v > 0);
    if (s && v) { var l = { min: s.min, max: s.max, valor: v }; $("#cl-ref", c).innerHTML = esc(faixaTxt({ min: s.min, max: s.max, media: s.valor })) + " " + aviso(l); }
  }
  function adicionar(c) {
    var s = achar(estado.cat, estado.sel), q = A.lerNumero($("#cl-metr", c).value), v = A.lerNumero($("#cl-preco", c).value);
    if (!s || !(q > 0) || !(v > 0)) return;
    estado.linhas.push({ desc: s.descricao, un: s.un, qtd: q, valor: r2(v), media: s.valor, min: s.min, max: s.max, cat: estado.cat });
    guardar(); $("#cl-metr", c).value = ""; lista(c); prever(c); A.avisar("Adicionado à lista", "ok");
  }

  // ---- lista de serviços ----
  function lista(c) {
    var el = $("#cl-lista", c);
    if (!estado.linhas.length) { el.innerHTML = '<div class="cartao vazio">Sua lista está vazia. Escolha um serviço, digite a metragem e toque em ➕ Adicionar.</div>'; return; }
    var t = totais(), dif = t.media ? ((t.seu - t.media) / t.media * 100) : 0;
    el.innerHTML = '<div class="cartao"><h3 style="margin-top:0">Sua lista</h3>' + estado.linhas.map(function (l, i) {
      return '<div class="cl-lin" data-i="' + i + '" style="border-top:1px solid var(--borda);padding:8px 0"><input class="l-desc" maxlength="300" value="' + esc(l.desc) + '" style="width:100%">' +
        '<div class="linha" style="gap:8px;margin-top:6px;align-items:flex-end"><label style="width:110px">Qtd (' + esc(l.un) + ')<input class="l-q" inputmode="decimal" value="' + esc(fq(l.qtd)) + '"></label>' +
        '<label style="width:130px">R$ por ' + esc(l.un) + '<input class="l-v" inputmode="decimal" value="' + esc(f2(l.valor)) + '"></label>' +
        '<div style="flex:1;min-width:120px"><b class="l-sub">' + din(r2(l.qtd * l.valor)) + '</b><div class="peq mudo">' + esc(faixaTxt(l)) + '</div><div class="l-av">' + aviso(l) + '</div></div>' +
        '<button class="peq" data-med="' + i + '" title="Volta ao preço médio da tabela"' + (l.media === null || l.media === undefined ? " disabled" : "") + '>↺ média</button><button class="peq perigo" data-tirar="' + i + '" aria-label="Tirar da lista">🗑</button></div></div>';
    }).join("") + '<div style="border-top:2px solid var(--borda);margin-top:8px;padding-top:8px"><div class="linha" style="justify-content:space-between"><span>Total pelo seu preço</span><b id="cl-tot" style="font-size:20px">' + din(t.seu) + "</b></div>" +
      '<div class="linha peq mudo" style="justify-content:space-between"><span>Pela média da tabela' + (t.semMedia ? " (sem " + t.semMedia + " item(ns) sem preço)" : "") + '</span><span id="cl-tmed">' + din(t.media) + (t.media ? " (" + (dif >= 0 ? "+" : "") + A.numero(dif, 1) + "%)" : "") + "</span></div></div>" +
      '<div class="acoes"><button class="prim" id="cl-orc">📄 Criar orçamento com esta lista</button><button id="cl-copiar">📋 Copiar</button><button class="perigo" id="cl-limpar">🧹 Limpar lista</button></div></div>';
    function atualizarTotais() {
      var t2 = totais(), d2 = t2.media ? ((t2.seu - t2.media) / t2.media * 100) : 0;
      $("#cl-tot", c).textContent = din(t2.seu); $("#cl-tmed", c).textContent = din(t2.media) + (t2.media ? " (" + (d2 >= 0 ? "+" : "") + A.numero(d2, 1) + "%)" : "");
    }
    $$(".cl-lin", el).forEach(function (d) {
      var l = estado.linhas[Number(d.dataset.i)];
      function mudou() {
        l.desc = $(".l-desc", d).value; l.qtd = A.lerNumero($(".l-q", d).value) || 0; l.valor = A.lerNumero($(".l-v", d).value) || 0;
        $(".l-sub", d).textContent = din(r2(l.qtd * l.valor)); $(".l-av", d).innerHTML = aviso(l); atualizarTotais(); guardar(); var s = $("#cl-status", c); if (s) s.textContent = "✓ salvo"; }
      $$("input", d).forEach(function (i) { i.addEventListener("input", mudou); });
    });
    $$("[data-med]", el).forEach(function (b) { b.onclick = function () { var l = estado.linhas[Number(b.dataset.med)]; if (l.media !== null && l.media !== undefined) { l.valor = l.media; guardar(); lista(c); } }; });
    $$("[data-tirar]", el).forEach(function (b) { b.onclick = function () { estado.linhas.splice(Number(b.dataset.tirar), 1); guardar(); lista(c); }; });
    $("#cl-limpar", c).onclick = function () { if (A.confirmar("Limpar toda a lista da calculadora?")) { estado.linhas = []; guardar(); lista(c); } };
    $("#cl-copiar", c).onclick = function () { copiar(texto()); };
    $("#cl-orc", c).onclick = function () {
      var ls = estado.linhas.filter(function (l) { return l.qtd > 0; });
      if (!ls.length) return;
      P.novoOrcamento({ categoria: ls[0].cat === "eletrica" ? "eletrica" : "pintura", itens: ls.map(function (l) { return { tipo: "servico", descricao: l.desc, qtd: l.qtd, un: l.un, valor: l.valor }; }) });
    };
  }
  function texto() {
    var t = totais();
    return "MÃO DE OBRA\n" + estado.linhas.map(function (l) { return "- " + A.numero(l.qtd, 2) + " " + l.un + " " + l.desc + ": " + din(l.valor) + "/" + l.un + " = " + din(r2(l.qtd * l.valor)); }).join("\n") + "\nTOTAL: " + din(t.seu);
  }
  function copiar(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.avisar("Lista copiada", "ok"); }, function () { window.prompt("Copie:", t); });
    else window.prompt("Copie:", t);
  }

  window.AGE_CALC = { ver: ver };
})();
