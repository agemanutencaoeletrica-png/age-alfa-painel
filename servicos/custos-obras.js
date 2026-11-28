// Painel do dono — 📈 CUSTO DE OBRAS: guarda o custo REAL de cada obra (ex.: condomínio com 34 torres) para tirar médias e orçar as próximas.
// Equipe (ex.: 5 pintores + 5 meio oficiais, cada função com a sua diária), etapas (Torre A = 15 dias, Torre B = 20 dias...) e outros custos
// (materiais, andaime...). Soma tudo e mostra o custo total, por etapa, por dia e por m². Com as obras concluídas calcula as MÉDIAS.
// Tabela: obras_custos. Usa as funções do admin.js (P). Só o dono vê.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, lista = [], semTab = false;
  var FUNCOES = ["Pintor", "Meio oficial de pintura", "Ajudante de pintura", "Eletricista", "Meio oficial de eletricista", "Ajudante de eletricista", "Encarregado / líder de equipe", "Servente / ajudante geral", "Técnico de TI / CFTV", "Instalador de portão eletrônico", "Operador de máquina de demarcação", "Motorista"];
  var CH_FN = "age_equipe_funcoes_v1";   // o mesmo cadastro de diárias lembradas da Calculadora
  function lerFn() { try { var o = JSON.parse(localStorage.getItem(CH_FN) || "{}"); return { extras: Array.isArray(o.extras) ? o.extras : [], diarias: o.diarias || {} }; } catch (e) { return { extras: [], diarias: {} }; } }
  function guardarFn(o) { try { localStorage.setItem(CH_FN, JSON.stringify(o)); } catch (e) { /* ignora */ } }
  var OUTROS = ["Material (tinta, massa...)", "Andaime / balancim / acesso", "Aluguel de equipamento", "Transporte / combustível", "Alimentação", "Outro"];

  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function f2(v) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fq(v) { return String(Number(v) || 0).replace(".", ","); }
  function num(t) { return A.lerNumero(t) || 0; }
  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }
  function agora() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }

  // ---------- cálculo ----------
  function novoDados() { return { unidade: "Torre", enc: 0, equipe: [], etapas: [], outros: [], cobrado: 0, obs: "" }; }
  function custoDia(d) {
    var dia = 0, ext = 0;
    (d.equipe || []).forEach(function (f) { var p = f.pessoas === "" || f.pessoas === undefined ? 1 : Number(f.pessoas) || 0; dia += p * (Number(f.diaria) || 0); ext += p * (Number(f.extra) || 0); });
    var enc = dia * (Number(d.enc) || 0) / 100;
    return { diarias: r2(dia), extra: r2(ext), enc: r2(enc), total: r2(dia + ext + enc), pessoas: (d.equipe || []).reduce(function (s, f) { return s + (f.pessoas === "" || f.pessoas === undefined ? 1 : Number(f.pessoas) || 0); }, 0) };
  }
  function calcular(d) {
    var cd = custoDia(d), dias = 0, area = 0, areaMO = 0, n = 0, etapas = [];
    (d.etapas || []).forEach(function (e) {
      var di = Number(e.dias) || 0, ar = Number(e.area) || 0, mo = r2(di * cd.total);
      dias += di; if (di > 0) n++; area += ar; if (ar > 0) areaMO += mo;
      etapas.push({ nome: e.nome, dias: di, area: ar, mo: mo });
    });
    var mo = r2(dias * cd.total), outros = r2((d.outros || []).reduce(function (s, o) { return s + (Number(o.valor) || 0); }, 0));
    var total = r2(mo + outros), cobrado = Number(d.cobrado) || 0;
    return { cd: cd, etapas: etapas, nEtapas: n, dias: dias, area: area, areaMO: areaMO, mo: mo, outros: outros, total: total, cobrado: cobrado, lucro: cobrado ? r2(cobrado - total) : null, margem: cobrado ? (cobrado - total) / cobrado * 100 : null,
      porEtapa: n ? r2(mo / n) : 0, diasPorEtapa: n ? dias / n : 0, porDia: dias ? r2(total / dias) : 0, porM2: area ? r2(mo / area) : 0, outrosPorM2: area ? r2(outros / area) : 0, totalPorM2: area ? r2(total / area) : 0, cobradoPorM2: area && cobrado ? r2(cobrado / area) : 0 };
  }
  // médias das obras CONCLUÍDAS
  function medias() {
    var L = lista.filter(function (x) { return x.status === "concluida"; }).map(function (x) { return { x: x, c: calcular(x.dados || novoDados()) }; }).filter(function (o) { return o.c.dias > 0; });
    if (!L.length) return null;
    var S = L.reduce(function (s, o) { s.obras++; s.etapas += o.c.nEtapas; s.dias += o.c.dias; s.mo += o.c.mo; s.outros += o.c.outros; s.total += o.c.total; s.area += o.c.areaMO ? o.c.area : 0; s.areaMO += o.c.areaMO; if (o.c.cobrado) { s.cobrado += o.c.cobrado; s.totalCob += o.c.total; } return s; }, { obras: 0, etapas: 0, dias: 0, mo: 0, outros: 0, total: 0, area: 0, areaMO: 0, cobrado: 0, totalCob: 0 });
    return { obras: S.obras, etapas: S.etapas, dias: S.dias, diasPorEtapa: S.etapas ? S.dias / S.etapas : 0, moPorEtapa: S.etapas ? S.mo / S.etapas : 0, moPorDia: S.dias ? S.mo / S.dias : 0, totalPorObra: S.total / S.obras,
      moPorM2: S.area ? S.areaMO / S.area : 0, outrosPct: S.mo + S.outros ? S.outros / (S.mo + S.outros) * 100 : 0, margem: S.cobrado ? (S.cobrado - S.totalCob) / S.cobrado * 100 : null, unidade: (L[0].x.dados || {}).unidade || "etapa" };
  }

  // ---------- dados ----------
  function carregar(depois) {
    run(P.sb.from("obras_custos").select("*").order("atualizado_em", { ascending: false }).limit(500)).then(function (r) { lista = r.data || []; semTab = false; })
      .catch(function (e) { lista = []; semTab = semT(e); if (!semTab) A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); }).then(depois);
  }

  // ---------- tela ----------
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>📈 Custo de obras</h2></div><div class="cartao vazio">Carregando...</div>';
    carregar(function () { desenhar(c); });
  }
  function desenhar(c) {
    var M = medias();
    c.innerHTML = '<div class="cab-secao"><h2>📈 Custo de obras</h2><span><button class="prim" id="co-nova"' + (semTab ? " disabled" : "") + '>+ Nova obra</button></span></div>' +
      (semTab ? '<div class="aviso">Para guardar as obras, rode no Supabase o <b>custos-obras.sql</b> (tabela <b>obras_custos</b>) e atualize o app.</div>' : "") +
      '<p class="mudo peq" style="margin-top:-4px">Guarde o <b>custo real</b> de cada obra: a equipe e as diárias, os dias gastos em cada etapa (ex.: Torre A 15 dias, Torre B 20 dias) e os outros custos. O app soma tudo e, com as obras <b>concluídas</b>, calcula as <b>médias</b> para você orçar as próximas. Só você vê.</p>' +
      htmlMedias(M) + (lista.length ? lista.map(function (x) {
        var k = calcular(x.dados || novoDados());
        return '<div class="cartao"><div class="linha" style="gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>' + esc(x.nome || "(sem nome)") + '</b><br><span class="peq mudo">' + k.nEtapas + " " + esc(((x.dados || {}).unidade || "etapa").toLowerCase()) + "(s) · " + A.numero(k.dias, 1) + " dias · custo total <b>" + din(k.total) + "</b>" + (k.lucro !== null ? " · sobra " + din(k.lucro) + " (" + A.numero(k.margem, 1) + "%)" : "") + '</span></div><span class="selo">' + (x.status === "concluida" ? "✅ Concluída" : "🚧 Em andamento") + "</span></div>" +
          '<div class="acoes"><button class="peq prim" data-ab="' + esc(x.id) + '">Abrir / editar</button><button class="peq" data-dp="' + esc(x.id) + '">📋 Duplicar</button><button class="peq perigo" data-ap="' + esc(x.id) + '">Apagar</button></div></div>';
      }).join("") : '<div class="cartao vazio">Nenhuma obra guardada ainda. Toque em + Nova obra.</div>');
    function achar(id) { return lista.filter(function (x) { return x.id === id; })[0]; }
    $("#co-nova", c).onclick = function () { criar({ nome: "", status: "andamento", dados: novoDados() }, c); };
    $$("[data-ab]", c).forEach(function (b) { b.onclick = function () { editar(achar(b.dataset.ab), c); }; });
    $$("[data-dp]", c).forEach(function (b) { b.onclick = function () { var x = achar(b.dataset.dp); criar({ nome: (x.nome || "Obra") + " (cópia)", status: "andamento", dados: JSON.parse(JSON.stringify(x.dados || novoDados())) }, c, true); }; });
    $$("[data-ap]", c).forEach(function (b) {
      b.onclick = function () {
        var x = achar(b.dataset.ap); if (!x || !A.confirmar("Apagar a obra “" + (x.nome || "") + "”? As médias deixam de contar com ela.")) return;
        run(P.sb.from("obras_custos").delete().eq("id", x.id)).then(function () { lista = lista.filter(function (y) { return y.id !== x.id; }); desenhar(c); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
      };
    });
    ligarEstimativa(c, M);
  }
  function htmlMedias(M) {
    if (!M) return '<div class="cartao"><b>📊 Médias para orçar</b><p class="peq mudo" style="margin:4px 0 0">Aparecem quando houver pelo menos uma obra <b>concluída</b> com dias lançados.</p></div>';
    var u = M.unidade;
    return '<div class="cartao"><b>📊 Médias das obras concluídas</b> <span class="peq mudo">(' + M.obras + " obra(s), " + M.etapas + " " + esc(u.toLowerCase()) + "(s), " + A.numero(M.dias, 0) + " dias)</span>" +
      '<div class="linha" style="gap:14px;flex-wrap:wrap;margin-top:6px">' +
      [["Dias por " + u.toLowerCase(), A.numero(M.diasPorEtapa, 1) + " dias"], ["Mão de obra por " + u.toLowerCase(), din(M.moPorEtapa)], ["Mão de obra por dia", din(M.moPorDia)], ["Custo total por obra", din(M.totalPorObra)], M.moPorM2 ? ["Mão de obra por m²", din(M.moPorM2)] : null, M.margem !== null ? ["Margem média", A.numero(M.margem, 1) + "%"] : null]
        .filter(Boolean).map(function (k) { return '<div style="min-width:150px"><div class="peq mudo">' + k[0] + "</div><b>" + k[1] + "</b></div>"; }).join("") + "</div>" +
      '<details style="margin-top:8px"><summary><b>🔮 Estimar uma obra nova com estas médias</b></summary><div class="linha" style="gap:8px;margin-top:6px"><label style="width:150px">Nº de ' + esc(u.toLowerCase()) + 's<input class="es-n" inputmode="decimal" value="10"></label><label style="width:150px">Área total (m², opcional)<input class="es-a" inputmode="decimal"></label></div><div id="es-res" class="peq" style="margin-top:6px"></div></details></div>';
  }
  function ligarEstimativa(c, M) {
    if (!M || !$(".es-n", c)) return;
    function pintar() {
      var n = num($(".es-n", c).value), a = num($(".es-a", c).value);
      $("#es-res", c).innerHTML = n > 0 ? "<div>Para " + A.numero(n, 0) + " " + esc(M.unidade.toLowerCase()) + "(s): <b>" + A.numero(n * M.diasPorEtapa, 0) + " dias</b> de equipe e mão de obra de <b>" + din(r2(n * M.moPorEtapa)) + "</b></div>" + (a > 0 && M.moPorM2 ? "<div>Por área (" + A.numero(a, 0) + " m²): mão de obra de <b>" + din(r2(a * M.moPorM2)) + "</b></div>" : "") +
        '<div class="mudo">Só mão de obra da equipe. Some materiais e outros custos. É uma média: confira com as medidas do projeto.</div>' : "";
    }
    $(".es-n", c).oninput = pintar; $(".es-a", c).oninput = pintar; pintar();
  }
  function criar(reg, c, abrir) {
    run(P.sb.from("obras_custos").insert(Object.assign({ total: calcular(reg.dados).total }, reg)).select()).then(function (r) {
      var x = (r.data || [])[0]; if (!x) return; lista.unshift(x); desenhar(c); editar(x, c);
    }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
  }

  // ---------- editor ----------
  function editar(x, c) {
    var d = Object.assign(novoDados(), JSON.parse(JSON.stringify(x.dados || {}))), nome = x.nome || "", status = x.status || "andamento", tm = null;
    var j = A.janela('<div class="peq" id="co-st" style="color:var(--mudo)">salva sozinho</div>' +
      '<div class="linha" style="gap:8px;align-items:flex-end"><label style="flex:3;min-width:220px">Obra (condomínio / cliente)<input class="co-nome" maxlength="200" placeholder="Ex.: Condomínio X – pintura das fachadas"></label><label style="width:150px">Cada etapa é um(a)<input class="co-un" maxlength="30" list="co-uns" placeholder="Torre"><datalist id="co-uns"><option value="Torre"><option value="Bloco"><option value="Pavimento"><option value="Prédio"><option value="Etapa"></datalist></label>' +
      '<label style="width:170px">Situação<select class="co-status"><option value="andamento">🚧 Em andamento</option><option value="concluida">✅ Concluída (entra nas médias)</option></select></label></div>' +
      '<details open class="cartao"><summary><b>👷 Equipe e diárias</b></summary><div id="co-equipe"></div><div class="acoes"><button class="peq" id="co-add-f">➕ Função</button></div>' +
        '<div class="linha" style="gap:8px"><label style="width:200px">Encargos e benefícios (% das diárias)<input class="co-enc" inputmode="decimal"></label><div id="co-cdia" style="flex:1;min-width:200px;align-self:flex-end"></div></div></details>' +
      '<details open class="cartao"><summary><b>🏗 Etapas e dias gastos</b></summary><div id="co-etapas"></div><div class="acoes"><button class="peq" id="co-add-e">➕ Etapa</button><button class="peq" id="co-add-n">➕ Várias etapas de uma vez</button></div></details>' +
      '<details open class="cartao"><summary><b>🧱 Outros custos</b> <span class="peq mudo">(material, andaime, aluguel...)</span></summary><div id="co-outros"></div><div class="acoes"><button class="peq" id="co-add-o">➕ Custo</button></div></details>' +
      '<label style="display:block;margin-top:8px">Valor cobrado do cliente (opcional, para ver a sobra)<input class="co-cob" inputmode="decimal" style="max-width:220px"></label><label>Observações<textarea class="co-obs" rows="2" maxlength="2000"></textarea></label>' +
      '<div id="co-res" class="cartao" style="margin-top:8px"></div><div class="acoes"><button id="co-fechar">Fechar</button></div>', { titulo: "📈 Custo da obra", larga: true, semRascunho: true, aoFechar: function () { salvarJa(); desenhar(c); } });
    $(".co-nome", j.el).value = nome; $(".co-un", j.el).value = d.unidade; $(".co-status", j.el).value = status; $(".co-enc", j.el).value = fq(d.enc); $(".co-cob", j.el).value = d.cobrado ? f2(d.cobrado) : ""; $(".co-obs", j.el).value = d.obs || "";
    function salvarJa() {
      clearTimeout(tm);
      var reg = { nome: $(".co-nome", j.el) ? $(".co-nome", j.el).value.trim() : x.nome, status: status, dados: d, total: calcular(d).total, atualizado_em: new Date().toISOString() };
      Object.assign(x, reg);
      return run(P.sb.from("obras_custos").update(reg).eq("id", x.id)).then(function () { var s = $("#co-st", j.el); if (s) { s.textContent = "💾 Salvo às " + agora(); s.style.color = ""; } })
        .catch(function (e) { var s = $("#co-st", j.el); if (s) { s.textContent = "Não salvou: " + (A.msgErro ? A.msgErro(e) : e.message); s.style.color = "var(--perigo,#c0392b)"; } });
    }
    function agendar() { var s = $("#co-st", j.el); if (s) s.textContent = "salvando…"; clearTimeout(tm); tm = setTimeout(salvarJa, 1000); }
    function resumo() {
      var k = calcular(d), u = (d.unidade || "etapa").toLowerCase();
      $("#co-cdia", j.el).innerHTML = '<span class="peq mudo">Custo da equipe por dia (' + k.cd.pessoas + ' pessoas):</span> <b>' + din(k.cd.total) + "</b>";
      $("#co-res", j.el).innerHTML = '<div class="linha" style="justify-content:space-between"><span>Mão de obra (' + A.numero(k.dias, 1) + " dias × " + din(k.cd.total) + ')</span><b>' + din(k.mo) + '</b></div><div class="linha" style="justify-content:space-between"><span>Outros custos</span><b>' + din(k.outros) + '</b></div><div class="linha" style="justify-content:space-between;border-top:1px solid var(--borda);margin-top:4px;padding-top:4px"><b>CUSTO TOTAL DA OBRA</b><b style="font-size:20px">' + din(k.total) + "</b></div>" +
        '<div class="peq mudo" style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap"><span>' + k.nEtapas + " " + esc(u) + "(s)</span><span>média de " + A.numero(k.diasPorEtapa, 1) + " dias por " + esc(u) + "</span><span>mão de obra por " + esc(u) + ": <b>" + din(k.porEtapa) + "</b></span><span>custo por dia: <b>" + din(k.porDia) + "</b></span>" + (k.porM2 ? "<span>mão de obra por m²: <b>" + din(k.porM2) + "</b></span><span>outros custos por m²: <b>" + din(k.outrosPorM2) + "</b></span><span>custo total por m²: <b>" + din(k.totalPorM2) + "</b></span>" + (k.cobradoPorM2 ? "<span>cobrado por m²: <b>" + din(k.cobradoPorM2) + "</b></span>" : "") : "") + "</div>" +
        (k.lucro !== null ? '<div class="linha" style="justify-content:space-between;margin-top:6px"><span>Cobrado do cliente ' + din(k.cobrado) + '</span><b style="color:' + (k.lucro >= 0 ? "var(--bom,#1b7f3b)" : "var(--perigo,#c0392b)") + '">Sobra ' + din(k.lucro) + " (" + A.numero(k.margem, 1) + "%)</b></div>" : "");
    }
    function mudou() { resumo(); agendar(); }
    // ---- equipe
    function desenharEquipe() {
      var fn = FUNCOES.concat(lerFn().extras.filter(function (z) { return FUNCOES.indexOf(z) < 0; }));
      $("#co-equipe", j.el).innerHTML = (d.equipe.map(function (f, i) {
        var L = fn.slice(); if (f.funcao && L.indexOf(f.funcao) < 0) L.push(f.funcao);
        return '<div class="linha co-f" data-i="' + i + '" style="gap:6px;margin-top:6px;align-items:flex-end;flex-wrap:wrap"><label style="flex:2;min-width:190px">Função <span class="peq mudo">(escolha ou digite)</span><input class="f-fn" list="co-dl-fn" maxlength="60" placeholder="Ex.: Pintor" value="' + esc(f.funcao || "") + '"></label>' +
          '<label style="width:90px">Pessoas<input class="f-p" inputmode="decimal" value="' + esc(fq(f.pessoas === "" || f.pessoas === undefined ? 1 : f.pessoas)) + '"></label><label style="width:120px">Diária de cada (R$)<input class="f-v" inputmode="decimal" value="' + esc(f2(f.diaria)) + '"></label><label style="width:130px">Transp./alim. por dia (R$)<input class="f-x" inputmode="decimal" value="' + esc(f2(f.extra)) + '"></label><button class="peq perigo" data-tirar-f="' + i + '" aria-label="Tirar">🗑</button></div>';
      }).join("") || '<p class="peq mudo">Toque em ➕ Função e informe, por exemplo, 5 pintores e 5 meio oficiais, cada um com a sua diária.</p>') + '<datalist id="co-dl-fn">' + fn.map(function (z) { return '<option value="' + esc(z) + '">'; }).join("") + "</datalist>";
      $$(".co-f", j.el).forEach(function (el) {
        var f = d.equipe[Number(el.dataset.i)];
        $(".f-fn", el).oninput = function () { f.funcao = this.value.trim(); agendar(); };
        $(".f-fn", el).onchange = function () { f.funcao = this.value.trim(); if (f.funcao && fn.indexOf(f.funcao) < 0) { var o1 = lerFn(); o1.extras.push(f.funcao); guardarFn(o1); } var m = lerFn().diarias[f.funcao]; if (m && !(Number(f.diaria) > 0)) { f.diaria = Number(m.diaria) || 0; f.extra = Number(m.extra) || 0; $(".f-v", el).value = f2(f.diaria); $(".f-x", el).value = f2(f.extra); } mudou(); };
        $$("input", el).forEach(function (i) { i.addEventListener("input", function () { f.pessoas = $(".f-p", el).value === "" ? "" : num($(".f-p", el).value); f.diaria = num($(".f-v", el).value); f.extra = num($(".f-x", el).value); if (f.funcao && /f-(v|x)/.test(i.className)) { var o = lerFn(); o.diarias[f.funcao] = { diaria: f.diaria, extra: f.extra }; guardarFn(o); } mudou(); }); });
      });
      $$("[data-tirar-f]", j.el).forEach(function (b) { b.onclick = function () { d.equipe.splice(Number(b.dataset.tirarF), 1); desenharEquipe(); mudou(); }; });
    }
    // ---- etapas
    function desenharEtapas() {
      var k = calcular(d), u = d.unidade || "Etapa";
      $("#co-etapas", j.el).innerHTML = d.etapas.map(function (e, i) {
        return '<div class="linha co-e" data-i="' + i + '" style="gap:6px;margin-top:6px;align-items:flex-end"><label style="flex:2;min-width:150px">' + esc(u) + '<input class="e-n" maxlength="60" value="' + esc(e.nome || "") + '"></label><label style="width:100px">Dias gastos<input class="e-d" inputmode="decimal" value="' + esc(fq(e.dias)) + '"></label><label style="width:120px">Área (m², opcional)<input class="e-a" inputmode="decimal" value="' + esc(e.area ? fq(e.area) : "") + '"></label><div class="peq e-c" style="min-width:110px;padding-bottom:8px">' + din(k.etapas[i] ? k.etapas[i].mo : 0) + '</div><button class="peq perigo" data-tirar-e="' + i + '" aria-label="Tirar">🗑</button></div>';
      }).join("") || '<p class="peq mudo">Toque em ➕ Etapa (ou ➕ Várias etapas) e lance os dias gastos em cada uma.</p>';
      $$(".co-e", j.el).forEach(function (el) {
        var e = d.etapas[Number(el.dataset.i)];
        $$("input", el).forEach(function (i) { i.addEventListener("input", function () { e.nome = $(".e-n", el).value; e.dias = num($(".e-d", el).value); e.area = num($(".e-a", el).value); var kk = calcular(d); $(".e-c", el).textContent = din(kk.etapas[Number(el.dataset.i)].mo); mudou(); }); });
      });
      $$("[data-tirar-e]", j.el).forEach(function (b) { b.onclick = function () { d.etapas.splice(Number(b.dataset.tirarE), 1); desenharEtapas(); mudou(); }; });
    }
    // ---- outros custos
    function desenharOutros() {
      $("#co-outros", j.el).innerHTML = d.outros.map(function (o, i) {
        return '<div class="linha co-o" data-i="' + i + '" style="gap:6px;margin-top:6px;align-items:flex-end"><label style="flex:1;min-width:190px">Tipo<select class="o-t">' + OUTROS.map(function (z) { return "<option" + (z === o.tipo ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") + '</select></label><label style="flex:2;min-width:180px">Descrição<input class="o-d" maxlength="160" value="' + esc(o.desc || "") + '"></label><label style="width:130px">Valor (R$)<input class="o-v" inputmode="decimal" value="' + esc(f2(o.valor)) + '"></label><button class="peq perigo" data-tirar-o="' + i + '" aria-label="Tirar">🗑</button></div>';
      }).join("") || '<p class="peq mudo">Opcional: tinta, andaime, aluguel de equipamento...</p>';
      $$(".co-o", j.el).forEach(function (el) {
        var o = d.outros[Number(el.dataset.i)];
        $(".o-t", el).onchange = function () { o.tipo = this.value; mudou(); };
        $$("input", el).forEach(function (i) { i.addEventListener("input", function () { o.desc = $(".o-d", el).value; o.valor = num($(".o-v", el).value); mudou(); }); });
      });
      $$("[data-tirar-o]", j.el).forEach(function (b) { b.onclick = function () { d.outros.splice(Number(b.dataset.tirarO), 1); desenharOutros(); mudou(); }; });
    }
    desenharEquipe(); desenharEtapas(); desenharOutros(); resumo();
    $(".co-nome", j.el).oninput = agendar;
    $(".co-un", j.el).oninput = function () { d.unidade = this.value.trim() || "Etapa"; resumo(); agendar(); };
    $(".co-un", j.el).onchange = function () { desenharEtapas(); };
    $(".co-status", j.el).onchange = function () { status = this.value; agendar(); };
    $(".co-enc", j.el).oninput = function () { d.enc = num(this.value); mudou(); desenharEtapas(); };
    $(".co-cob", j.el).oninput = function () { d.cobrado = num(this.value); mudou(); };
    $(".co-obs", j.el).oninput = function () { d.obs = this.value; agendar(); };
    $("#co-add-f", j.el).onclick = function () { d.equipe.push({ funcao: "", pessoas: 1, diaria: 0, extra: 0 }); desenharEquipe(); mudou(); };
    $("#co-add-e", j.el).onclick = function () { var n = d.etapas.length + 1; d.etapas.push({ nome: (d.unidade || "Etapa") + " " + String(n).padStart(2, "0"), dias: 0, area: 0 }); desenharEtapas(); mudou(); };
    $("#co-add-o", j.el).onclick = function () { d.outros.push({ tipo: OUTROS[0], desc: "", valor: 0 }); desenharOutros(); mudou(); };
    $("#co-add-n", j.el).onclick = function () {
      var jn = A.janela('<div class="linha" style="gap:8px"><label style="width:130px">Quantas?<input class="vn-q" inputmode="decimal" value="34"></label><label style="width:150px">Dias de cada (padrão)<input class="vn-d" inputmode="decimal" value="0"></label><label style="width:170px">Nomear com<select class="vn-m"><option value="n">Números (01, 02...)</option><option value="l">Letras (A, B, C...)</option></select></label></div><p class="peq mudo">Depois você ajusta os dias de cada uma. Ex.: Torre A 15 dias, Torre B 20 dias.</p><div class="acoes"><button class="prim" id="vn-ok">Adicionar</button><button id="vn-x">Cancelar</button></div>', { titulo: "➕ Várias etapas", semRascunho: true });
      $("#vn-x", jn.el).onclick = function () { jn.fechar(); };
      $("#vn-ok", jn.el).onclick = function () {
        var q = Math.min(200, Math.floor(num($(".vn-q", jn.el).value))), di = num($(".vn-d", jn.el).value), modo = $(".vn-m", jn.el).value, u = d.unidade || "Etapa";
        if (!(q > 0)) { A.avisar("Informe quantas etapas.", "erro"); return; }
        var base = d.etapas.length;
        for (var i = 0; i < q; i++) { var k = base + i; d.etapas.push({ nome: u + " " + (modo === "l" && k < 26 ? String.fromCharCode(65 + k) : String(k + 1).padStart(2, "0")), dias: di, area: 0 }); }
        jn.fechar(); desenharEtapas(); mudou();
      };
    };
    $("#co-fechar", j.el).onclick = function () { j.fechar(); };
  }

  // média das obras concluídas (para a Calculadora sugerir o preço da mão de obra)
  function mediaAtual(ctx) {
    return run(ctx.sb.from("obras_custos").select("*").eq("status", "concluida").limit(500)).then(function (r) {
      var antes = lista; lista = r.data || []; var m = medias(); lista = antes; return m;
    }).catch(function () { return null; });
  }
  // todas as obras com as contas feitas (para a Calculadora comparar a cotação com uma obra já feita)
  function todas(ctx) {
    return run(ctx.sb.from("obras_custos").select("*").order("atualizado_em", { ascending: false }).limit(300)).then(function (r) {
      return (r.data || []).map(function (x) { var d = x.dados || novoDados(); return { id: x.id, nome: x.nome || "(sem nome)", status: x.status, c: calcular(d), cobrado: Number(d.cobrado) || 0 }; });
    }).catch(function () { return []; });
  }
  window.AGE_CUSTOS = { ver: ver, calcular: calcular, mediaAtual: mediaAtual, todas: todas };
})();
