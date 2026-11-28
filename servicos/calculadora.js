// Painel do dono — 🧮 CALCULADORA DE MÃO DE OBRA: escolha o serviço da tabela de preços (ABRAPP e a sua), digite a metragem
// e veja o valor. O preço unitário pode ser ajustado à vontade (ex.: tabela 10 / 25 / 40 → você usa 28) SEM mexer na tabela.
// A lista é salva sozinha neste aparelho e vira orçamento (mão de obra) com um toque. Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, CHAVE = "age_calc_v1";
  var estado = { cat: "pintura", linhas: [], busca: "", grupo: "", sel: "", id: null, nome: "", orc: null, visao: "t_servicos", equipe: null };
  var cot = [], semTab = false, raiz = null, timerN = null, salvando = false, pendente = false;
  var CATS = { pintura: "🎨 Pintura", eletrica: "⚡ Elétrica" };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function ler() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || "null");
      if (s && Array.isArray(s.linhas)) { estado.cat = CATS[s.cat] ? s.cat : "pintura"; estado.linhas = s.linhas; estado.id = s.id || null; estado.nome = s.nome || ""; estado.orc = s.orc || null; estado.visao = s.visao || "t_servicos"; estado.equipe = s.equipe || null; }
    } catch (e) { /* sem armazenamento: começa vazio */ }
  }
  function guardarLocal() { try { localStorage.setItem(CHAVE, JSON.stringify({ cat: estado.cat, linhas: estado.linhas, id: estado.id, nome: estado.nome, orc: estado.orc, visao: estado.visao, equipe: estado.equipe })); } catch (e) { /* ignora */ } }
  function guardar() { guardarLocal(); agendarNuvem(); }
  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function agoraTxt() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function status(t, erro) { var e = raiz && $("#cl-status", raiz); if (e) { e.textContent = t; e.style.color = erro ? "var(--perigo,#c0392b)" : ""; } }
  function nomePadrao() { var d = new Date(); return "Cotação de " + ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + " " + agoraTxt(); }

  // a equipe (custo interno) viaja dentro do campo "orc" da cotação salva (o orçamento criado nunca recebe isso)
  function orcComEquipe() { var o = Object.assign({}, estado.orc || {}); if (estado.equipe && ((estado.equipe.func || []).length || (estado.equipe.outros || []).length || Number(estado.equipe.areaObra) > 0)) o._equipe = estado.equipe; return Object.keys(o).length ? o : null; }
  function tirarEquipe(o) { var x = Object.assign({}, o || {}), eq = x._equipe || null; delete x._equipe; return { orc: Object.keys(x).length ? x : null, equipe: eq }; }
  // ---- salvar sozinho na nuvem (Supabase) e guardar as cotações para consulta ----
  function carregarCot(depois) {
    Promise.resolve(P.sb.from("calc_cotacoes").select("*").order("atualizado_em", { ascending: false }).limit(300)).then(function (r) {
      if (r.error) throw r.error; cot = r.data || []; semTab = false;
    }).catch(function (e) { cot = []; semTab = semT(e); }).then(depois);
  }
  function agendarNuvem() { if (semTab || !P) { status(estado.linhas.length ? "salva neste aparelho" : ""); return; } status("salvando…"); clearTimeout(timerN); timerN = setTimeout(salvarNuvem, 1200); }
  function salvarNuvem() {
    if (!P || semTab || (!estado.linhas.length && !estado.id)) return;
    if (salvando) { pendente = true; return; }
    salvando = true;
    var reg = { nome: estado.nome || nomePadrao(), categoria: estado.cat, linhas: estado.linhas, orc: orcComEquipe(), total: r2(totais().seu + totais().mat), atualizado_em: new Date().toISOString() };
    var op = estado.id ? P.sb.from("calc_cotacoes").update(reg).eq("id", estado.id).select() : P.sb.from("calc_cotacoes").insert(reg).select();
    Promise.resolve(op).then(function (r) {
      if (r.error) throw r.error;
      var x = (r.data || [])[0];
      if (x) { estado.id = x.id; cot = [x].concat(cot.filter(function (y) { return y.id !== x.id; })); guardarLocal(); }
      status("☁ salva às " + agoraTxt()); pintarSalvas();
    }).catch(function (e) { if (semT(e)) { semTab = true; status("salva neste aparelho (falta rodar o calculadora.sql)"); } else status("não salvou na nuvem", true); })
      .then(function () { salvando = false; if (pendente) { pendente = false; salvarNuvem(); } });
  }
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
    var t = { seu: 0, media: 0, semMedia: 0, mat: 0, matCusto: 0 };
    estado.linhas.forEach(function (l) {
      if (l.tipo === "material") { t.mat += r2(l.qtd * l.valor); t.matCusto += r2(l.qtd * (Number(l.custo) || Number(l.valor) || 0)); return; }
      t.seu += r2(l.qtd * l.valor);
      if (l.media !== null && l.media !== undefined) t.media += r2(l.qtd * l.media); else t.semMedia++;
    });
    t.seu = r2(t.seu); t.media = r2(t.media); t.mat = r2(t.mat); t.matCusto = r2(t.matCusto); return t;
  }
  function faixaTxt(l) {
    if (l.tipo === "material") {
      var cu = Number(l.custo) || 0;
      if (!(cu > 0)) return "material · sem custo de referência";
      var mg = (Number(l.valor) / cu - 1) * 100;
      return "custo da loja " + din(cu) + " · " + (Math.abs(mg) < 0.05 ? "sem margem" : (mg >= 0 ? "margem " : "abaixo do custo ") + A.numero(Math.abs(mg), 1) + "%");
    }
    return l.min !== null && l.max !== null && l.min !== undefined ? "tabela: " + din(l.min) + " · média " + (l.media !== null ? din(l.media) : "—") + " · " + din(l.max) : (l.media !== null && l.media !== undefined ? "tabela: média " + din(l.media) : "sem preço na tabela"); }
  function aviso(l) {
    if (!(l.valor > 0)) return '<span class="peq" style="color:var(--perigo,#c0392b)">coloque o preço</span>';
    if (l.tipo === "material") return "";
    if (l.min !== null && l.min !== undefined && l.valor && l.valor < l.min) return '<span class="peq" style="color:var(--atencao,#b7791f)">abaixo do mínimo da tabela</span>';
    if (l.max !== null && l.max !== undefined && l.valor && l.valor > l.max) return '<span class="peq" style="color:var(--atencao,#b7791f)">acima do máximo da tabela</span>';
    return "";
  }

  // ---------------- tela ----------------
  function ver(c, ctx) { P = ctx; raiz = c; MEDIA = undefined; OBRAS = undefined; ler(); c.innerHTML = '<div class="cab-secao"><h2>🧮 Calculadora de mão de obra</h2></div><div class="cartao vazio">Carregando...</div>'; carregarCot(function () { desenhar(c); }); }
  function desenhar(c) {
    var L = servicos(estado.cat), grupos = [];
    L.forEach(function (s) { if (grupos.indexOf(s.grupo) < 0) grupos.push(s.grupo); });
    if (estado.grupo && grupos.indexOf(estado.grupo) < 0) estado.grupo = "";
    c.innerHTML = '<div class="cab-secao"><h2>🧮 Calculadora de mão de obra</h2><span id="cl-status" class="mudo peq">salva sozinha</span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Escolha o serviço da tabela, digite a <b>metragem</b> e ajuste o <b>preço por unidade</b> como quiser (a tabela não muda). Os valores são só mão de obra, sem material.</p>' +
      '<div class="cartao"><label style="margin-top:0">Nome desta cotação (para achar depois)<input class="cl-ncot" maxlength="200" placeholder="Ex.: Condomínio X – sinalização" value="' + esc(estado.nome) + '"></label>' +
      '<div class="acoes"><button class="peq" id="cl-nova">🆕 Nova cotação</button><button class="peq" id="cl-imp" title="Cole o código de uma cotação preparada">📥 Importar código</button></div></div>' +
      '<div class="cartao"><div class="acoes" style="margin-top:0">' + Object.keys(CATS).map(function (k) { return '<button class="' + (k === estado.cat ? "prim" : "") + '" data-cat="' + k + '">' + CATS[k] + "</button>"; }).join("") + "</div>" +
      '<div class="linha" style="gap:8px;margin-top:8px"><input type="search" id="cl-busca" data-sem-correcao placeholder="🔍 Buscar serviço (ex.: vaga, pare, parede)" style="flex:2;min-width:180px" value="' + esc(estado.busca) + '">' +
      '<select id="cl-grupo" aria-label="Grupo" style="flex:1;min-width:150px"><option value="">Todos os grupos</option>' + grupos.map(function (g) { return '<option' + (g === estado.grupo ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("") + "</select></div>" +
      '<label for="cl-serv">Serviço</label><select id="cl-serv"></select>' +
      '<div class="duas"><div><label for="cl-metr" id="cl-metr-r">Metragem / quantidade</label><input id="cl-metr" inputmode="decimal" placeholder="Ex.: 120"></div>' +
      '<div><label for="cl-preco">Seu preço por unidade (R$)</label><input id="cl-preco" inputmode="decimal" placeholder="Ex.: 12,98"></div></div>' +
      '<div id="cl-ref" class="peq mudo" style="margin-top:6px"></div><input type="range" id="cl-slide" style="width:100%;display:none" aria-label="Ajustar o preço entre o mínimo e o máximo da tabela">' +
      '<div class="acoes"><button class="peq" id="cl-min">Mínimo</button><button class="peq" id="cl-med">Média</button><button class="peq" id="cl-max">Máximo</button>' +
      '<span id="cl-prev" style="margin-left:auto;font-weight:700"></span><button class="prim" id="cl-add">➕ Adicionar à lista</button></div>' +
      '<div class="acoes"><button class="peq" id="cl-colar" title="Cole várias metragens de uma vez: o app acha o serviço na tabela de cada linha">📝 Colar lista de metragens</button><button class="peq" id="cl-livre" title="Serviço que não está na tabela (ex.: limpeza do piso)">➕ Item fora da tabela</button><button class="peq" id="cl-fach" title="Calcula a área das fachadas de torres/prédios, a tinta e já coloca o serviço na lista">🏢 Fachadas (torres / prédios)</button>' +
      '<button class="peq" id="cl-loja" title="Lê o orçamento ou a nota da loja (PDF, foto ou XML) e traz os materiais com o custo de cada um">📂 Materiais da loja (PDF, foto ou XML)</button><input type="file" id="cl-arq-loja" class="oculto" accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml"></div></div>' +
      '<div id="cl-lista"></div><div id="cl-equipe"></div><div id="cl-comp"></div><div id="cl-laudo"></div><div id="cl-salvas"></div>';
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
    $(".cl-ncot", c).oninput = function () { estado.nome = this.value; guardar(); };
    $("#cl-nova", c).onclick = function () { estado = Object.assign(estado, { id: null, nome: "", linhas: [], orc: null, equipe: null }); guardarLocal(); status(""); desenhar(c); };
    $("#cl-imp", c).onclick = function () { importar(c); };
    $("#cl-colar", c).onclick = function () { colar(c); };
    $("#cl-livre", c).onclick = function () { livre(c); };
    $("#cl-fach", c).onclick = function () { fachadas(c); };
    $("#cl-loja", c).onclick = function () { $("#cl-arq-loja", c).value = ""; $("#cl-arq-loja", c).click(); };
    $("#cl-arq-loja", c).onchange = function () { if (this.files[0]) lerLoja(c, this.files[0]); };
    opcoes(c); lista(c); equipeCartao(c); compCartao(c); laudoCartao(c); pintarSalvas();
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
  function refHist(s) {
    var h = historico(s);
    return h.length ? '<div style="margin-top:4px">Você já cobrou: ' + h.map(function (x) { return '<button class="peq" data-hv="' + x.v + '" title="' + esc(x.de) + '">' + din(x.v) + " · " + esc(x.de.slice(0, 28)) + (x.data ? " (" + dataCurta(x.data) + ")" : "") + "</button>"; }).join(" ") + "</div>" : "";
  }
  function fixar(c, v) { $("#cl-preco", c).value = f2(v); if ($("#cl-slide", c).style.display !== "none") $("#cl-slide", c).value = v; prever(c); }
  function escolher(c, manter) {
    var s = achar(estado.cat, estado.sel), sl = $("#cl-slide", c);
    $("#cl-metr-r", c).textContent = s ? "Metragem / quantidade (" + s.un + ")" : "Metragem / quantidade";
    if (!s) { $("#cl-ref", c).textContent = ""; sl.style.display = "none"; prever(c); return; }
    $("#cl-ref", c).innerHTML = esc(faixaTxt({ min: s.min, max: s.max, media: s.valor })) + refHist(s);
    if (s.min !== null && s.max !== null && s.max > s.min) { sl.style.display = ""; sl.min = s.min; sl.max = s.max; sl.step = "0.01"; } else sl.style.display = "none";
    if (!manter || !$("#cl-preco", c).value) { if (s.valor !== null) fixar(c, s.valor); else $("#cl-preco", c).value = ""; }
    prever(c);
  }
  function prever(c) {
    var q = A.lerNumero($("#cl-metr", c).value), v = A.lerNumero($("#cl-preco", c).value), s = achar(estado.cat, estado.sel);
    $("#cl-prev", c).innerHTML = s && q && v ? "= " + din(r2(q * v)) : "";
    $("#cl-add", c).disabled = !(s && q > 0 && v > 0);
    if (s && v) { var l = { min: s.min, max: s.max, valor: v }; $("#cl-ref", c).innerHTML = esc(faixaTxt({ min: s.min, max: s.max, media: s.valor })) + " " + aviso(l) + refHist(s); }
    $$("[data-hv]", c).forEach(function (b) { b.onclick = function () { fixar(c, Number(b.dataset.hv)); }; });
  }
  function adicionar(c) {
    var s = achar(estado.cat, estado.sel), q = A.lerNumero($("#cl-metr", c).value), v = A.lerNumero($("#cl-preco", c).value);
    if (!s || !(q > 0) || !(v > 0)) return;
    estado.linhas.push({ desc: s.descricao, ref: s.descricao, un: s.un, qtd: q, valor: r2(v), media: s.valor, min: s.min, max: s.max, cat: estado.cat });
    guardar(); $("#cl-metr", c).value = ""; lista(c); prever(c); A.avisar("Adicionado à lista", "ok");
  }


  // ---- colar várias metragens de uma vez ----
  // cada linha: "2920 m | Demarcação de vaga de garagem => texto que o cliente vê (opcional)". O app acha o serviço na tabela pelo nome.
  function tokens(t) { return semAcento(t).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function (x) { return x.length > 2 && !/^(de|da|do|das|dos|com|para|por|uma|uns|das)$/.test(x); }); }
  function casar(texto) {
    var alvo = semAcento(texto), qs = tokens(texto), melhor = null, nota = 0;
    ["pintura", "eletrica"].forEach(function (cat) {
      servicos(cat).forEach(function (s) {
        var d = semAcento(s.descricao), sc;
        if (d === alvo) sc = 2; else if (!qs.length) sc = 0; else { var dt = tokens(s.descricao); sc = qs.filter(function (q) { return dt.some(function (x) { return x === q || x.indexOf(q) === 0 || q.indexOf(x) === 0; }); }).length / qs.length; if (dt.length > qs.length + 3) sc -= 0.1; }
        if (sc > nota) { nota = sc; melhor = { s: s, cat: cat }; }
      });
    });
    return nota >= 0.8 ? melhor : null;
  }
  function lerLinhas(txt) {
    var out = [];
    String(txt || "").split(/\n/).forEach(function (l) {
      l = l.replace(/^\s*[-•*]\s*/, "").trim(); if (!l) return;
      var partes = l.split("=>"), esq = partes[0].trim(), desc = (partes[1] || "").trim();
      var m = esq.match(/^([\d.,]+)\s*(m²|m2|m|ml|un|und|serv|vb|h|dia)?\s*[|:–-]?\s*(.+)$/i);
      if (!m) { out.push({ erro: l }); return; }
      var qtd = A.lerNumero(m[1]), un = (m[2] || "").toLowerCase().replace("m2", "m²").replace("ml", "m").replace("und", "un"), nome = m[3].trim();
      if (!(qtd > 0)) { out.push({ erro: l }); return; }
      var ach = casar(nome);
      out.push({ qtd: qtd, un: un, nome: nome, desc: desc, ach: ach });
    });
    return out;
  }
  function colar(c) {
    var j = A.janela('<p class="mudo peq" style="margin-top:0">Uma linha por serviço: <b>quantidade, unidade e nome do serviço</b> como está na tabela. Para mudar o texto que o cliente vê, escreva <b>=&gt;</b> e o texto. Serviço que não estiver na tabela entra como item fora da tabela (você coloca o preço).<br>Ex.: <code>2920 m | Demarcação de vaga de garagem =&gt; Repintura das linhas das vagas</code></p>' +
      '<textarea id="cl-txt" rows="9" style="width:100%" spellcheck="false"></textarea><div id="cl-conf"></div>' +
      '<div class="acoes" style="margin-top:4px"><button class="peq" id="cl-txt-arq">📂 Abrir arquivo de texto (.txt, .csv)</button><input type="file" id="cl-txt-in" class="oculto" accept=".txt,.csv,text/plain,text/csv"></div><div class="acoes"><button id="cl-ver">🔎 Conferir</button><button class="prim" id="cl-ok" disabled>➕ Adicionar tudo à lista</button><button id="cl-x">Cancelar</button></div>', { titulo: "📝 Colar lista de metragens", larga: true, semRascunho: true });
    var itens = [];
    function conferir() {
      itens = lerLinhas($("#cl-txt", j.el).value);
      $("#cl-conf", j.el).innerHTML = itens.length ? '<div class="peq" style="margin-top:8px">' + itens.map(function (x) {
        if (x.erro) return '<div style="color:var(--perigo,#c0392b)">❓ Não entendi: ' + esc(x.erro) + "</div>";
        var s = x.ach && x.ach.s;
        return "<div>" + (s ? "✅" : "➕") + " <b>" + esc(A.numero(x.qtd, 2)) + " " + esc(s ? s.un : x.un || "un") + "</b> · " + esc(x.desc || x.nome) + " " + (s ? '<span class="mudo">→ tabela: ' + esc(s.descricao) + (s.valor !== null ? " · " + din(s.valor) : " · a definir") + "</span>" : '<span class="mudo">→ fora da tabela (sem preço)</span>') + "</div>";
      }).join("") + "</div>" : '<p class="mudo peq">Nada para conferir.</p>';
      $("#cl-ok", j.el).disabled = !itens.some(function (x) { return !x.erro; });
    }
    $("#cl-txt-arq", j.el).onclick = function () { $("#cl-txt-in", j.el).value = ""; $("#cl-txt-in", j.el).click(); };
    $("#cl-txt-in", j.el).onchange = function () { var f = this.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { $("#cl-txt", j.el).value = String(fr.result || ""); conferir(); }; fr.readAsText(f); };
    $("#cl-ver", j.el).onclick = conferir; $("#cl-txt", j.el).oninput = function () { $("#cl-ok", j.el).disabled = true; };
    $("#cl-x", j.el).onclick = function () { j.fechar(); };
    $("#cl-ok", j.el).onclick = function () {
      conferir();
      itens.forEach(function (x) {
        if (x.erro) return;
        var s = x.ach && x.ach.s;
        estado.linhas.push(s ? { desc: x.desc || s.descricao, ref: s.descricao, un: s.un, qtd: x.qtd, valor: s.valor !== null ? s.valor : 0, media: s.valor, min: s.min, max: s.max, cat: x.ach.cat }
          : { desc: x.desc || x.nome, un: x.un || "un", qtd: x.qtd, valor: 0, media: null, min: null, max: null, cat: estado.cat });
      });
      guardar(); j.fechar(); lista(c); A.avisar("Lista adicionada", "ok");
    };
  }

  // ---- 🏢 fachadas de torres / prédios: área, tinta e serviço na lista ----
  var CH_FACH = "age_calc_fachadas_v1", FACH_PAD = { n: 34, perim: 72, alt: 12, aber: 20, demaos: 2, rend: 10, perda: 10, lata: 18 };
  function lerFach() { var o; try { o = Object.assign({}, FACH_PAD, JSON.parse(localStorage.getItem(CH_FACH) || "{}")); } catch (e) { o = Object.assign({}, FACH_PAD); } o.lata = Number(o.lata) > 0 && Number(o.lata) < 10 ? 3.6 : 18; return o; }
  function guardarFach(o) { try { localStorage.setItem(CH_FACH, JSON.stringify(o)); } catch (e) { /* ignora */ } }
  function fachadas(c) {
    var o = lerFach();
    var serv = servicos("pintura").filter(function (s) { return /acima de 3 m/.test(s.descricao) && /(látex|fachada|chapisco)/i.test(s.descricao) && s.valor !== null; });
    var padrao = serv.filter(function (s) { return /standard fosco 2 dem/i.test(s.descricao); })[0] || serv[0];
    var j = A.janela('<p class="mudo peq" style="margin-top:0">Informe as medidas de <b>uma torre</b> e quantas são. O app calcula a área líquida, a tinta para as demãos e coloca o serviço na lista, com o preço da tabela (acima de 3 m de altura), que você ajusta depois.</p>' +
      '<div class="linha" style="gap:8px"><label style="width:110px">Nº de torres<input class="fa-n" inputmode="decimal"></label><label style="width:150px">Perímetro de 1 torre (m)<input class="fa-p" inputmode="decimal"></label><label style="width:130px">Altura (m)<input class="fa-a" inputmode="decimal"></label><label style="width:170px">Descontar janelas e portas (%)<input class="fa-ab" inputmode="decimal"></label></div>' +
      '<div class="linha" style="gap:8px"><label style="width:100px">Demãos<input class="fa-d" inputmode="decimal"></label><label style="width:190px">Rendimento (m² por litro, por demão)<input class="fa-r" inputmode="decimal"></label><label style="width:120px">Perda (%)<input class="fa-pe" inputmode="decimal"></label><label style="width:200px">Embalagem da tinta<select class="fa-l"><option value="18">Lata de 18 L</option><option value="3,6">Galão de 3,6 L</option></select></label></div>' +
      '<label>Serviço da tabela para o preço<select class="fa-s">' + (serv.length ? serv.map(function (s) { return '<option value="' + esc(s.descricao) + '"' + (padrao && s.descricao === padrao.descricao ? " selected" : "") + ">" + esc(s.descricao) + " · " + din(s.valor) + "/m²</option>"; }).join("") : '<option value="">(tabela de pintura não carregada: o serviço entra sem preço)</option>') + "</select></label>" +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" class="fa-tinta" checked> Colocar também a <b>tinta</b> na lista (você preenche o preço)</label>' +
      '<label class="marca-linha" style="font-weight:400"><input type="checkbox" class="fa-acesso" checked> Colocar um item de <b>acesso em altura</b> (andaime, balancim ou corda), com preço a definir</label>' +
      '<div id="fa-res" class="cartao" style="margin-top:8px"></div><p class="peq mudo" style="margin:4px 0 0">Altura e janelas são estimativas: confirme com as elevações do projeto ou medindo uma torre no local. Fora da conta: selador, massa, textura, preparo e lavagem.</p>' +
      '<div class="acoes"><button class="prim" id="fa-ok">➕ Adicionar à lista</button><button id="fa-x">Cancelar</button></div>', { titulo: "🏢 Fachadas (torres / prédios)", larga: true, semRascunho: true });
    var K = { n: ".fa-n", perim: ".fa-p", alt: ".fa-a", aber: ".fa-ab", demaos: ".fa-d", rend: ".fa-r", perda: ".fa-pe", lata: ".fa-l" };
    Object.keys(K).forEach(function (k) { $(K[k], j.el).value = fq(o[k]); });
    function ler() { var v = {}; Object.keys(K).forEach(function (k) { v[k] = A.lerNumero($(K[k], j.el).value) || 0; }); return v; }
    function calc(v) {
      var area = v.n * v.perim * v.alt * Math.max(0, 1 - v.aber / 100), litros = v.rend > 0 ? area * v.demaos / v.rend * (1 + v.perda / 100) : 0, lt = v.lata > 0 ? Math.ceil(litros / v.lata - 1e-9) : 0;
      var outra = v.lata > 10 ? 3.6 : 18;
      return { area: Math.round(area * 10) / 10, litros: Math.round(litros), latas: lt, porTorre: v.n > 0 ? Math.round(area / v.n) : 0, latasTorre: v.n > 0 && v.lata > 0 ? Math.ceil(litros / v.n / v.lata - 1e-9) : 0, outra: outra, outras: Math.ceil(litros / outra - 1e-9) };
    }
    function pintar() {
      var v = ler(), r = calc(v), s = serv.filter(function (x) { return x.descricao === $(".fa-s", j.el).value; })[0];
      $("#fa-res", j.el).innerHTML = '<div class="linha" style="justify-content:space-between"><span>Área líquida por torre</span><b>' + A.numero(r.porTorre, 0) + ' m²</b></div><div class="linha" style="justify-content:space-between"><span>Área total a pintar (' + A.numero(v.n, 0) + ' torres)</span><b>' + A.numero(r.area, 1) + ' m²</b></div>' +
        '<div class="linha" style="justify-content:space-between"><span>Tinta (' + A.numero(v.demaos, 0) + ' demãos, ' + A.numero(v.rend, 1) + ' m²/L, ' + A.numero(v.perda, 0) + '% de perda)</span><b>' + A.numero(r.litros, 0) + ' L = ' + A.numero(r.latas, 0) + (v.lata > 10 ? " lata(s) de " : " galão(ões) de ") + A.numero(v.lata, 1) + ' L</b></div>' +
        '<div class="linha peq mudo" style="justify-content:space-between"><span>Por torre</span><span>≈ ' + r.latasTorre + (v.lata > 10 ? " lata(s)" : " galão(ões)") + '</span></div>' +
        '<div class="linha peq mudo" style="justify-content:space-between"><span>Para comparar: em ' + (r.outra > 10 ? "latas de 18 L" : "galões de 3,6 L") + '</span><span>' + A.numero(r.outras, 0) + ' ' + (r.outra > 10 ? "lata(s)" : "galão(ões)") + '</span></div>' +
        (s ? '<div class="linha" style="justify-content:space-between;margin-top:4px"><span>Mão de obra pela média da tabela</span><b>' + din(r2(r.area * s.valor)) + "</b></div>" : "");
    }
    $$("input[class^=fa-], select", j.el).forEach(function (e) { e.addEventListener("input", pintar); e.addEventListener("change", pintar); });
    pintar();
    $("#fa-x", j.el).onclick = function () { j.fechar(); };
    $("#fa-ok", j.el).onclick = function () {
      var v = ler(), r = calc(v), s = serv.filter(function (x) { return x.descricao === $(".fa-s", j.el).value; })[0];
      if (!(r.area > 0)) { A.avisar("Confira o nº de torres, o perímetro e a altura.", "erro"); return; }
      guardarFach(v);
      var ds = Math.round(v.demaos);
      estado.linhas.push({ desc: "Pintura das fachadas externas das " + A.numero(v.n, 0) + " torres (" + ds + " demãos de tinta acrílica)", ref: s ? s.descricao : undefined, un: "m²", qtd: r.area, valor: s ? s.valor : 0, media: s ? s.valor : null, min: s ? s.min : null, max: s ? s.max : null, cat: "pintura" });
      if ($(".fa-tinta", j.el).checked) estado.linhas.push({ tipo: "material", custo: 0, desc: "Tinta acrílica para fachada, " + (v.lata > 10 ? "lata de 18" : "galão de 3,6") + " L (" + A.numero(r.litros, 0) + " L para " + ds + " demãos)", un: v.lata > 10 ? "lata" : "galão", qtd: r.latas, valor: 0, media: null, min: null, max: null, cat: "pintura" });
      if ($(".fa-acesso", j.el).checked) estado.linhas.push({ desc: "Acesso em altura para as fachadas (andaime, balancim ou corda)", un: "vb", qtd: 1, valor: 0, media: null, min: null, max: null, cat: "pintura" });
      guardar(); j.fechar(); lista(c); A.avisar("Fachadas adicionadas à lista. Preencha os preços que faltam.", "ok");
    };
  }

  function livre(c) {
    var j = A.janela('<label>Tipo<select class="lv-t"><option value="servico">Mão de obra / serviço</option><option value="material">🧱 Material</option></select></label><label>Descrição<input class="lv-d" maxlength="300" placeholder="Ex.: Limpeza e preparo do piso antes da repintura"></label><div class="duas"><div><label>Quantidade<input class="lv-q" inputmode="decimal" value="1"></label></div><div><label>Unidade<select class="lv-u">' +
      ["un", "m", "m²", "serv", "vb", "h", "dia"].map(function (u) { return "<option>" + u + "</option>"; }).join("") + '</select></label></div></div><label>Preço por unidade (R$)<input class="lv-v" inputmode="decimal" placeholder="Pode deixar vazio e preencher na lista"></label>' +
      '<div class="acoes"><button class="prim" id="lv-ok">➕ Adicionar</button><button id="lv-x">Cancelar</button></div>', { titulo: "➕ Item fora da tabela", semRascunho: true });
    $("#lv-x", j.el).onclick = function () { j.fechar(); };
    $("#lv-ok", j.el).onclick = function () {
      var d = $(".lv-d", j.el).value.trim(), q = A.lerNumero($(".lv-q", j.el).value);
      if (!d || !(q > 0)) { A.avisar("Escreva a descrição e a quantidade.", "erro"); return; }
      var vl = A.lerNumero($(".lv-v", j.el).value) || 0, ehMat = $(".lv-t", j.el).value === "material";
      estado.linhas.push({ tipo: ehMat ? "material" : undefined, custo: ehMat ? vl : undefined, desc: d, un: $(".lv-u", j.el).value, qtd: q, valor: A.lerNumero($(".lv-v", j.el).value) || 0, media: null, min: null, max: null, cat: estado.cat });
      guardar(); j.fechar(); lista(c);
    };
  }


  // ---- valores de referência: o que você já cobrou nos orçamentos e nas cotações salvas ----
  function historico(s) {
    var qs = tokens(s.descricao), out = [];
    if (!qs.length) return out;
    ((P && P.S.orc) || []).forEach(function (o) {
      (o.itens || []).forEach(function (i) {
        var v = Number(i.valor) || 0; if (i.tipo === "material" || !v) return;
        var dt = tokens(i.descricao), sc = qs.filter(function (q) { return dt.some(function (x) { return x === q || x.indexOf(q) === 0 || q.indexOf(x) === 0; }); }).length / qs.length;
        if (sc >= 0.8 && Math.abs(dt.length - qs.length) <= 8) out.push({ v: v, de: "orçamento " + (o.cliente || ""), data: o.criado_em });
      });
    });
    cot.forEach(function (c) { (c.linhas || []).forEach(function (l) { if (l.ref === s.descricao && Number(l.valor) > 0 && c.id !== estado.id) out.push({ v: Number(l.valor), de: "cotação " + (c.nome || ""), data: c.atualizado_em }); }); });
    out.sort(function (a, b) { return String(b.data || "") < String(a.data || "") ? -1 : 1; });
    return out.slice(0, 4);
  }
  function dataCurta(iso) { var d = new Date(iso); return isNaN(d) ? "" : ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); }

  // ---- cotações salvas ----
  function pintarSalvas() {
    var el = raiz && $("#cl-salvas", raiz); if (!el) return;
    if (semTab) { el.innerHTML = '<div class="aviso">Para guardar as cotações na nuvem (e ver os valores de referência em qualquer aparelho), rode no Supabase o <b>calculadora.sql</b>. Por enquanto a lista fica só neste aparelho.</div>'; return; }
    if (!cot.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="cartao"><h3 style="margin-top:0">📚 Cotações salvas <span class="mudo peq">(valores para referência)</span></h3>' + cot.map(function (x) {
      var atual = x.id === estado.id;
      return '<details class="cl-cot" data-id="' + esc(x.id) + '" style="border-top:1px solid var(--borda);padding:6px 0"' + '><summary><b>' + esc(x.nome || "(sem nome)") + "</b>" + (atual ? ' <span class="selo">aberta</span>' : "") + ' · ' + din(x.total) + ' <span class="mudo peq">· ' + (x.linhas || []).length + " item(ns) · " + esc(dataCurta(x.atualizado_em)) + "</span></summary>" +
        '<div class="peq" style="margin:6px 0">' + (x.linhas || []).map(function (l) { return esc(A.numero(l.qtd, 2)) + " " + esc(l.un) + " · " + esc(l.desc) + " — " + din(l.valor) + "/" + esc(l.un); }).join("<br>") + "</div>" +
        '<div class="acoes" style="margin-top:4px"><button class="peq" data-abrir="' + esc(x.id) + '">Abrir</button><button class="peq" data-dup="' + esc(x.id) + '">Duplicar</button><button class="peq perigo" data-del="' + esc(x.id) + '">Apagar</button></div></details>';
    }).join("") + "</div>";
    $$("[data-abrir]", el).forEach(function (b) { b.onclick = function () { var x = cot.filter(function (y) { return y.id === b.dataset.abrir; })[0]; if (!x) return; Object.assign(estado, { id: x.id, nome: x.nome, cat: CATS[x.categoria] ? x.categoria : "pintura", linhas: x.linhas || [], orc: tirarEquipe(x.orc).orc, equipe: tirarEquipe(x.orc).equipe }); guardarLocal(); desenhar(raiz); window.scrollTo(0, 0); }; });
    $$("[data-dup]", el).forEach(function (b) { b.onclick = function () { var x = cot.filter(function (y) { return y.id === b.dataset.dup; })[0]; if (!x) return; Object.assign(estado, { id: null, nome: (x.nome || "Cotação") + " (cópia)", cat: CATS[x.categoria] ? x.categoria : "pintura", linhas: JSON.parse(JSON.stringify(x.linhas || [])), orc: tirarEquipe(x.orc).orc, equipe: tirarEquipe(x.orc).equipe }); guardar(); desenhar(raiz); window.scrollTo(0, 0); }; });
    $$("[data-del]", el).forEach(function (b) {
      b.onclick = function () {
        var x = cot.filter(function (y) { return y.id === b.dataset.del; })[0]; if (!x || !A.confirmar("Apagar a cotação “" + (x.nome || "") + "”?")) return;
        Promise.resolve(P.sb.from("calc_cotacoes").delete().eq("id", x.id)).then(function (r) { if (r.error) throw r.error; cot = cot.filter(function (y) { return y.id !== x.id; }); if (estado.id === x.id) { estado.id = null; guardarLocal(); } pintarSalvas(); })
          .catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
      };
    });
  }

  // ---- importar uma cotação preparada (código "AGE-COTACAO:...") ----
  function decodificar(txt) {
    var m = String(txt || "").replace(/\s+/g, "").match(/AGE-COTACAO:([A-Za-z0-9+/=_-]+)/); if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return null; }
  }
  function importar(c) {
    var j = A.janela('<p class="mudo peq" style="margin-top:0">Cole aqui o código da cotação (começa com <b>AGE-COTACAO:</b>).</p><textarea id="cl-cod" rows="6" style="width:100%" spellcheck="false"></textarea>' +
      '<div class="acoes"><button class="peq" id="cl-cod-arq">📂 Abrir arquivo do código (.txt)</button><input type="file" id="cl-cod-in" class="oculto" accept=".txt,text/plain"></div>' +
      '<div class="acoes"><button class="prim" id="cl-cod-ok">📥 Importar</button><button id="cl-cod-x">Cancelar</button></div>', { titulo: "📥 Importar cotação", semRascunho: true });
    $("#cl-cod-x", j.el).onclick = function () { j.fechar(); };
    $("#cl-cod-arq", j.el).onclick = function () { $("#cl-cod-in", j.el).click(); };
    $("#cl-cod-in", j.el).onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { $("#cl-cod", j.el).value = String(r.result || ""); }; r.readAsText(f); };
    $("#cl-cod-ok", j.el).onclick = function () {
      var d = decodificar($("#cl-cod", j.el).value);
      if (!d || !Array.isArray(d.l)) { A.avisar("Não consegui ler esse código. Copie de novo, inteiro.", "erro"); return; }
      if (estado.linhas.length && !estado.id && !A.confirmar("A lista atual ainda não foi salva e será substituída. Continuar?")) return;
      Object.assign(estado, { id: null, nome: d.n || "", cat: CATS[d.c] ? d.c : "pintura", orc: tirarEquipe(d.o).orc, equipe: tirarEquipe(d.o).equipe, visao: d.v || "t_servicos",
        linhas: d.l.map(function (x) { return { tipo: x.t === "m" ? "material" : undefined, custo: x.t === "m" ? (x.cu !== undefined ? Number(x.cu) || 0 : Number(x.v) || 0) : undefined, desc: x.d, ref: x.r || x.d, un: x.u, qtd: Number(x.q) || 0, valor: Number(x.v) || 0, media: x.m === undefined ? null : x.m, min: x.mi === undefined ? null : x.mi, max: x.ma === undefined ? null : x.ma, cat: CATS[x.c] ? x.c : (CATS[d.c] ? d.c : "pintura") }; }) });
      guardar(); j.fechar(); desenhar(c); A.avisar("Cotação importada: " + estado.linhas.length + " itens", "ok");
    };
  }


  // ---- materiais direto do orçamento ou da nota da loja (PDF, foto ou XML do computador) ----
  var UN_LOJA = { und: "un", unid: "un", u: "un", pc: "pç", pca: "pç", peca: "pç", "peça": "pç", mt: "m", mts: "m", metro: "m", m2: "m²", rl: "rolo", rolos: "rolo", gl: "galão", galao: "galão", la: "lata", lt: "lata", lata: "lata", pct: "pacote", pcte: "pacote", br: "barra", cx: "cx", kg: "kg", l: "L" };
  function lerLoja(c, arq) {
    var CP = window.AGE_COMPRAS;
    if (!CP) { A.avisar("O leitor de notas não carregou. Recarregue a página.", "erro"); return; }
    var j = A.janela('<div id="lj-status" class="peq">🔎 Lendo ' + esc(arq.name) + "... (foto pode levar até 1 minuto)</div><div id=\"lj-prev\"></div>", { titulo: "📂 Materiais da loja", larga: true, semRascunho: true });
    function st(t, erro) { var e = $("#lj-status", j.el); if (e) { e.textContent = t; e.style.color = erro ? "var(--perigo,#c0392b)" : ""; } }
    CP.lerUmaNota(arq, function (t) { st(t); }).then(function (r) {
      var d = (r && r.dados) || {}, corr = window.AGE_CORR;
      var itens = (d.itens || []).map(function (x) {
        var q = Number(x.qtd) || 1, u = Number(x.unit) || (Number(x.valor) > 0 ? r2(Number(x.valor) / q) : 0), un = String(x.un || "un").toLowerCase().replace(/\.$/, ""), ds = String(x.item || x.descricao || "").replace(/\s+/g, " ").trim();
        return { desc: corr ? corr.corrigir(ds).texto : ds, qtd: q, un: UN_LOJA[un] || un || "un", unit: u };
      }).filter(function (x) { return x.desc; });
      if (!itens.length) { st("Não achei materiais nesse arquivo. Tente o PDF ou o XML da loja, ou uma foto mais reta e de perto.", true); return; }
      var tot = itens.reduce(function (s, x) { return s + r2(x.qtd * x.unit); }, 0);
      st("");
      // já há materiais na lista (orçamento antigo da loja)? oferece trocar pelos novos, com a mesma margem
      var velhos = estado.linhas.filter(function (l) { return l.tipo === "material"; }), vCusto = 0, vVenda = 0;
      velhos.forEach(function (l) { var cu = Number(l.custo) || 0; if (cu > 0) { vCusto += cu * (Number(l.qtd) || 0); vVenda += (Number(l.valor) || 0) * (Number(l.qtd) || 0); } });
      var mgVelha = vCusto > 0 ? Math.max(0, Math.round((vVenda / vCusto - 1) * 1000) / 10) : 0, totVelho = r2(velhos.reduce(function (z, l) { return z + (Number(l.qtd) || 0) * (Number(l.valor) || 0); }, 0));
      var trocar = velhos.length ? '<div class="cartao" style="margin:8px 0"><b>Já existem ' + velhos.length + " material(is) na lista (" + din(totVelho) + ')</b><label class="marca-linha" style="display:block;font-weight:400;margin-top:6px"><input type="radio" name="lj-modo" value="trocar" checked> <b>Trocar</b> os materiais antigos por estes (os serviços e a mão de obra não mudam)</label><label class="marca-linha" style="display:block;font-weight:400"><input type="radio" name="lj-modo" value="somar"> <b>Acrescentar</b> a estes, mantendo os antigos</label></div>' : "";
      $("#lj-prev", j.el).innerHTML = '<p class="peq mudo" style="margin:0 0 6px"><b>' + itens.length + " material(is)</b>" + (d.fornecedor ? " · " + esc(d.fornecedor) : "") + " · " + din(tot) + ' no total da loja. Confira nomes, quantidades e preços (a leitura de foto pode errar) e desmarque o que não vai.</p>' +
        '<div class="tabela-caixa"><table><thead><tr><th></th><th>Material</th><th>Qtd</th><th>Un</th><th>Custo na loja (un.)</th></tr></thead><tbody>' +
        itens.map(function (x, n) { return '<tr data-n="' + n + '"><td><input type="checkbox" class="lj-ok" checked aria-label="Usar"></td><td><input class="lj-d" maxlength="300" style="min-width:200px"></td><td><input class="lj-q" inputmode="decimal" style="width:70px"></td><td><input class="lj-u" style="width:70px" maxlength="12"></td><td><input class="lj-v" inputmode="decimal" style="width:100px"></td></tr>'; }).join("") +
        '</tbody></table></div>' + trocar + '<label style="display:block;margin-top:8px">Margem sobre o custo da loja (%) <span class="peq mudo">— ' + (mgVelha > 0 ? "a mesma dos materiais antigos; " : "") + 'pode ajustar depois na lista</span><input class="lj-m" inputmode="decimal" value="' + fq(mgVelha) + '" style="width:100px"></label>' +
        '<div class="acoes"><button class="prim" id="lj-ok">' + (velhos.length ? "✔ Usar estes materiais" : "➕ Adicionar à lista como materiais") + '</button><button id="lj-x">Cancelar</button></div>';
      $$("#lj-prev tbody tr", j.el).forEach(function (tr) { var x = itens[Number(tr.dataset.n)]; $(".lj-d", tr).value = x.desc; $(".lj-q", tr).value = fq(x.qtd); $(".lj-u", tr).value = x.un; $(".lj-v", tr).value = f2(x.unit); });
      $("#lj-x", j.el).onclick = function () { j.fechar(); };
      $("#lj-ok", j.el).onclick = function () {
        var m = A.lerNumero($(".lj-m", j.el).value) || 0, n = 0, novas = [], md = $('input[name="lj-modo"]:checked', j.el), trocarVelhos = !!(md && md.value === "trocar");
        $$("#lj-prev tbody tr", j.el).forEach(function (tr) {
          if (!$(".lj-ok", tr).checked) return;
          var q = A.lerNumero($(".lj-q", tr).value), cu = A.lerNumero($(".lj-v", tr).value), ds = $(".lj-d", tr).value.trim();
          if (!ds || !(q > 0)) return;
          novas.push({ tipo: "material", custo: cu, desc: ds, un: $(".lj-u", tr).value.trim() || "un", qtd: q, valor: r2(cu * (1 + m / 100)), media: null, min: null, max: null, cat: estado.cat }); n++;
        });
        if (!n) { A.avisar("Marque pelo menos um material.", "erro"); return; }
        if (trocarVelhos) estado.linhas = estado.linhas.filter(function (l) { return l.tipo !== "material"; });
        novas.forEach(function (x) { estado.linhas.push(x); });
        guardar(); j.fechar(); lista(c); A.avisar(trocarVelhos ? n + " material(is) novo(s) no lugar dos " + velhos.length + " antigos" : n + " material(is) adicionado(s) à lista", "ok");
      };
    }).catch(function (e) { st("Não consegui ler o arquivo: " + (A.msgErro ? A.msgErro(e) : e.message), true); });
  }
  // ---- margem em todos os materiais (sobre o custo da loja) ----
  function margem(c) {
    var j = A.janela('<p class="mudo peq" style="margin-top:0">O percentual é aplicado sobre o <b>custo da loja</b> de cada material (não acumula se você aplicar de novo). Depois dá para ajustar item por item.</p>' +
      '<label>Margem (%)<input class="mg-p" inputmode="decimal" value="15"></label><div class="acoes"><button class="prim" id="mg-ok">Aplicar</button><button id="mg-x">Cancelar</button></div>', { titulo: "💹 Margem nos materiais", semRascunho: true });
    $("#mg-x", j.el).onclick = function () { j.fechar(); };
    $("#mg-ok", j.el).onclick = function () {
      var p = A.lerNumero($(".mg-p", j.el).value);
      if (!(p >= 0 && p < 1000)) { A.avisar("Digite um percentual válido.", "erro"); return; }
      estado.linhas.forEach(function (l) { if (l.tipo === "material" && Number(l.custo) > 0) l.valor = r2(Number(l.custo) * (1 + p / 100)); });
      guardar(); j.fechar(); lista(c); A.avisar("Margem de " + A.numero(p, 1) + "% aplicada", "ok");
    };
  }


  // ---------- 👷 custo da equipe (honorários): só você vê; compara com o que a lista cobra ----------
  // funções da equipe (cargos); a diária de cada função é lembrada neste aparelho para a próxima obra
  var FUNCOES = ["Pintor", "Meio oficial de pintura", "Ajudante de pintura", "Eletricista", "Meio oficial de eletricista", "Ajudante de eletricista", "Encarregado / líder de equipe", "Servente / ajudante geral", "Técnico de TI / CFTV", "Instalador de portão eletrônico", "Operador de máquina de demarcação", "Motorista", "Responsável técnico (engenheiro)"];
  var CH_FN = "age_equipe_funcoes_v1";
  function lerFn() { try { var o = JSON.parse(localStorage.getItem(CH_FN) || "{}"); return { extras: Array.isArray(o.extras) ? o.extras : [], diarias: o.diarias || {} }; } catch (e) { return { extras: [], diarias: {} }; } }
  function guardarFn(o) { try { localStorage.setItem(CH_FN, JSON.stringify(o)); } catch (e) { /* ignora */ } }
  function listaFuncoes() { return FUNCOES.concat(lerFn().extras.filter(function (x) { return FUNCOES.indexOf(x) < 0; })); }
  function eq() { if (!estado.equipe) estado.equipe = { dias: 30, enc: 0, margem: 20, func: [], outros: [] }; return estado.equipe; }
  function custoEquipe() {
    var e = estado.equipe || { func: [], outros: [], enc: 0 }, dia = 0, ext = 0, out = 0;
    (e.func || []).forEach(function (f) { var pe = f.pessoas === undefined || f.pessoas === "" ? 1 : Number(f.pessoas) || 0; dia += r2(pe * (Number(f.dias) || 0) * (Number(f.diaria) || 0)); ext += r2(pe * (Number(f.dias) || 0) * (Number(f.extra) || 0)); });
    (e.outros || []).forEach(function (o) { out += Number(o.valor) || 0; });
    var enc = r2(dia * (Number(e.enc) || 0) / 100);
    return { dia: r2(dia), ext: r2(ext), enc: enc, out: r2(out), total: r2(dia + ext + enc + out) };
  }
  function resumoEquipe(c) {
    var el = c && $("#eq-res", c); if (!el) return;
    pintarMedia(c); pintarComp(c);
    var k = custoEquipe(), t = totais(), e = eq(), cobra = t.seu, res = r2(cobra - k.total), pct = cobra ? res / cobra * 100 : 0, mg = Number(e.margem) || 0;
    var minimo = mg > 0 && mg < 100 ? r2(k.total / (1 - mg / 100)) : null;
    el.innerHTML = '<div class="linha peq" style="justify-content:space-between"><span>Diárias</span><span>' + din(k.dia) + '</span></div>' +
      (k.ext ? '<div class="linha peq" style="justify-content:space-between"><span>Transporte / alimentação</span><span>' + din(k.ext) + "</span></div>" : "") +
      (k.enc ? '<div class="linha peq" style="justify-content:space-between"><span>Encargos e benefícios</span><span>' + din(k.enc) + "</span></div>" : "") +
      (k.out ? '<div class="linha peq" style="justify-content:space-between"><span>Outros honorários</span><span>' + din(k.out) + "</span></div>" : "") +
      '<div class="linha" style="justify-content:space-between;border-top:1px solid var(--borda);margin-top:4px;padding-top:4px"><b>Custo total da equipe</b><b>' + din(k.total) + "</b></div>" +
      (cobra ? '<div class="linha" style="justify-content:space-between;margin-top:6px"><span>Mão de obra cobrada na lista</span><span>' + din(cobra) + '</span></div><div class="linha" style="justify-content:space-between"><b>Sobra (cobrado − custo da equipe)</b><b style="color:' + (res >= 0 ? "var(--bom,#1b7f3b)" : "var(--perigo,#c0392b)") + '">' + din(res) + " (" + A.numero(pct, 1) + "%)</b></div>" : '<p class="peq mudo" style="margin:6px 0 0">Adicione serviços à lista acima para comparar com o que você cobra.</p>') +
      (minimo !== null && k.total > 0 ? '<div class="linha" style="justify-content:space-between;margin-top:4px"><span>Preço mínimo da mão de obra para ter ' + A.numero(mg, 1) + '% de sobra</span><b>' + din(minimo) + "</b></div>" + (cobra && cobra < minimo ? '<p class="peq" style="color:var(--perigo,#c0392b);margin:4px 0 0">⚠ O que você cobra está ' + din(r2(minimo - cobra)) + " abaixo desse mínimo.</p>" : "") : "") +
      (t.mat > 0 ? (function () {
        var totalOrc = r2(cobra + t.mat), sobraT = r2(totalOrc - k.total - t.matCusto), pctT = totalOrc ? sobraT / totalOrc * 100 : 0, ln = function (a1, v1, forte) { return '<div class="linha' + (forte ? "" : " peq") + '" style="justify-content:space-between;margin-top:2px"><' + (forte ? "b" : "span") + ">" + a1 + "</" + (forte ? "b" : "span") + "><" + (forte ? "b" : "span") + ">" + v1 + "</" + (forte ? "b" : "span") + "></div>"; };
        return '<div style="border-top:1px solid var(--borda);margin-top:8px;padding-top:6px"><b>📦 Com os materiais</b>' + ln("Mão de obra cobrada na lista", din(cobra)) + ln("Materiais (valor de venda, com a margem)", din(t.mat)) + ln("Total do orçamento (mão de obra + materiais)", din(totalOrc), true) +
          ln("(−) Custo da equipe", din(k.total)) + ln("(−) Custo dos materiais na loja", din(t.matCusto)) +
          '<div class="linha" style="justify-content:space-between;margin-top:2px"><b>Sobra total</b><b style="color:' + (sobraT >= 0 ? "var(--bom,#1b7f3b)" : "var(--perigo,#c0392b)") + '">' + din(sobraT) + " (" + A.numero(pctT, 1) + "%)</b></div>" +
          '<p class="peq mudo" style="margin:4px 0 0">Sobra = total do orçamento − custo da equipe − custo dos materiais na loja. Não desconta imposto, transporte do material nem outros gastos.</p></div>';
      })() : "");
  }
  // ---- 📊 comparar esta cotação com uma obra já feita (aba Custo de obras): metragem, custos, despesas e sobra por m² ----
  var OBRAS, obrasBusy = false, compSel = "";
  function compCartao(c) {
    var el = $("#cl-comp", c); if (!el || !P) return;
    el.innerHTML = '<details class="cartao" id="cp-cx"><summary><b>📊 Comparar com uma obra já feita</b> <span class="peq mudo">· metragem, custos, despesas e sobra por m²</span></summary><div class="linha" style="gap:8px;align-items:flex-end;margin-top:6px;flex-wrap:wrap"><label style="width:230px">Metragem desta cotação (m²) <input id="cp-am" inputmode="decimal" placeholder="Ex.: 963"></label><span class="peq mudo" style="flex:1;min-width:220px">Para obras de linhas e símbolos (em metros e unidades), digite a área pintada. Vazio = soma dos serviços em m².</span></div><div id="cp-corpo"></div></details>';
    var am = $("#cp-am", el), eqv = estado.equipe || {}; am.value = Number(eqv.areaObra) > 0 ? fq(eqv.areaObra) : "";
    am.oninput = function () { eq().areaObra = A.lerNumero(this.value) || 0; guardar(); pintarComp(c); pintarMedia(c); };
    if (OBRAS === undefined && !(window.AGE_CUSTOS && window.AGE_CUSTOS.todas)) OBRAS = [];
    if (OBRAS === undefined && !obrasBusy && window.AGE_CUSTOS && window.AGE_CUSTOS.todas) { obrasBusy = true; window.AGE_CUSTOS.todas(P).then(function (L) { OBRAS = L; obrasBusy = false; pintarComp(c); }); }
    pintarComp(c);
  }
  // metragem lembrada por obra (digitada uma vez) e metragem achada numa cotação salva com o mesmo nome
  function lerAreas() { try { return JSON.parse(localStorage.getItem("age_comp_area") || "{}") || {}; } catch (e) { return {}; } }
  function guardarArea(k, v) { try { var o = lerAreas(); if (v > 0) o[k] = v; else delete o[k]; localStorage.setItem("age_comp_area", JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } }
  // metragem da cotação: a digitada no cartão de comparação (vale para obras de linhas e símbolos, em m e un) ou a soma dos serviços em m²
  function areaCot() { var m = Number((estado.equipe || {}).areaObra) || 0; return m > 0 ? m : areaDe(estado.linhas); }
  function areaDe(linhas) { var a = 0; (linhas || []).forEach(function (l) { if (l && l.tipo !== "material" && /^m(²|2)$/i.test(String(l.un || "").trim())) a += Number(l.qtd) || 0; }); return a; }
  function achaCotacao(nome) {
    var chave = semAcento(String(nome || "").replace(/\(.*?\)/g, "")).split(/\s+/).filter(function (w) { return w.length >= 3; })[0]; if (!chave) return null;
    var cs = cot.filter(function (x) { return x.id !== estado.id && semAcento(x.nome).indexOf(chave) >= 0 && areaDe(x.linhas) > 0; });
    return cs[0] ? { nome: cs[0].nome, area: areaDe(cs[0].linhas) } : null;
  }
  function finalizadas() {
    try { return window.AGE_FAT && window.AGE_FAT.resultadoTodos ? window.AGE_FAT.resultadoTodos(P).filter(function (x) { return x.k !== "-" && (x.entrada || x.gastos); }) : []; } catch (e) { return []; }
  }
  function pintarComp(c) {
    var el = c && $("#cp-corpo", c); if (!el) return;
    if (OBRAS === undefined) { el.innerHTML = '<p class="peq mudo">Carregando as obras...</p>'; return; }
    var FIN = finalizadas();
    if (!OBRAS.length && !FIN.length) { el.innerHTML = '<p class="peq mudo">Ainda não há obra finalizada para comparar. As obras com notas, compras e pagamentos lançados em <b>💼 Notas e resultado</b> aparecem aqui sozinhas. Também dá para cadastrar uma obra em <b>📈 Custo de obras</b>.</p>'; return; }
    var antes = $("#cp-sel", el) ? $("#cp-sel", el).value : compSel;
    var area = areaCot(), t = totais(), k = custoEquipe();
    el.innerHTML = '<label style="display:block;margin-top:6px">Obra para comparar<select id="cp-sel"><option value="">— escolha —</option>' +
      (FIN.length ? '<optgroup label="✅ Obras finalizadas (Notas e resultado)">' + FIN.map(function (x) { return '<option value="f:' + esc(x.k) + '"' + ("f:" + x.k === antes ? " selected" : "") + ">" + esc(x.nome) + (x.entrada ? " · notas " + din(x.notasV || x.portal) : "") + "</option>"; }).join("") + "</optgroup>" : "") +
      (OBRAS.length ? '<optgroup label="📈 Custo de obras">' + OBRAS.map(function (o) { return '<option value="o:' + esc(o.id) + '"' + ("o:" + o.id === antes ? " selected" : "") + ">" + esc(o.nome) + (o.status === "concluida" ? " (concluída)" : " (em andamento)") + "</option>"; }).join("") + "</optgroup>" : "") +
      '</select></label><div id="cp-res"></div>';
    function mostrar() {
      compSel = $("#cp-sel", el).value; var r = $("#cp-res", el), ref = null;
      if (!compSel) { r.innerHTML = ""; return; }
      if (!(area > 0)) { r.innerHTML = '<p class="peq mudo">Informe a <b>metragem desta cotação (m²)</b> acima, ou coloque serviços em m² na lista, para comparar por metro quadrado.</p>'; return; }
      if (compSel.charAt(0) === "o") {
        var o = OBRAS.filter(function (y) { return "o:" + y.id === compSel; })[0]; if (!o) { r.innerHTML = ""; return; }
        if (!(o.c.area > 0)) { r.innerHTML = '<p class="peq" style="color:var(--atencao,#b7791f)">Essa obra não tem metragem lançada. Abra-a em <b>📈 Custo de obras</b> e preencha a área (m²) de cada etapa.</p>'; return; }
        ref = { nome: o.nome, area: o.c.area, mo: o.c.mo, outros: o.c.outros, total: o.c.total, cobrado: o.cobrado };
      } else {
        var x = FIN.filter(function (y) { return "f:" + y.k === compSel; })[0]; if (!x) { r.innerHTML = ""; return; }
        var mem = lerAreas()[x.k], ach = achaCotacao(x.nome), a0 = mem || (ach ? Math.round(ach.area * 100) / 100 : 0);
        r.innerHTML = '<div class="linha" style="gap:8px;align-items:flex-end;margin-top:6px"><label style="width:200px">Metragem de <b>' + esc(x.nome) + '</b> (m²)<input id="cp-area" inputmode="decimal" value="' + (a0 ? esc(fq(a0)) : "") + '"></label><span class="peq mudo" style="flex:1;min-width:200px">' +
          (mem ? "Lembrada da última vez." : ach ? "Achei " + A.numero(ach.area, 0) + ' m² na cotação salva “' + esc(ach.nome) + '”.' : "O app não sabe a metragem dessa obra: digite uma vez e ela fica lembrada.") + '</span></div><div id="cp-tab"></div>';
        var tab = function () {
          var A0 = A.lerNumero($("#cp-area", r).value) || 0; guardarArea(x.k, A0);
          if (!(A0 > 0)) { $("#cp-tab", r).innerHTML = '<p class="peq mudo">Digite a metragem para ver a comparação por m².</p>'; return; }
          $("#cp-tab", r).innerHTML = tabela({ nome: x.nome, area: A0, mo: x.mo, outros: r2(x.mat + x.av + (x.impEmp || 0)), total: r2(x.mat + x.mo + x.av + (x.impEmp || 0)), cobrado: x.notasV || x.portal || 0 }) + (x.mo === 0 ? '<p class="peq" style="color:var(--atencao,#b7791f);margin:6px 0 0">⚠ Essa obra está sem mão de obra paga ligada: o custo e a sobra dela aparecem melhores do que foram. Ligue os pagamentos da equipe à obra (Pagamentos › Obra / cliente) ou cadastre a obra em Custo de obras com a mão de obra real.</p>' : "");
        };
        $("#cp-area", r).oninput = tab; tab(); return;
      }
      r.innerHTML = tabela(ref);
    }
    function tabela(o) {
      var totCob = r2(t.seu + t.mat), custoC = r2(k.total + t.matCusto), sobraC = r2(totCob - custoC), pctC = totCob ? sobraC / totCob * 100 : 0;
      var sobraO = o.cobrado ? r2(o.cobrado - o.total) : null, pctO = o.cobrado ? sobraO / o.cobrado * 100 : null, est = r2(o.total / o.area * area);
      function lin(rot, a1, b1, forte) { var T = forte ? "b" : "span"; return '<tr><td>' + rot + '</td><td style="text-align:right"><' + T + ">" + a1 + "</" + T + '></td><td style="text-align:right"><' + T + ">" + b1 + "</" + T + "></td></tr>"; }
      return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th class="peq mudo"></th><th style="text-align:right" class="peq mudo">Esta cotação</th><th style="text-align:right" class="peq mudo">' + esc(o.nome) + "</th></tr></thead><tbody>" +
        lin("Metragem (m²)", A.numero(area, 0), A.numero(o.area, 0)) +
        lin("Custo da mão de obra por m²", k.total > 0 ? din(r2(k.total / area)) : "—", din(r2(o.mo / o.area))) +
        lin("Material e outras despesas por m²", t.matCusto > 0 ? din(r2(t.matCusto / area)) : "—", din(r2(o.outros / o.area))) +
        lin("Custo total por m²", din(r2(custoC / area)), din(r2(o.total / o.area)), true) +
        lin("Valor cobrado por m²", din(r2(totCob / area)), o.cobrado ? din(r2(o.cobrado / o.area)) : "—") +
        lin("Custo total (R$)", din(custoC), din(o.total)) +
        lin("Valor cobrado (R$)", din(totCob), o.cobrado ? din(o.cobrado) : "—") +
        lin("Sobra (R$ e %)", din(sobraC) + " (" + A.numero(pctC, 1) + "%)", sobraO === null ? "—" : din(sobraO) + " (" + A.numero(pctO, 1) + "%)", true) + "</tbody></table></div>" +
        '<p class="peq" style="margin:6px 0 0">Com o custo por m² dessa obra, os <b>' + A.numero(area, 0) + " m²</b> desta cotação custariam cerca de <b>" + din(est) + "</b> (a cotação tem custo de " + din(custoC) + ").</p>" +
        '<p class="peq mudo" style="margin:4px 0 0">Serve como noção de valores: a tinta (epóxi ou viária), o piso e a equipe mudam o custo. O custo da equipe da cotação vem do cartão acima, e o material, do custo da loja na lista.</p>';
    }
    $("#cp-sel", el).onchange = mostrar; mostrar();
  }

  // ---- 🔍 laudo técnico (vistoria e solução): escolher um modelo, editar e salvar como modelo; vai junto ao criar o orçamento ----
  function laudoCartao(c) {
    var el = $("#cl-laudo", c); if (!el || !P || !P.laudos) return;
    var l0 = (estado.orc && estado.orc.laudo) || {};
    el.innerHTML = '<details class="cartao" id="lz-cx"' + (String(l0.vistoria || "").trim() || String(l0.solucao || "").trim() ? " open" : "") + '><summary><b>🔍 Laudo técnico (vistoria e solução)</b> <span class="peq mudo">· vai junto quando você criar o orçamento</span></summary>' +
      '<select id="lz-mod" aria-label="Modelo de laudo" style="width:100%;margin-top:8px"></select>' +
      '<label>Vistoria técnica<textarea id="lz-vist" rows="5" maxlength="4000"></textarea></label><label>Solução e materiais<textarea id="lz-sol" rows="9" maxlength="6000"></textarea></label>' +
      '<div class="acoes"><button class="peq" id="lz-salvar">💾 Salvar como modelo</button><button class="peq perigo" id="lz-apagar">🗑 Apagar o modelo escolhido</button><button class="peq" id="lz-limpar">🧹 Limpar o laudo</button></div>' +
      '<p class="peq mudo" style="margin:4px 0 0">Os modelos salvos ficam guardados e aparecem aqui e no orçamento, para usar em outros serviços. O modelo pronto não muda: o que você edita vale só para esta cotação.</p></details>';
    var vi = $("#lz-vist", el), so = $("#lz-sol", el), mod = $("#lz-mod", el);
    vi.value = l0.vistoria || ""; so.value = l0.solucao || "";
    function lista(sel) { mod.innerHTML = '<option value="">📑 Usar um modelo de laudo...</option>' + P.laudos.lista().map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.titulo) + (m.padrao ? " (modelo pronto)" : "") + "</option>"; }).join(""); mod.value = sel || ""; }
    function gravarLaudo() { estado.orc = estado.orc || {}; estado.orc.laudo = Object.assign({ vistoria: "", solucao: "", escopo: "" }, estado.orc.laudo || {}, { vistoria: vi.value.trim(), solucao: so.value.trim() }); guardar(); }
    lista();
    vi.oninput = gravarLaudo; so.oninput = gravarLaudo;
    mod.onchange = function () {
      var m = P.laudos.lista().filter(function (y) { return y.id === mod.value; })[0]; if (!m) return;
      if ((vi.value.trim() || so.value.trim()) && !A.confirmar("Trocar o laudo que está escrito pelo modelo “" + m.titulo + "”?")) { mod.value = ""; return; }
      vi.value = m.vistoria || ""; so.value = m.solucao || ""; gravarLaudo(); A.avisar("📑 Modelo “" + m.titulo + "” colocado. Edite o que precisar para este cliente.", "ok");
    };
    $("#lz-salvar", el).onclick = function () {
      if (!vi.value.trim() && !so.value.trim()) { A.avisar("Escreva a vistoria ou a solução antes de salvar como modelo.", "erro"); return; }
      var esc0 = P.laudos.lista().filter(function (y) { return y.id === mod.value; })[0], sug = esc0 && !esc0.padrao ? esc0.titulo : String(estado.nome || "").slice(0, 60);
      var t = window.prompt("Nome do modelo de laudo (para achar na lista).\nSe já existir um modelo seu com este nome, ele é atualizado:", sug); if (t === null) return;
      P.laudos.salvar(t, vi.value.trim(), so.value.trim()).then(function (r) { lista(r.modelo.id); A.avisar("💾 Modelo de laudo “" + r.modelo.titulo + "” " + (r.atualizou ? "atualizado" : "salvo"), "ok"); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
    };
    $("#lz-apagar", el).onclick = function () {
      var m = P.laudos.lista().filter(function (y) { return y.id === mod.value; })[0];
      if (!m) { A.avisar("Escolha na lista o modelo que quer apagar.", "erro"); return; }
      if (!m.padrao && !A.confirmar("Apagar o modelo de laudo “" + m.titulo + "”? As cotações e os orçamentos que já usaram continuam iguais.")) return;
      P.laudos.apagar(m.id).then(function () { lista(); A.avisar("Modelo apagado", "ok"); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
    };
    $("#lz-limpar", el).onclick = function () { if (!A.confirmar("Limpar o texto do laudo desta cotação?")) return; vi.value = ""; so.value = ""; gravarLaudo(); mod.value = ""; };
  }

  // ---- 📈 preço sugerido pela média das obras concluídas (aba Custo de obras) ----
  var MEDIA, medBusy = false;   // undefined = ainda não carregou; null = sem obras concluídas
  function pintarMedia(c) {
    var el = c && $("#eq-media", c); if (!el) return;
    if (MEDIA === undefined) { el.innerHTML = ""; return; }
    if (!MEDIA) { el.innerHTML = '<p class="peq mudo" style="margin:8px 0 0">📈 Quando você marcar obras como <b>Concluídas</b> na aba Custo de obras, aqui aparece o preço sugerido pela média delas.</p>'; return; }
    var e = eq(), t = totais(), mg = Number(e.margem) || 0, fm = mg > 0 && mg < 100 ? 1 - mg / 100 : 1, area = 0, sug = [];
    area = areaCot();
    if (MEDIA.moPorM2 > 0 && area > 0) sug.push({ rot: "Média por m² (" + din(MEDIA.moPorM2) + "/m² × " + A.numero(area, 0) + " m²)", custo: r2(MEDIA.moPorM2 * area) });
    if (MEDIA.moPorDia > 0 && Number(e.dias) > 0) sug.push({ rot: "Média por dia (" + din(MEDIA.moPorDia) + "/dia × " + A.numero(e.dias, 0) + " dias)", custo: r2(MEDIA.moPorDia * e.dias) });
    el.innerHTML = '<div style="border-top:1px solid var(--borda);margin-top:8px;padding-top:6px"><b>📈 Pela média das suas obras</b> <span class="peq mudo">(' + MEDIA.obras + " obra(s) concluída(s))</span>" +
      (sug.length ? sug.map(function (o, i) { var pr = r2(o.custo / fm); return '<div class="linha peq" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:4px"><span>' + esc(o.rot) + ": custo <b>" + din(o.custo) + "</b> → preço com " + A.numero(mg, 1) + '% de sobra <b>' + din(pr) + '</b></span><button class="peq" data-aj="' + pr + '">Usar este valor</button></div>'; }).join("") + '<p class="peq mudo" style="margin:4px 0 0">“Usar este valor” ajusta os preços dos serviços da lista, na mesma proporção, para a mão de obra chegar a esse total (materiais não mudam). Hoje a lista cobra ' + din(t.seu) + ".</p>"
        : '<p class="peq mudo" style="margin:4px 0 0">Coloque serviços em m² na lista (e/ou os dias de obra) para ver o preço sugerido.' + (MEDIA.moPorM2 > 0 ? "" : " Lance a área das etapas na aba Custo de obras para ter a média por m².") + "</p>") + "</div>";
    $$("[data-aj]", el).forEach(function (b) {
      b.onclick = function () {
        var alvo = Number(b.dataset.aj), cur = totais().seu;
        if (!(cur > 0)) { A.avisar("Coloque os serviços na lista primeiro.", "erro"); return; }
        var fat = alvo / cur;
        if (!A.confirmar("Mudar os preços dos serviços da lista de " + din(cur) + " para cerca de " + din(alvo) + " (todos x " + A.numero(fat, 3) + ")? Os materiais não mudam.")) return;
        estado.linhas.forEach(function (l) { if (l.tipo !== "material") l.valor = r2(l.valor * fat); });
        guardar(); desenhar(c); A.avisar("Preços ajustados pela média das obras", "ok");
      };
    });
  }
  function carregarMedia(c) {
    if (MEDIA !== undefined || medBusy || !P || !window.AGE_CUSTOS || !window.AGE_CUSTOS.mediaAtual) return;
    medBusy = true; window.AGE_CUSTOS.mediaAtual(P).then(function (m) { MEDIA = m || null; medBusy = false; pintarMedia(c); });
  }
  // nomes sem repetição (o cadastro pode ter o mesmo funcionário duas vezes)
  function nomesFunc(fs) { var vistos = {}; return (fs || []).filter(function (x) { var k = semAcento(x.nome).trim(); if (!k || vistos[k]) return false; vistos[k] = 1; return true; }); }
  function equipeCartao(c) {
    var el = $("#cl-equipe", c); if (!el) return;
    var e = eq(), fs = ((P && P.S.func) || []).filter(function (f) { return f.ativo !== false; }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), "pt-BR"); });
    el.innerHTML = '<details class="cartao" id="eq-cx"' + ((e.func.length || e.outros.length) ? " open" : "") + '><summary><b>👷 Custo da equipe (honorários)</b> <span class="selo">só você vê</span> <span class="peq mudo">· quanto a equipe custa nesta obra</span></summary>' +
      '<p class="peq mudo" style="margin:6px 0">Escolha quem vai trabalhar, os dias e a diária (vem do cadastro da equipe, e você pode mudar aqui). O app soma o custo e compara com o que a lista cobra de mão de obra. Nada disso vai para o orçamento do cliente.</p>' +
      '<div class="linha" style="gap:8px"><label style="width:150px">Dias de obra (padrão)<input class="eq-dias" inputmode="decimal" value="' + esc(fq(e.dias)) + '"></label><label style="width:160px">Encargos e benefícios (%)<input class="eq-enc" inputmode="decimal" value="' + esc(fq(e.enc)) + '"></label><label style="width:170px">Sobra desejada (%)<input class="eq-mg" inputmode="decimal" value="' + esc(fq(e.margem)) + '"></label></div>' +
      '<datalist id="eq-dl-fn">' + listaFuncoes().map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + '</datalist><datalist id="eq-dl-f">' + nomesFunc(fs).map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join("") + '</datalist>' +
      '<div id="eq-func">' + e.func.map(function (f, i) {
        var fnL = listaFuncoes(); if (f.funcao && fnL.indexOf(f.funcao) < 0) fnL.push(f.funcao);
        return '<div class="linha eq-lin" data-i="' + i + '" style="gap:6px;margin-top:8px;align-items:flex-end;flex-wrap:wrap"><label style="flex:2;min-width:190px">Função <span class="peq mudo">(escolha ou digite)</span><input class="eq-fn" list="eq-dl-fn" maxlength="60" placeholder="Ex.: Pintor" value="' + esc(f.funcao || "") + '"></label>' +
          '<label style="flex:2;min-width:170px">Funcionário (opcional) <span class="peq mudo">(escolha ou digite)</span><input class="eq-f" list="eq-dl-f" maxlength="80" placeholder="Nome" value="' + esc(f.nome || (f.id ? (fs.filter(function (y) { return y.id === f.id; })[0] || {}).nome || "" : "")) + '"></label>' +
          '<label style="width:78px">Pessoas<input class="eq-p" inputmode="decimal" value="' + esc(fq(f.pessoas === undefined || f.pessoas === "" ? 1 : f.pessoas)) + '"></label><label style="width:78px">Dias<input class="eq-d" inputmode="decimal" value="' + esc(fq(f.dias)) + '"></label>' +
          '<label style="width:110px">Diária (R$)<input class="eq-v" inputmode="decimal" value="' + esc(f2(f.diaria)) + '"></label><label style="width:120px">Transp./alim. por dia<input class="eq-x" inputmode="decimal" value="' + esc(f2(f.extra)) + '"></label><button class="peq perigo" data-eq-tirar="' + i + '" aria-label="Tirar">🗑</button></div>';
      }).join("") + "</div>" +
      '<div id="eq-out">' + e.outros.map(function (o, i) {
        return '<div class="linha eq-ou" data-i="' + i + '" style="gap:6px;margin-top:6px;align-items:flex-end"><label style="flex:3;min-width:200px">Outro honorário (ART, responsável técnico, terceiro...)<input class="eq-od" maxlength="120" value="' + esc(o.desc || "") + '"></label><label style="width:130px">Valor (R$)<input class="eq-ov" inputmode="decimal" value="' + esc(f2(o.valor)) + '"></label><button class="peq perigo" data-eq-tirar-o="' + i + '" aria-label="Tirar">🗑</button></div>';
      }).join("") + "</div>" +
      '<div class="acoes"><button class="peq" id="eq-add">➕ Função / funcionário</button><button class="peq" id="eq-add-o">➕ Outro honorário</button></div><div class="linha" style="gap:6px;margin-top:4px"><input class="eq-nf" maxlength="60" placeholder="Nova função (ex.: Soldador)" style="flex:1;min-width:180px"><button class="peq" id="eq-nf-ok">Adicionar à lista de funções</button></div><div id="eq-media"></div><div id="eq-res" style="margin-top:8px"></div></details>';
    function salvar() { guardar(); }
    $(".eq-dias", el).oninput = function () { e.dias = A.lerNumero(this.value) || 0; salvar(); };
    $(".eq-enc", el).oninput = function () { e.enc = A.lerNumero(this.value) || 0; salvar(); resumoEquipe(c); };
    $(".eq-mg", el).oninput = function () { e.margem = A.lerNumero(this.value) || 0; salvar(); resumoEquipe(c); };
    $("#eq-add", el).onclick = function () { e.func.push({ id: "", funcao: "", nome: "", pessoas: 1, dias: e.dias || 0, diaria: 0, extra: 0 }); salvar(); equipeCartao(c); };
    $("#eq-nf-ok", el).onclick = function () {
      var n = $(".eq-nf", el).value.trim(); if (!n) return;
      var o = lerFn(); if (listaFuncoes().indexOf(n) < 0) { o.extras.push(n); guardarFn(o); }
      A.avisar("Função “" + n + "” adicionada à lista", "ok"); equipeCartao(c);
    };
    $("#eq-add-o", el).onclick = function () { e.outros.push({ desc: "", valor: 0 }); salvar(); equipeCartao(c); };
    $$(".eq-lin", el).forEach(function (d) {
      var f = e.func[Number(d.dataset.i)];
      $(".eq-fn", d).oninput = function () { f.funcao = this.value.trim(); salvar(); };
      $(".eq-fn", d).onchange = function () {
        f.funcao = this.value.trim(); var m = lerFn().diarias[f.funcao];
        if (f.funcao && listaFuncoes().indexOf(f.funcao) < 0) { var o0 = lerFn(); o0.extras.push(f.funcao); guardarFn(o0); }   // função nova digitada fica na lista
        if (m && !f.id) { if (Number(m.diaria) > 0) f.diaria = Number(m.diaria); if (Number(m.extra) > 0 && !(Number(f.extra) > 0)) f.extra = Number(m.extra); $(".eq-v", d).value = f2(f.diaria); $(".eq-x", d).value = f2(f.extra); }
        salvar(); resumoEquipe(c);
      };
      function achaFunc(nome) { var n = semAcento(nome).trim(); return n ? nomesFunc(fs).filter(function (y) { return semAcento(y.nome).trim() === n; })[0] : null; }
      $(".eq-f", d).oninput = function () { var x = achaFunc(this.value); f.nome = this.value.trim(); f.id = x ? x.id : ""; salvar(); };
      $(".eq-f", d).onchange = function () {
        var x = achaFunc(this.value); f.nome = this.value.trim(); f.id = x ? x.id : "";
        if (x) { f.nome = x.nome; this.value = x.nome; if (Number(x.diaria) > 0) { f.diaria = Number(x.diaria); $(".eq-v", d).value = f2(f.diaria); } }
        salvar(); resumoEquipe(c);
      };
      function ler(ev) {
        f.pessoas = A.lerNumero($(".eq-p", d).value); if (!(f.pessoas >= 0)) f.pessoas = 1; f.dias = A.lerNumero($(".eq-d", d).value) || 0; f.diaria = A.lerNumero($(".eq-v", d).value) || 0; f.extra = A.lerNumero($(".eq-x", d).value) || 0;
        // a diária (e o transporte/alimentação) digitados ficam lembrados para a função, nas próximas obras
        if (ev && ev.target && /eq-(v|x)/.test(ev.target.className) && f.funcao && !f.id) { var o = lerFn(); o.diarias[f.funcao] = { diaria: f.diaria, extra: f.extra }; guardarFn(o); }
        salvar(); resumoEquipe(c);
      }
      $$("input", d).forEach(function (i) { i.addEventListener("input", ler); });
    });
    $$(".eq-ou", el).forEach(function (d) {
      var o = e.outros[Number(d.dataset.i)];
      $$("input", d).forEach(function (i) { i.addEventListener("input", function () { o.desc = $(".eq-od", d).value; o.valor = A.lerNumero($(".eq-ov", d).value) || 0; salvar(); resumoEquipe(c); }); });
    });
    $$("[data-eq-tirar]", el).forEach(function (b) { b.onclick = function () { e.func.splice(Number(b.dataset.eqTirar), 1); salvar(); equipeCartao(c); }; });
    $$("[data-eq-tirar-o]", el).forEach(function (b) { b.onclick = function () { e.outros.splice(Number(b.dataset.eqTirarO), 1); salvar(); equipeCartao(c); }; });
    resumoEquipe(c);
    carregarMedia(c);
  }

  // ---- lista de serviços ----
  function lista(c) {
    var el = $("#cl-lista", c);
    if (!estado.linhas.length) { resumoEquipe(c); el.innerHTML = '<div class="cartao vazio">Sua lista está vazia. Escolha um serviço, digite a metragem e toque em ➕ Adicionar.</div>'; return; }
    resumoEquipe(c);
    var t = totais(), dif = t.media ? ((t.seu - t.media) / t.media * 100) : 0, temMat = estado.linhas.some(function (l) { return l.tipo === "material"; });
    el.innerHTML = '<div class="cartao"><h3 style="margin-top:0">Sua lista</h3>' + (temMat ? '<div class="acoes" style="margin-top:0"><button class="peq" id="cl-margem" title="Aplica um percentual sobre o custo da loja em todos os materiais">💹 Margem nos materiais</button><button class="peq" id="cl-custo" title="Volta todos os materiais ao custo da loja">↺ Tudo ao custo</button></div>' : "") + estado.linhas.map(function (l, i) {
      return '<div class="cl-lin" data-i="' + i + '" style="border-top:1px solid var(--borda);padding:8px 0">' + (l.tipo === "material" ? '<span class="selo">🧱 material</span>' : "") + '<input class="l-desc" maxlength="300" value="' + esc(l.desc) + '" style="width:100%">' +
        '<div class="linha" style="gap:8px;margin-top:6px;align-items:flex-end"><label style="width:110px">Qtd (' + esc(l.un) + ')<input class="l-q" inputmode="decimal" value="' + esc(fq(l.qtd)) + '"></label>' +
        '<label style="width:130px">R$ por ' + esc(l.un) + '<input class="l-v" inputmode="decimal" value="' + esc(f2(l.valor)) + '"></label>' +
        '<div style="flex:1;min-width:120px"><b class="l-sub">' + din(r2(l.qtd * l.valor)) + '</b><div class="peq mudo l-ref">' + esc(faixaTxt(l)) + '</div><div class="l-av">' + aviso(l) + '</div></div>' +
        '<button class="peq" data-med="' + i + '" title="' + (l.tipo === "material" ? "Volta ao custo da loja (tira a margem)" : "Volta ao preço médio da tabela") + '"' + ((l.tipo === "material" ? !(Number(l.custo) > 0) : (l.media === null || l.media === undefined)) ? " disabled" : "") + '>' + (l.tipo === "material" ? "↺ custo" : "↺ média") + '</button><button class="peq perigo" data-tirar="' + i + '" aria-label="Tirar da lista">🗑</button></div></div>';
    }).join("") + '<div style="border-top:2px solid var(--borda);margin-top:8px;padding-top:8px"><div class="linha" style="justify-content:space-between"><span>' + (temMat ? "Mão de obra" : "Total pelo seu preço") + '</span><b id="cl-tot" style="font-size:' + (temMat ? "16" : "20") + 'px">' + din(t.seu) + "</b></div>" +
      (temMat ? '<div class="linha" style="justify-content:space-between"><span>Materiais</span><b id="cl-tmat" style="font-size:16px">' + din(t.mat) + '</b></div><div class="linha peq mudo" style="justify-content:space-between"><span>Custo dos materiais na loja · margem</span><span id="cl-tcusto">' + din(t.matCusto) + " · " + din(r2(t.mat - t.matCusto)) + '</span></div><div class="linha" style="justify-content:space-between"><span>Total geral</span><b id="cl-tgeral" style="font-size:20px">' + din(r2(t.seu + t.mat)) + "</b></div>" : "") +
      '<div class="linha peq mudo" style="justify-content:space-between"><span>Pela média da tabela' + (t.semMedia ? " (sem " + t.semMedia + " item(ns) sem preço)" : "") + '</span><span id="cl-tmed">' + din(t.media) + (t.media ? " (" + (dif >= 0 ? "+" : "") + A.numero(dif, 1) + "%)" : "") + "</span></div></div>" +
      '<label style="display:block;margin-top:10px">Como o cliente vê o orçamento no PDF<select id="cl-visao"><option value="t_servicos">Só os serviços (sem valores) e o valor total — materiais não aparecem</option><option value="itens">Cada serviço com o seu valor</option><option value="total">Só mão de obra e o total (materiais por conta do cliente, lista à parte)</option></select></label><span class="peq mudo">Os materiais você acrescenta no orçamento (+ Material, 📋 Escolher da lista ou 📷 Ler nota da loja).</span>' +
      '<div class="acoes"><button class="prim" id="cl-orc">📄 Criar orçamento com esta lista</button><button id="cl-copiar">📋 Copiar</button><button class="perigo" id="cl-limpar">🧹 Limpar lista</button></div></div>';
    function atualizarTotais() {
      var t2 = totais(), d2 = t2.media ? ((t2.seu - t2.media) / t2.media * 100) : 0;
      resumoEquipe(c); $("#cl-tot", c).textContent = din(t2.seu); if ($("#cl-tmat", c)) { $("#cl-tcusto", c).textContent = din(t2.matCusto) + " · " + din(r2(t2.mat - t2.matCusto)); $("#cl-tmat", c).textContent = din(t2.mat); $("#cl-tgeral", c).textContent = din(r2(t2.seu + t2.mat)); } $("#cl-tmed", c).textContent = din(t2.media) + (t2.media ? " (" + (d2 >= 0 ? "+" : "") + A.numero(d2, 1) + "%)" : "");
    }
    $$(".cl-lin", el).forEach(function (d) {
      var l = estado.linhas[Number(d.dataset.i)];
      function mudou() {
        l.desc = $(".l-desc", d).value; l.qtd = A.lerNumero($(".l-q", d).value) || 0; l.valor = A.lerNumero($(".l-v", d).value) || 0;
        $(".l-sub", d).textContent = din(r2(l.qtd * l.valor)); $(".l-av", d).innerHTML = aviso(l); $(".l-ref", d).textContent = faixaTxt(l); atualizarTotais(); guardar(); var s = $("#cl-status", c); if (s) s.textContent = "✓ salvo"; }
      $$("input", d).forEach(function (i) { i.addEventListener("input", mudou); });
    });
    $$("[data-med]", el).forEach(function (b) { b.onclick = function () { var l = estado.linhas[Number(b.dataset.med)]; var alvo = l.tipo === "material" ? (Number(l.custo) > 0 ? Number(l.custo) : null) : l.media; if (alvo !== null && alvo !== undefined) { l.valor = alvo; guardar(); lista(c); } }; });
    $$("[data-tirar]", el).forEach(function (b) { b.onclick = function () { estado.linhas.splice(Number(b.dataset.tirar), 1); guardar(); lista(c); }; });
    if ($("#cl-margem", c)) $("#cl-margem", c).onclick = function () { margem(c); };
    if ($("#cl-custo", c)) $("#cl-custo", c).onclick = function () { estado.linhas.forEach(function (l) { if (l.tipo === "material" && Number(l.custo) > 0) l.valor = Number(l.custo); }); guardar(); lista(c); };
    $("#cl-visao", c).value = estado.visao || "t_servicos";
    $("#cl-visao", c).onchange = function () { estado.visao = this.value; guardarLocal(); };
    $("#cl-limpar", c).onclick = function () { if (A.confirmar("Limpar toda a lista da calculadora?")) { estado.linhas = []; guardar(); lista(c); } };
    $("#cl-copiar", c).onclick = function () { copiar(texto()); };
    $("#cl-orc", c).onclick = function () {
      var ls = estado.linhas.filter(function (l) { return l.qtd > 0; });
      if (!ls.length) return;
      if (ls.some(function (l) { return !(l.valor > 0); }) && !A.confirmar("Há item sem preço. Criar o orçamento assim mesmo?")) return;
      var ps = ls.filter(function (l) { return l.tipo !== "material"; });
      P.novoOrcamento(Object.assign({ categoria: (ps[0] || ls[0]).cat === "eletrica" ? "eletrica" : "pintura" }, estado.orc || {}, { valores_cliente: estado.visao || "t_servicos", materiais_cliente: estado.visao !== "total", itens: ls.map(function (l) { return { tipo: l.tipo === "material" ? "material" : "servico", descricao: l.desc, qtd: l.qtd, un: l.un, valor: l.valor }; }) }));
    };
  }
  function texto() {
    var t = totais();
    function lin(l) { return "- " + A.numero(l.qtd, 2) + " " + l.un + " " + l.desc + ": " + din(l.valor) + "/" + l.un + " = " + din(r2(l.qtd * l.valor)); }
    var s = estado.linhas.filter(function (l) { return l.tipo !== "material"; }), m = estado.linhas.filter(function (l) { return l.tipo === "material"; });
    return "MÃO DE OBRA\n" + s.map(lin).join("\n") + "\nTotal da mão de obra: " + din(t.seu) + (m.length ? "\n\nMATERIAIS\n" + m.map(lin).join("\n") + "\nTotal dos materiais: " + din(t.mat) + "\n\nTOTAL GERAL: " + din(r2(t.seu + t.mat)) : "");
  }
  function copiar(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.avisar("Lista copiada", "ok"); }, function () { window.prompt("Copie:", t); });
    else window.prompt("Copie:", t);
  }

  window.AGE_CALC = { ver: ver };
})();
