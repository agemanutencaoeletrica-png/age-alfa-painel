// Painel do dono — 🚛 LAVA-JATO DE CAMINHÕES: empresas contratantes, caminhões (marca e placa), lavadores, serviços (lavagem, lubrificação...),
// lançamento das lavagens, despesas, comissão dos lavadores, resultado do mês com a parte do sócio, extrato para cobrar cada empresa e contratos.
// Tabela única: lavajato (tipo: empresa | veiculo | lavador | servico | config | lancamento | despesa). Usa as funções do admin.js (P). Só o dono vê.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, CAD = [], MOV = [], semTab = false, sub = "lanc", mes = "", fEmp = "", busca = "";
  var SUBS = [["lanc", "🧽 Lavagens"], ["emp", "🏢 Empresas"], ["cam", "🚛 Caminhões"], ["lav", "👷 Lavadores"], ["serv", "🧴 Serviços"], ["desp", "💸 Despesas"], ["res", "📊 Resultado"], ["contr", "📜 Contratos"]];
  var CATEG = ["Lavagem", "Lubrificação", "Outro"], TIPOS_V = ["Cavalo mecânico", "Truck", "Toco", "Carreta", "Bitrem / Rodotrem", "Baú", "Caçamba", "Ônibus", "Outro"];
  var MARCAS = ["Scania", "Volvo", "Mercedes-Benz", "Volkswagen", "Iveco", "DAF", "MAN", "Ford", "Randon", "Facchini", "Librelato", "Guerra", "Noma", "Rodotec"];
  var DESP = ["Água", "Energia", "Produtos de limpeza / químicos", "Óleo e graxa", "Aluguel", "Manutenção de equipamentos", "Salários", "Impostos", "Outro"];
  var SEED = [["Lavagem externa – cavalo mecânico", "Lavagem"], ["Lavagem externa – carreta / baú", "Lavagem"], ["Lavagem completa (externa + cabine)", "Lavagem"], ["Lavagem de chassi / baixo", "Lavagem"], ["Lavagem interna da carroceria", "Lavagem"], ["Lubrificação / engraxamento", "Lubrificação"], ["Troca de óleo", "Lubrificação"]];

  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function f2(v) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fq(v) { return String(Number(v) || 0).replace(".", ","); }
  function num(t) { return A.lerNumero(t) || 0; }
  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }
  function erro(e) { A.avisar(A.msgErro ? A.msgErro(e) : (e && e.message) || String(e), "erro"); }
  function hoje() { return A.isoLocal(new Date()); }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function mesBr(m) { var p = String(m).split("-"); return ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(p[1]) - 1] + " de " + p[0]; }
  function fimMes(m) { var p = m.split("-"), d = new Date(Number(p[0]), Number(p[1]), 0); return m + "-" + ("0" + d.getDate()).slice(-2); }
  function dias(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
  function placaFmt(t) { var s = String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return s.length === 7 ? s.slice(0, 3) + "-" + s.slice(3) : s; }
  function cad(tipo) { return CAD.filter(function (x) { return x.tipo === tipo; }); }
  function acharCad(id) { return CAD.filter(function (x) { return x.id === id; })[0]; }
  function porNome(a, b) { return String(a.dados.nome || a.dados.placa || "").localeCompare(String(b.dados.nome || b.dados.placa || ""), "pt-BR"); }
  function cfg() { var c = cad("config")[0]; return c ? c.dados : {}; }
  function nomeEmp(id) { var e = id && acharCad(id); return e ? e.dados.nome : "Avulso / particular"; }
  function rotVeic(v) { return v ? placaFmt(v.dados.placa) + (v.dados.marca ? " · " + v.dados.marca : "") + (v.dados.modelo ? " " + v.dados.modelo : "") : "(caminhão apagado)"; }

  // ---------- cálculos ----------
  function totalLanc(l) { return r2(((l.dados || {}).itens || []).reduce(function (s, i) { return s + (Number(i.qtd) || 0) * (Number(i.valor) || 0); }, 0)); }
  function custoLanc(l) { return r2(((l.dados || {}).itens || []).reduce(function (s, i) { return s + (Number(i.qtd) || 0) * (Number(i.custo) || 0); }, 0)); }
  function comissoes(l) {
    var tot = totalLanc(l), ids = (l.dados || {}).lavadores || [], r = {};
    ids.forEach(function (id) {
      var lv = acharCad(id); if (!lv) return; var d = lv.dados, c = Number(d.comissao) || 0;
      r[id] = (r[id] || 0) + (d.comTipo === "fixo" ? c / ids.length : tot * c / 100 / ids.length);
    });
    return r;
  }
  function resumo() {
    var S = { n: 0, fat: 0, rec: 0, prod: 0, com: 0, desp: 0, porEmp: {}, porLav: {}, porServ: {}, despCat: {} };
    MOV.forEach(function (x) {
      if (x.tipo === "lancamento") {
        var t = totalLanc(x), e = (x.dados.empresaId || "-");
        S.n++; S.fat += t; if (x.dados.pago) S.rec += t; S.prod += custoLanc(x);
        var pe = S.porEmp[e] = S.porEmp[e] || { n: 0, tot: 0, aberto: 0 }; pe.n++; pe.tot += t; if (!x.dados.pago) pe.aberto += t;
        var cm = comissoes(x); Object.keys(cm).forEach(function (id) { var pl = S.porLav[id] = S.porLav[id] || { n: 0, prod: 0, com: 0 }; pl.n++; pl.prod += t / (x.dados.lavadores.length || 1); pl.com += cm[id]; S.com += cm[id]; });
        (x.dados.itens || []).forEach(function (i) { var k = i.nome || "?", ps = S.porServ[k] = S.porServ[k] || { qtd: 0, tot: 0 }; ps.qtd += Number(i.qtd) || 0; ps.tot += (Number(i.qtd) || 0) * (Number(i.valor) || 0); });
      } else if (x.tipo === "despesa") { var v = Number(x.dados.valor) || 0; S.desp += v; S.despCat[x.dados.categoria || "Outro"] = (S.despCat[x.dados.categoria || "Outro"] || 0) + v; }
    });
    ["fat", "rec", "prod", "com", "desp"].forEach(function (k) { S[k] = r2(S[k]); });
    S.aberto = r2(S.fat - S.rec); S.lucro = r2(S.fat - S.prod - S.com - S.desp);
    var c = cfg(), pct = Number(c.socioPct) || 0;
    S.socio = r2(S.lucro * pct / 100); S.minha = r2(S.lucro - S.socio); S.pct = pct;
    return S;
  }
  function precoDe(emp, s) { var pe = emp && emp.dados.precos && emp.dados.precos[s.id]; return pe !== undefined && pe !== "" && pe !== null ? Number(pe) || 0 : Number(s.dados.preco) || 0; }

  // ---------- dados ----------
  function carregar(depois) {
    var ini = mes + "-01", fim = fimMes(mes);
    Promise.all([
      run(P.sb.from("lavajato").select("*").in("tipo", ["empresa", "veiculo", "lavador", "servico", "config"]).limit(5000)),
      run(P.sb.from("lavajato").select("*").in("tipo", ["lancamento", "despesa"]).gte("data", ini).lte("data", fim).order("data", { ascending: false }).limit(1000))
    ]).then(function (r) { CAD = r[0].data || []; MOV = r[1].data || []; semTab = false; if (MOV.length >= 1000) A.avisar("O mês tem mais de 1.000 lançamentos: alguns não aparecem. Veja um período menor.", "erro"); })
      .catch(function (e) { CAD = []; MOV = []; semTab = semT(e); if (!semTab) erro(e); }).then(depois);
  }
  function inserir(tipo, dados, data) {
    return run(P.sb.from("lavajato").insert({ tipo: tipo, dados: dados, data: data || null }).select()).then(function (r) {
      var x = (r.data || [])[0]; if (!x) throw new Error("Não salvou."); if (tipo === "lancamento" || tipo === "despesa") { if (!data || (data >= mes + "-01" && data <= fimMes(mes))) MOV.unshift(x); } else CAD.push(x); return x;
    });
  }
  function gravar(x) { return run(P.sb.from("lavajato").update({ dados: x.dados, data: x.data || null, atualizado_em: new Date().toISOString() }).eq("id", x.id)); }
  function remover(x) { return run(P.sb.from("lavajato").delete().eq("id", x.id)).then(function () { CAD = CAD.filter(function (y) { return y.id !== x.id; }); MOV = MOV.filter(function (y) { return y.id !== x.id; }); }); }

  // ---------- formulário genérico ----------
  // campos: {k, rot, t: text|num|sel|area|date|chk, op:[...] | [[valor, rótulo]], w, lista, sc}
  function campoHtml(f, v) {
    var val = v[f.k] === undefined || v[f.k] === null ? "" : v[f.k], st = 'style="flex:' + (f.w ? "0 0 " + f.w + "px" : "1") + ';min-width:' + (f.w ? f.w : 150) + 'px"';
    if (f.t === "chk") return '<label class="marca-linha" ' + st + '><input type="checkbox" class="f-' + f.k + '"' + (val ? " checked" : "") + "> " + f.rot + "</label>";
    var inner;
    if (f.t === "sel") inner = '<select class="f-' + f.k + '">' + f.op.map(function (o) { var a = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(a[0]) + '"' + (String(a[0]) === String(val) ? " selected" : "") + ">" + esc(a[1]) + "</option>"; }).join("") + "</select>";
    else if (f.t === "area") inner = '<textarea class="f-' + f.k + '" rows="2" maxlength="1500">' + esc(val) + "</textarea>";
    else if (f.t === "num") inner = '<input class="f-' + f.k + '" inputmode="decimal" value="' + esc(val === "" ? "" : f2(val)) + '">';
    else inner = '<input class="f-' + f.k + '"' + (f.t === "date" ? ' type="date"' : ' maxlength="200"') + (f.lista ? ' list="' + f.lista + '"' : "") + (f.sc ? " data-sem-correcao" : "") + ' value="' + esc(val) + '">';
    return "<label " + st + ">" + f.rot + inner + "</label>";
  }
  function lerCampos(el, campos, out) {
    campos.forEach(function (f) {
      var e = $(".f-" + f.k, el); if (!e) return;
      out[f.k] = f.t === "chk" ? e.checked : f.t === "num" ? (e.value.trim() === "" ? "" : num(e.value)) : f.t === "date" ? e.value : e.value.trim();
    });
    return out;
  }
  function form(tit, campos, v, ok, op) {
    op = op || {};
    var linhas = [], atual = [];
    campos.forEach(function (f) { atual.push(f); if (f.fim) { linhas.push(atual); atual = []; } }); if (atual.length) linhas.push(atual);
    var datalists = (op.listas || []).map(function (l) { return '<datalist id="' + l[0] + '">' + l[1].map(function (z) { return '<option value="' + esc(z) + '">'; }).join("") + "</datalist>"; }).join("");
    var j = A.janela(datalists + linhas.map(function (l) { return '<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:6px">' + l.map(function (f) { return campoHtml(f, v); }).join("") + "</div>"; }).join("") + (op.extra || "") +
      '<div class="acoes"><button class="prim" id="lj-ok">Salvar</button><button id="lj-x">Cancelar</button></div>', { titulo: tit, larga: !!op.larga, semRascunho: true });
    if (op.aoAbrir) op.aoAbrir(j.el);
    $("#lj-x", j.el).onclick = function () { j.fechar(); };
    $("#lj-ok", j.el).onclick = function () {
      var out = lerCampos(j.el, campos, {}); if (op.aoLer) out = op.aoLer(j.el, out);
      var msg = op.validar && op.validar(out); if (msg) { A.avisar(msg, "erro"); return; }
      Promise.resolve(ok(out)).then(function () { j.fechar(); }).catch(erro);
    };
    return j;
  }

  // ---------- tela ----------
  function ver(c, ctx) {
    P = ctx; if (!mes) mes = hoje().slice(0, 7);
    c.innerHTML = '<div class="cab-secao"><h2>🚛 Lava-jato</h2></div><div class="cartao vazio">Carregando...</div>';
    carregar(function () { desenhar(c); });
  }
  function recarregar(c) { carregar(function () { desenhar(c); }); }
  function desenhar(c) {
    var corpo = { lanc: telaLanc, emp: telaEmp, cam: telaCam, lav: telaLav, serv: telaServ, desp: telaDesp, res: telaRes, contr: telaContr }[sub];
    c.innerHTML = '<div class="cab-secao"><h2>🚛 Lava-jato de caminhões</h2></div>' +
      (semTab ? '<div class="aviso">Para guardar os dados do lava-jato, rode no Supabase o <b>lavajato.sql</b> (tabela <b>lavajato</b>) e atualize o app.</div>' : "") +
      '<div class="acoes" id="lj-subs" style="flex-wrap:wrap">' + SUBS.map(function (s) { return '<button class="peq' + (s[0] === sub ? " prim" : "") + '" data-sub="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      (["lanc", "desp", "res"].indexOf(sub) >= 0 ? '<div class="linha" style="gap:8px;align-items:flex-end;margin:6px 0"><label style="width:170px">Mês<input type="month" id="lj-mes" value="' + esc(mes) + '"></label></div>' : "") +
      '<div id="lj-corpo"></div>';
    $$("[data-sub]", c).forEach(function (b) { b.onclick = function () { sub = b.dataset.sub; busca = ""; desenhar(c); }; });
    var m = $("#lj-mes", c); if (m) m.onchange = function () { if (this.value) { mes = this.value; recarregar(c); } };
    if (!semTab) corpo($("#lj-corpo", c), c);
  }
  function lista(x, vazio) { return x.length ? x.join("") : '<div class="cartao vazio">' + vazio + "</div>"; }
  function selo(t, cor) { return '<span class="peq" style="padding:1px 7px;border-radius:9px;background:' + (cor || "var(--borda,#ddd)") + ';white-space:nowrap">' + t + "</span>"; }
  function apagarBt(c, attr, lbl, depois) {
    $$("[" + attr + "]", c).forEach(function (b) {
      b.onclick = function () {
        var x = acharCad(b.getAttribute(attr)) || MOV.filter(function (y) { return y.id === b.getAttribute(attr); })[0];
        if (!x || !A.confirmar("Apagar " + lbl(x) + "?")) return;
        remover(x).then(depois).catch(erro);
      };
    });
  }

  // ---- lavagens do mês ----
  function telaLanc(c, raiz) {
    var L = MOV.filter(function (x) { return x.tipo === "lancamento" && (!fEmp || (fEmp === "-" ? !x.dados.empresaId : x.dados.empresaId === fEmp)); });
    var tot = r2(L.reduce(function (s, x) { return s + totalLanc(x); }, 0)), ab = r2(L.filter(function (x) { return !x.dados.pago; }).reduce(function (s, x) { return s + totalLanc(x); }, 0));
    c.innerHTML = '<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><button class="prim" id="lj-nova">+ Lançar lavagem</button><label style="min-width:200px">Empresa<select id="lj-fe"><option value="">Todas</option>' + cad("empresa").sort(porNome).map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === fEmp ? " selected" : "") + ">" + esc(e.dados.nome) + "</option>"; }).join("") + '<option value="-"' + (fEmp === "-" ? " selected" : "") + ">Avulso / particular</option></select></label>" +
      '<div class="peq mudo" style="flex:1;text-align:right">' + L.length + " serviço(s) · total <b>" + din(tot) + "</b> · a receber <b>" + din(ab) + "</b></div></div>" +
      (cad("servico").length ? "" : '<div class="aviso" style="margin-top:6px">Cadastre primeiro os <b>🧴 Serviços</b> (lavagem, lubrificação...) e os <b>🚛 Caminhões</b>.</div>') +
      lista(L.map(function (x) {
        var d = x.dados, v = acharCad(d.veiculoId), ls = (d.lavadores || []).map(function (i) { var l = acharCad(i); return l ? l.dados.nome : ""; }).filter(Boolean).join(", ");
        return '<div class="cartao"><div class="linha" style="gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:210px"><b>' + esc(dataBr(x.data)) + " · " + esc(v ? rotVeic(v) : d.placa || "(sem caminhão)") + '</b><br><span class="peq mudo">' + esc(nomeEmp(d.empresaId)) + (ls ? " · 👷 " + esc(ls) : "") + "</span><br><span class=\"peq\">" + (d.itens || []).map(function (i) { return esc((Number(i.qtd) > 1 ? fq(i.qtd) + "× " : "") + i.nome); }).join(" + ") + "</span>" + (d.obs ? '<br><span class="peq mudo">' + esc(d.obs) + "</span>" : "") + "</div>" +
          '<div style="text-align:right"><b>' + din(totalLanc(x)) + "</b><br>" + (d.pago ? selo("✔ pago", "#cfeedd") : selo("a receber", "#fde8c4")) + "</div></div>" +
          '<div class="acoes"><button class="peq" data-pg="' + esc(x.id) + '">' + (d.pago ? "↩ Marcar a receber" : "✔ Marcar pago") + '</button><button class="peq" data-ed="' + esc(x.id) + '">Editar</button><button class="peq perigo" data-ap="' + esc(x.id) + '">Apagar</button></div></div>';
      }), "Nenhuma lavagem lançada neste mês. Toque em + Lançar lavagem.");
    $("#lj-nova", c).onclick = function () { lancamento(null, raiz); };
    $("#lj-fe", c).onchange = function () { fEmp = this.value; desenhar(raiz); };
    $$("[data-ed]", c).forEach(function (b) { b.onclick = function () { lancamento(MOV.filter(function (y) { return y.id === b.dataset.ed; })[0], raiz); }; });
    $$("[data-pg]", c).forEach(function (b) { b.onclick = function () { var x = MOV.filter(function (y) { return y.id === b.dataset.pg; })[0]; x.dados.pago = !x.dados.pago; x.dados.pagoEm = x.dados.pago ? hoje() : ""; gravar(x).then(function () { desenhar(raiz); }).catch(erro); }; });
    apagarBt(c, "data-ap", function (x) { return "a lavagem de " + dataBr(x.data) + " (" + din(totalLanc(x)) + ")"; }, function () { desenhar(raiz); });
  }
  function lancamento(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { empresaId: fEmp && fEmp !== "-" ? fEmp : "", veiculoId: "", lavadores: [], itens: [], pago: false, obs: "" };
    var data = x ? x.data : (hoje().slice(0, 7) === mes ? hoje() : mes + "-01"), servs = cad("servico").sort(porNome);
    var j = A.janela('<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><label style="width:150px">Data<input type="date" class="l-data"></label><label style="flex:1;min-width:200px">Empresa contratante<select class="l-emp"></select></label></div>' +
      '<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:6px"><label style="flex:1;min-width:230px">Caminhão<select class="l-vei"></select></label><span class="l-novo" style="display:none;gap:8px;flex:2;min-width:260px"><label style="flex:1">Placa<input class="l-placa" maxlength="10" data-sem-correcao></label><label style="flex:1">Marca<input class="l-marca" maxlength="40" list="lj-marcas"></label></span></div><datalist id="lj-marcas">' + MARCAS.map(function (z) { return '<option value="' + esc(z) + '">'; }).join("") + "</datalist>" +
      '<div style="margin-top:8px"><b>👷 Lavadores</b><div class="linha l-lavs" style="gap:12px;flex-wrap:wrap"></div></div>' +
      '<div style="margin-top:8px"><b>🧴 Serviços feitos</b> <span class="peq mudo">(marque, ajuste a quantidade e o valor se precisar)</span><div class="l-servs"></div></div>' +
      '<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:6px"><label style="flex:2;min-width:200px">Observações<input class="l-obs" maxlength="300"></label><label class="marca-linha" style="min-width:140px"><input type="checkbox" class="l-pago"> Já foi pago</label></div>' +
      '<div class="cartao" style="margin-top:8px"><b>Total: <span class="l-total">R$ 0,00</span></b></div><div class="acoes"><button class="prim" id="l-ok">Salvar</button>' + (x ? "" : '<button id="l-ok2">Salvar e lançar outra</button>') + '<button id="l-x">Cancelar</button></div>', { titulo: x ? "✏️ Editar lavagem" : "🧽 Lançar lavagem", larga: true, semRascunho: true });
    var el = j.el; $(".l-data", el).value = data; $(".l-obs", el).value = d.obs || ""; $(".l-pago", el).checked = !!d.pago;
    $(".l-emp", el).innerHTML = '<option value="">Avulso / particular</option>' + cad("empresa").sort(porNome).map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.dados.nome) + "</option>"; }).join("");
    $(".l-emp", el).value = d.empresaId || "";
    function veiculos() {
      var eid = $(".l-emp", el).value, V = cad("veiculo").filter(function (v) { return v.dados.ativo !== false && (!eid || v.dados.empresaId === eid || v.id === d.veiculoId); }).sort(porNome);
      $(".l-vei", el).innerHTML = '<option value="">— escolha —</option>' + V.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(rotVeic(v)) + "</option>"; }).join("") + '<option value="+">➕ Novo caminhão (digitar a placa)</option>';
      $(".l-vei", el).value = d.veiculoId && V.some(function (v) { return v.id === d.veiculoId; }) ? d.veiculoId : "";
      $(".l-novo", el).style.display = "none";
    }
    veiculos();
    $(".l-emp", el).onchange = function () { d.veiculoId = ""; veiculos(); precos(); };
    $(".l-vei", el).onchange = function () { d.veiculoId = this.value === "+" ? "" : this.value; $(".l-novo", el).style.display = this.value === "+" ? "flex" : "none"; };
    $(".l-lavs", el).innerHTML = cad("lavador").filter(function (l) { return l.dados.ativo !== false || (d.lavadores || []).indexOf(l.id) >= 0; }).sort(porNome).map(function (l) { return '<label class="marca-linha" style="font-weight:400"><input type="checkbox" class="l-lav" value="' + esc(l.id) + '"' + ((d.lavadores || []).indexOf(l.id) >= 0 ? " checked" : "") + "> " + esc(l.dados.nome) + "</label>"; }).join("") || '<span class="peq mudo">Cadastre os lavadores na aba 👷 Lavadores (opcional).</span>';
    function itemDe(s) { return (d.itens || []).filter(function (i) { return i.sid === s.id; })[0]; }
    function servicos() {
      var emp = acharCad($(".l-emp", el).value);
      $(".l-servs", el).innerHTML = servs.map(function (s) {
        var it = itemDe(s), val = it ? it.valor : precoDe(emp, s);
        return '<div class="linha l-s" data-s="' + esc(s.id) + '" style="gap:8px;align-items:center;margin-top:4px"><label class="marca-linha" style="flex:2;min-width:200px;font-weight:400"><input type="checkbox" class="s-on"' + (it ? " checked" : "") + "> " + esc(s.dados.nome) + '</label><label style="width:70px">Qtd<input class="s-q" inputmode="decimal" value="' + (it ? fq(it.qtd) : "1") + '"></label><label style="width:120px">Valor un. (R$)<input class="s-v" inputmode="decimal" value="' + f2(val) + '"></label></div>';
      }).join("") || '<p class="peq mudo">Cadastre os serviços na aba 🧴 Serviços.</p>';
      $$(".l-s", el).forEach(function (r) { $$("input", r).forEach(function (i) { i.addEventListener("input", total); i.addEventListener("change", total); }); });
      total();
    }
    function precos() { servicos(); }   // trocou a empresa: refaz com os preços dela (preserva o que já foi marcado)
    function lerItens() {
      return $$(".l-s", el).map(function (r) {
        if (!$(".s-on", r).checked) return null; var s = acharCad(r.dataset.s);
        return { sid: s.id, nome: s.dados.nome, cat: s.dados.categoria || "", qtd: num($(".s-q", r).value) || 1, valor: num($(".s-v", r).value), custo: Number(s.dados.custo) || 0 };
      }).filter(Boolean);
    }
    function total() { d.itens = lerItens(); $(".l-total", el).textContent = din(totalLanc({ dados: d })); }
    servicos();
    function salvar(novaDepois) {
      d.itens = lerItens(); d.empresaId = $(".l-emp", el).value; d.obs = $(".l-obs", el).value.trim(); d.pago = $(".l-pago", el).checked; d.pagoEm = d.pago ? (d.pagoEm || hoje()) : "";
      d.lavadores = $$(".l-lav", el).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      var dt = $(".l-data", el).value; if (!dt) { A.avisar("Informe a data.", "erro"); return; }
      if (!d.itens.length) { A.avisar("Marque pelo menos um serviço.", "erro"); return; }
      var vsel = $(".l-vei", el).value, pr = Promise.resolve(vsel === "+" ? null : vsel);
      if (vsel === "+") {
        var pl = placaFmt($(".l-placa", el).value); if (!pl) { A.avisar("Digite a placa do caminhão novo.", "erro"); return; }
        var ja = cad("veiculo").filter(function (v) { return placaFmt(v.dados.placa) === pl; })[0];
        pr = ja ? Promise.resolve(ja.id) : inserir("veiculo", { placa: pl, marca: $(".l-marca", el).value.trim(), empresaId: d.empresaId, ativo: true }).then(function (v) { return v.id; });
      }
      pr.then(function (vid) {
        d.veiculoId = vid || ""; var v = vid && acharCad(vid); d.placa = v ? placaFmt(v.dados.placa) : "";
        var gravou = x ? (x.dados = d, x.data = dt, gravar(x)) : inserir("lancamento", d, dt);
        return Promise.resolve(gravou).then(function () {
          if (v) { v.dados.ult = v.dados.ult || {}; d.itens.forEach(function (i) { if (!v.dados.ult[i.sid] || v.dados.ult[i.sid] < dt) v.dados.ult[i.sid] = dt; }); if (!v.dados.empresaId && d.empresaId) v.dados.empresaId = d.empresaId; return gravar(v); }
        });
      }).then(function () {
        if (novaDepois) { j.fechar(); d = null; lancamento(null, raiz); } else { j.fechar(); desenhar(raiz); }
        A.avisar("Lavagem salva", "ok");
      }).catch(erro);
    }
    $("#l-ok", el).onclick = function () { salvar(false); };
    if ($("#l-ok2", el)) $("#l-ok2", el).onclick = function () { fEmp = $(".l-emp", el).value || fEmp; salvar(true); };
    $("#l-x", el).onclick = function () { j.fechar(); };
  }

  // ---- empresas ----
  function telaEmp(c, raiz) {
    var E = cad("empresa").sort(porNome);
    c.innerHTML = '<div class="acoes"><button class="prim" id="lj-novo">+ Nova empresa</button></div><p class="peq mudo">Empresas de transporte e frotas contratantes. Dá para combinar um <b>preço especial por serviço</b> para cada uma.</p>' +
      lista(E.map(function (e) {
        var n = cad("veiculo").filter(function (v) { return v.dados.empresaId === e.id && v.dados.ativo !== false; }).length;
        return '<div class="cartao"><div style="flex:1"><b>' + esc(e.dados.nome) + '</b><br><span class="peq mudo">' + n + " caminhão(ões)" + (e.dados.contato ? " · " + esc(e.dados.contato) : "") + (e.dados.tel ? " · " + esc(e.dados.tel) : "") + (e.dados.doc ? " · " + esc(e.dados.doc) : "") + "</span></div>" +
          '<div class="acoes"><button class="peq prim" data-ed="' + esc(e.id) + '">Editar / preços</button><button class="peq" data-ex="' + esc(e.id) + '">🧾 Extrato do mês</button><button class="peq" data-ct="' + esc(e.id) + '">📜 Contrato</button><button class="peq perigo" data-ap="' + esc(e.id) + '">Apagar</button></div></div>';
      }), "Nenhuma empresa ainda. Toque em + Nova empresa.");
    $("#lj-novo", c).onclick = function () { empresa(null, raiz); };
    $$("[data-ed]", c).forEach(function (b) { b.onclick = function () { empresa(acharCad(b.dataset.ed), raiz); }; });
    $$("[data-ex]", c).forEach(function (b) { b.onclick = function () { mes = mes || hoje().slice(0, 7); carregar(function () { extrato(b.dataset.ex); }); }; });
    $$("[data-ct]", c).forEach(function (b) { b.onclick = function () { contratoEmpresa(b.dataset.ct); }; });
    apagarBt(c, "data-ap", function (x) { return "a empresa “" + x.dados.nome + "” (os caminhões e as lavagens já lançadas continuam)"; }, function () { desenhar(raiz); });
  }
  function empresa(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { nome: "", precos: {} }, S = cad("servico").sort(porNome);
    var campos = [{ k: "nome", rot: "Nome da empresa", w: 260 }, { k: "doc", rot: "CNPJ", w: 170, fim: true }, { k: "contato", rot: "Contato / responsável", w: 200 }, { k: "tel", rot: "Telefone / WhatsApp", w: 170, fim: true }, { k: "end", rot: "Endereço", w: 300 }, { k: "email", rot: "E-mail", w: 220, fim: true }, { k: "venc", rot: "Fechamento / vencimento (ex.: fecha dia 30, paga até dia 10)", w: 380, fim: true }, { k: "obs", rot: "Observações", t: "area", w: 600 }];
    form(x ? "✏️ Empresa" : "🏢 Nova empresa", campos, d, function (o) {
      var dd = Object.assign({}, d, o);
      return x ? (x.dados = dd, gravar(x)).then(function () { desenhar(raiz); }) : inserir("empresa", dd).then(function () { desenhar(raiz); });
    }, {
      larga: true, validar: function (o) { return o.nome ? "" : "Informe o nome da empresa."; },
      extra: '<h4 style="margin:12px 0 2px">💲 Preço combinado com esta empresa</h4><p class="peq mudo" style="margin:0">Deixe em branco para usar o preço padrão do serviço.</p>' + (S.length ? S.map(function (s) { return '<div class="linha" style="gap:8px;align-items:center;margin-top:4px"><span style="flex:1;min-width:200px">' + esc(s.dados.nome) + ' <span class="peq mudo">(padrão ' + din(s.dados.preco) + ')</span></span><label style="width:130px"><input class="pe-' + esc(s.id) + '" inputmode="decimal" placeholder="padrão" value="' + (d.precos && d.precos[s.id] !== undefined && d.precos[s.id] !== "" ? f2(d.precos[s.id]) : "") + '"></label></div>'; }).join("") : '<p class="peq mudo">Cadastre os serviços para definir preços por empresa.</p>'),
      aoLer: function (el, o) { d.precos = {}; S.forEach(function (s) { var e = $(".pe-" + s.id, el); if (e && e.value.trim()) d.precos[s.id] = num(e.value); }); o.precos = d.precos; return o; }
    });
  }

  // ---- caminhões ----
  function telaCam(c, raiz) {
    var b = busca.toLowerCase().replace(/[^a-z0-9]/g, ""), V = cad("veiculo").sort(porNome).filter(function (v) { return !b || (placaFmt(v.dados.placa) + v.dados.marca + v.dados.modelo + nomeEmp(v.dados.empresaId)).toLowerCase().replace(/[^a-z0-9]/g, "").indexOf(b) >= 0; });
    var venc = [];
    cad("servico").filter(function (s) { return Number(s.dados.intervalo) > 0; }).forEach(function (s) {
      cad("veiculo").filter(function (v) { return v.dados.ativo !== false; }).forEach(function (v) {
        var u = (v.dados.ult || {})[s.id]; if (!u) return; var dd = dias(u, hoje()); if (dd >= Number(s.dados.intervalo)) venc.push({ v: v, s: s, dd: dd, u: u });
      });
    });
    venc.sort(function (a, z) { return z.dd - a.dd; });
    c.innerHTML = '<div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><button class="prim" id="lj-novo">+ Novo caminhão</button><input type="search" id="lj-b" data-sem-correcao placeholder="🔍 Placa, marca ou empresa" value="' + esc(busca) + '" style="flex:1;min-width:200px"></div>' +
      (venc.length ? '<div class="cartao" style="border-left:4px solid #e0a100"><b>⏰ Serviços vencidos</b> <span class="peq mudo">(pelo intervalo em dias definido em cada serviço)</span>' + venc.slice(0, 30).map(function (o) { return '<div class="peq" style="margin-top:3px">' + esc(rotVeic(o.v)) + " · " + esc(nomeEmp(o.v.dados.empresaId)) + " — <b>" + esc(o.s.dados.nome) + "</b>: feito em " + esc(dataBr(o.u)) + " (há " + o.dd + " dias)</div>"; }).join("") + "</div>" : "") +
      lista(V.map(function (v) {
        var d = v.dados;
        return '<div class="cartao"><div style="flex:1"><b>' + esc(rotVeic(v)) + "</b> " + (d.tipo ? selo(esc(d.tipo)) : "") + (d.ativo === false ? " " + selo("inativo") : "") + '<br><span class="peq mudo">' + esc(nomeEmp(d.empresaId)) + (d.obs ? " · " + esc(d.obs) : "") + "</span></div>" +
          '<div class="acoes"><button class="peq prim" data-ed="' + esc(v.id) + '">Editar</button><button class="peq perigo" data-ap="' + esc(v.id) + '">Apagar</button></div></div>';
      }), busca ? "Nenhum caminhão com essa busca." : "Nenhum caminhão ainda. Toque em + Novo caminhão.");
    $("#lj-novo", c).onclick = function () { veiculo(null, raiz); };
    $("#lj-b", c).oninput = function () { busca = this.value; telaCam(c, raiz); var i = $("#lj-b", c); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $$("[data-ed]", c).forEach(function (b2) { b2.onclick = function () { veiculo(acharCad(b2.dataset.ed), raiz); }; });
    apagarBt(c, "data-ap", function (x) { return "o caminhão " + rotVeic(x) + " (as lavagens já lançadas continuam)"; }, function () { desenhar(raiz); });
  }
  function veiculo(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { ativo: true, empresaId: fEmp && fEmp !== "-" ? fEmp : "" };
    var campos = [{ k: "placa", rot: "Placa", w: 120, sc: 1 }, { k: "marca", rot: "Marca", w: 170, lista: "lj-m" }, { k: "modelo", rot: "Modelo", w: 170, fim: true }, { k: "tipo", rot: "Tipo", t: "sel", op: [""].concat(TIPOS_V), w: 190 }, { k: "empresaId", rot: "Empresa contratante", t: "sel", op: [["", "Avulso / particular"]].concat(cad("empresa").sort(porNome).map(function (e) { return [e.id, e.dados.nome]; })), w: 260, fim: true }, { k: "obs", rot: "Observações (motorista, nº da frota...)", w: 380 }, { k: "ativo", rot: "Ativo", t: "chk", w: 100 }];
    form(x ? "✏️ Caminhão" : "🚛 Novo caminhão", campos, d, function (o) {
      o.placa = placaFmt(o.placa); var dd = Object.assign({}, d, o);
      return x ? (x.dados = dd, gravar(x)).then(function () { desenhar(raiz); }) : inserir("veiculo", dd).then(function () { desenhar(raiz); });
    }, { listas: [["lj-m", MARCAS]], validar: function (o) { var p = placaFmt(o.placa); if (!p) return "Informe a placa."; return cad("veiculo").some(function (v) { return v !== x && placaFmt(v.dados.placa) === p; }) ? "Já existe um caminhão com a placa " + p + "." : ""; } });
  }

  // ---- lavadores ----
  function telaLav(c, raiz) {
    var S = resumo();
    c.innerHTML = '<div class="acoes"><button class="prim" id="lj-novo">+ Novo lavador</button></div><p class="peq mudo">A comissão é calculada nas lavagens lançadas (em <b>%</b> do valor ou <b>valor fixo por caminhão</b>, dividido entre os lavadores marcados). O total do mês (' + esc(mesBr(mes)) + ') aparece abaixo de cada um. Para outro mês, troque o mês em 🧽 Lavagens.</p>' +
      lista(cad("lavador").sort(porNome).map(function (l) {
        var p = S.porLav[l.id] || { n: 0, com: 0 };
        return '<div class="cartao"><div style="flex:1"><b>' + esc(l.dados.nome) + "</b> " + (l.dados.ativo === false ? selo("inativo") : "") + '<br><span class="peq mudo">' + (l.dados.tel ? esc(l.dados.tel) + " · " : "") + "comissão " + (l.dados.comTipo === "fixo" ? din(l.dados.comissao) + " por caminhão" : fq(l.dados.comissao) + "% do valor") + "</span><br><span class=\"peq\">Neste mês: " + p.n + " caminhão(ões) · comissão <b>" + din(r2(p.com)) + "</b></span></div>" +
          '<div class="acoes"><button class="peq prim" data-ed="' + esc(l.id) + '">Editar</button><button class="peq perigo" data-ap="' + esc(l.id) + '">Apagar</button></div></div>';
      }), "Nenhum lavador ainda. Toque em + Novo lavador.");
    $("#lj-novo", c).onclick = function () { lavador(null, raiz); };
    $$("[data-ed]", c).forEach(function (b) { b.onclick = function () { lavador(acharCad(b.dataset.ed), raiz); }; });
    apagarBt(c, "data-ap", function (x) { return "o lavador " + x.dados.nome + " (a comissão das lavagens já lançadas deixa de contar para ele)"; }, function () { desenhar(raiz); });
  }
  function lavador(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { comTipo: "pct", comissao: 0, ativo: true };
    var campos = [{ k: "nome", rot: "Nome", w: 260 }, { k: "tel", rot: "Telefone / WhatsApp", w: 170, fim: true }, { k: "comTipo", rot: "Comissão em", t: "sel", op: [["pct", "% do valor do serviço"], ["fixo", "R$ fixo por caminhão"]], w: 220 }, { k: "comissao", rot: "Valor da comissão", t: "num", w: 130 }, { k: "doc", rot: "CPF", w: 150, fim: true }, { k: "pix", rot: "Chave Pix", w: 260 }, { k: "ativo", rot: "Ativo", t: "chk", w: 100 }];
    form(x ? "✏️ Lavador" : "👷 Novo lavador", campos, d, function (o) {
      var dd = Object.assign({}, d, o); return x ? (x.dados = dd, gravar(x)).then(function () { desenhar(raiz); }) : inserir("lavador", dd).then(function () { desenhar(raiz); });
    }, { validar: function (o) { return o.nome ? "" : "Informe o nome."; } });
  }

  // ---- serviços ----
  function telaServ(c, raiz) {
    var S = cad("servico").sort(function (a, b) { return CATEG.indexOf(a.dados.categoria) - CATEG.indexOf(b.dados.categoria) || porNome(a, b); });
    c.innerHTML = '<div class="acoes"><button class="prim" id="lj-novo">+ Novo serviço</button>' + (S.length ? "" : '<button id="lj-seed">⚡ Criar lista inicial (lavagens e lubrificação)</button>') + '</div><p class="peq mudo">Preço padrão de cada serviço. Em <b>Intervalo</b> (dias) o app avisa quando um caminhão estiver vencido (ex.: lubrificação a cada 15 dias). O <b>custo</b> (produtos, graxa, óleo) é opcional e entra no lucro.</p>' +
      lista(S.map(function (s) {
        return '<div class="cartao"><div style="flex:1"><b>' + esc(s.dados.nome) + "</b> " + selo(esc(s.dados.categoria || "Outro")) + '<br><span class="peq mudo">preço ' + din(s.dados.preco) + (Number(s.dados.custo) > 0 ? " · custo " + din(s.dados.custo) : "") + (Number(s.dados.intervalo) > 0 ? " · repetir a cada " + s.dados.intervalo + " dias" : "") + '</span></div><div class="acoes"><button class="peq prim" data-ed="' + esc(s.id) + '">Editar</button><button class="peq perigo" data-ap="' + esc(s.id) + '">Apagar</button></div></div>';
      }), "Nenhum serviço ainda.");
    $("#lj-novo", c).onclick = function () { servico(null, raiz); };
    if ($("#lj-seed", c)) $("#lj-seed", c).onclick = function () { Promise.all(SEED.map(function (s) { return inserir("servico", { nome: s[0], categoria: s[1], preco: 0, custo: 0, intervalo: "" }); })).then(function () { A.avisar("Lista criada: agora coloque o preço de cada serviço.", "ok"); desenhar(raiz); }).catch(erro); };
    $$("[data-ed]", c).forEach(function (b) { b.onclick = function () { servico(acharCad(b.dataset.ed), raiz); }; });
    apagarBt(c, "data-ap", function (x) { return "o serviço “" + x.dados.nome + "” (as lavagens já lançadas continuam)"; }, function () { desenhar(raiz); });
  }
  function servico(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { categoria: "Lavagem" };
    var campos = [{ k: "nome", rot: "Serviço", w: 320 }, { k: "categoria", rot: "Tipo", t: "sel", op: CATEG, w: 160, fim: true }, { k: "preco", rot: "Preço padrão (R$)", t: "num", w: 150 }, { k: "custo", rot: "Custo de produtos (R$, opcional)", t: "num", w: 200 }, { k: "intervalo", rot: "Repetir a cada (dias, opcional)", t: "num", w: 200 }];
    form(x ? "✏️ Serviço" : "🧴 Novo serviço", campos, d, function (o) {
      o.intervalo = o.intervalo === "" ? "" : Math.round(o.intervalo); var dd = Object.assign({}, d, o); return x ? (x.dados = dd, gravar(x)).then(function () { desenhar(raiz); }) : inserir("servico", dd).then(function () { desenhar(raiz); });
    }, { validar: function (o) { return o.nome ? "" : "Informe o nome do serviço."; } });
  }

  // ---- despesas ----
  function telaDesp(c, raiz) {
    var D = MOV.filter(function (x) { return x.tipo === "despesa"; }), tot = r2(D.reduce(function (s, x) { return s + (Number(x.dados.valor) || 0); }, 0));
    c.innerHTML = '<div class="linha" style="gap:8px;align-items:flex-end"><button class="prim" id="lj-novo">+ Lançar despesa</button><div class="peq mudo" style="flex:1;text-align:right">Total do mês: <b>' + din(tot) + "</b></div></div><p class=\"peq mudo\">Água, energia, produtos, aluguel, salários... Entram no resultado do mês.</p>" +
      lista(D.map(function (x) { return '<div class="cartao"><div style="flex:1"><b>' + esc(x.dados.desc || x.dados.categoria) + '</b><br><span class="peq mudo">' + esc(dataBr(x.data)) + " · " + esc(x.dados.categoria || "") + '</span></div><div style="text-align:right"><b>' + din(x.dados.valor) + '</b></div><div class="acoes"><button class="peq" data-ed="' + esc(x.id) + '">Editar</button><button class="peq perigo" data-ap="' + esc(x.id) + '">Apagar</button></div></div>'; }), "Nenhuma despesa neste mês.");
    $("#lj-novo", c).onclick = function () { despesa(null, raiz); };
    $$("[data-ed]", c).forEach(function (b) { b.onclick = function () { despesa(MOV.filter(function (y) { return y.id === b.dataset.ed; })[0], raiz); }; });
    apagarBt(c, "data-ap", function (x) { return "a despesa “" + (x.dados.desc || x.dados.categoria) + "” de " + din(x.dados.valor); }, function () { desenhar(raiz); });
  }
  function despesa(x, raiz) {
    var d = x ? JSON.parse(JSON.stringify(x.dados)) : { categoria: "Produtos de limpeza / químicos", data: hoje().slice(0, 7) === mes ? hoje() : mes + "-01" };
    if (x) d.data = x.data;
    var campos = [{ k: "data", rot: "Data", t: "date", w: 150 }, { k: "categoria", rot: "Tipo", t: "sel", op: DESP, w: 250, fim: true }, { k: "desc", rot: "Descrição", w: 300 }, { k: "valor", rot: "Valor (R$)", t: "num", w: 140 }];
    form(x ? "✏️ Despesa" : "💸 Nova despesa", campos, d, function (o) {
      var dt = o.data; delete o.data; var dd = Object.assign({}, d, o); delete dd.data;
      return x ? (x.dados = dd, x.data = dt, gravar(x)).then(function () { desenhar(raiz); }) : inserir("despesa", dd, dt).then(function () { desenhar(raiz); });
    }, { validar: function (o) { return !o.data ? "Informe a data." : !(o.valor > 0) ? "Informe o valor." : ""; } });
  }

  // ---- resultado do mês ----
  function telaRes(c, raiz) {
    var S = resumo(), cf = cfg(), nm = function (id) { var e = acharCad(id); return id === "-" ? "Avulso / particular" : e ? e.dados.nome : "(empresa apagada)"; };
    var corLucro = S.lucro >= 0 ? "var(--bom,#1b7f3b)" : "var(--perigo,#c0392b)";
    function kpi(t, v, cor) { return '<div style="min-width:150px"><div class="peq mudo">' + t + '</div><b style="font-size:1.1em;' + (cor ? "color:" + cor : "") + '">' + v + "</b></div>"; }
    c.innerHTML = '<div class="acoes"><button class="peq" id="lj-cfg">⚙ Dados do lava-jato e do sócio</button><button class="peq prim" id="lj-pc">🖨 Prestação de contas (PDF)</button></div>' +
      '<div class="cartao"><b>' + esc(mesBr(mes)) + '</b><div class="linha" style="gap:14px;flex-wrap:wrap;margin-top:6px">' + kpi("Caminhões atendidos", S.n) + kpi("Faturado", din(S.fat)) + kpi("Recebido", din(S.rec)) + kpi("A receber", din(S.aberto), S.aberto > 0 ? "#b7791f" : "") + "</div></div>" +
      '<div class="cartao"><b>Resultado</b>' + [["Faturado", S.fat], ["(−) Comissões dos lavadores", -S.com], ["(−) Produtos e materiais dos serviços", -S.prod], ["(−) Despesas do mês", -S.desp]].map(function (l) { return '<div class="linha" style="justify-content:space-between;margin-top:3px"><span>' + l[0] + "</span><span>" + din(l[1]) + "</span></div>"; }).join("") +
      '<div class="linha" style="justify-content:space-between;margin-top:6px;border-top:1px solid var(--borda,#ccc);padding-top:6px"><b>Lucro do mês</b><b style="color:' + corLucro + '">' + din(S.lucro) + "</b></div>" +
      (S.pct ? '<div class="linha" style="justify-content:space-between;margin-top:3px"><span>Parte do sócio' + (cf.socioNome ? " (" + esc(cf.socioNome) + ")" : "") + " – " + fq(S.pct) + '%</span><b>' + din(S.socio) + '</b></div><div class="linha" style="justify-content:space-between"><span>Minha parte – ' + fq(100 - S.pct) + "%</span><b>" + din(S.minha) + "</b></div>" : '<p class="peq mudo" style="margin:6px 0 0">Para ver a parte do sócio, toque em ⚙ e informe o % dele.</p>') +
      '<p class="peq mudo" style="margin:6px 0 0">O lucro usa o valor <b>faturado</b> no mês (mesmo o que ainda não foi recebido). Confira com o contador antes de dividir resultados.</p></div>' +
      tabela("Por empresa", ["Empresa", "Caminhões", "Faturado", "A receber"], Object.keys(S.porEmp).map(function (k) { var p = S.porEmp[k]; return [esc(nm(k)), p.n, din(r2(p.tot)), din(r2(p.aberto))]; })) +
      tabela("Por lavador", ["Lavador", "Caminhões", "Produção", "Comissão"], Object.keys(S.porLav).map(function (k) { var p = S.porLav[k], l = acharCad(k); return [esc(l ? l.dados.nome : "?"), p.n, din(r2(p.prod)), din(r2(p.com))]; })) +
      tabela("Por serviço", ["Serviço", "Quantidade", "Valor"], Object.keys(S.porServ).sort().map(function (k) { return [esc(k), fq(S.porServ[k].qtd), din(r2(S.porServ[k].tot))]; })) +
      tabela("Despesas por tipo", ["Tipo", "Valor"], Object.keys(S.despCat).map(function (k) { return [esc(k), din(r2(S.despCat[k]))]; }));
    $("#lj-cfg", c).onclick = function () { configurar(raiz); };
    $("#lj-pc", c).onclick = function () { imprimirResumo(S); };
  }
  function tabela(tit, cab, linhas) {
    if (!linhas.length) return "";
    return '<div class="cartao"><b>' + tit + '</b><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr>' + cab.map(function (h, i) { return '<th style="text-align:' + (i ? "right" : "left") + ';padding:3px 6px" class="peq mudo">' + h + "</th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (l) { return "<tr>" + l.map(function (v, i) { return '<td style="text-align:' + (i ? "right" : "left") + ';padding:3px 6px;border-top:1px solid var(--borda,#e3e3e3)">' + v + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></div>";
  }
  function configurar(raiz) {
    var x = cad("config")[0], d = x ? JSON.parse(JSON.stringify(x.dados)) : {};
    var campos = [{ k: "nome", rot: "Nome do lava-jato", w: 300 }, { k: "doc", rot: "CNPJ", w: 170, fim: true }, { k: "end", rot: "Endereço", w: 380 }, { k: "rep", rot: "Quem assina pelo lava-jato", w: 240, fim: true }, { k: "foro", rot: "Cidade/UF (foro dos contratos)", w: 240 }, { k: "tel", rot: "Telefone", w: 160, fim: true }, { k: "socioNome", rot: "Nome do sócio", w: 260 }, { k: "socioPct", rot: "Parte do sócio no lucro (%)", t: "num", w: 190 }];
    form("⚙ Dados do lava-jato e do sócio", campos, d, function (o) {
      var dd = Object.assign({}, d, o); return x ? (x.dados = dd, gravar(x)).then(function () { desenhar(raiz); }) : inserir("config", dd).then(function () { desenhar(raiz); });
    }, { larga: true, validar: function (o) { return Number(o.socioPct) > 100 || Number(o.socioPct) < 0 ? "O percentual do sócio deve estar entre 0 e 100." : ""; } });
  }

  // ---- contratos ----
  // dados do lava-jato (nunca herdam o CNPJ e o endereço da AGE: o que estiver vazio fica em branco para preencher)
  function emp0() { var c = cfg(); return { emp_nome: c.nome || "", emp_doc: c.doc || "", emp_end: c.end || "", emp_rep: c.rep || "", emp_tel: c.tel || "", emp_email: "", foro: c.foro || "" }; }
  function limparVazios(o) { Object.keys(o).forEach(function (k) { if (!o[k]) delete o[k]; }); return o; }
  function contratoEmpresa(id) {
    var e = id && acharCad(id), V = e ? cad("veiculo").filter(function (v) { return v.dados.empresaId === e.id && v.dados.ativo !== false; }).sort(porNome) : [], S = cad("servico").sort(porNome);
    var d = Object.assign(emp0(), limparVazios(Object.assign(e ? { cli_nome: e.dados.nome, cli_doc: e.dados.doc, cli_end: e.dados.end, cli_rep: e.dados.contato, cli_tel: e.dados.tel, cli_email: e.dados.email } : {}, {
      frota: V.map(function (v) { return placaFmt(v.dados.placa) + (v.dados.marca ? " – " + v.dados.marca : "") + (v.dados.modelo ? " " + v.dados.modelo : "") + (v.dados.tipo ? " (" + v.dados.tipo + ")" : ""); }).join("\n"),
      objeto: S.filter(function (s) { return Number(precoDe(e, s)) > 0; }).map(function (s) { return s.dados.nome + " – " + din(precoDe(e, s)) + " por serviço"; }).join("\n"),
      pagamento: e && e.dados.venc ? e.dados.venc : ""
    })));
    if (!window.AGE_CONTR || !window.AGE_CONTR.daLavaJato) { A.avisar("Atualize o app para criar contratos.", "erro"); return; }
    window.AGE_CONTR.daLavaJato("lj_frota", d);
  }
  function telaContr(c) {
    var E = cad("empresa").sort(porNome);
    c.innerHTML = '<p class="peq mudo">Os contratos são criados na aba <b>📜 Contratos</b>, já preenchidos com os dados do cadastro (empresa, caminhões, preços). Lá você edita o texto, guarda como <b>pré-aprovado</b> e imprime em PDF para assinar.</p>' +
      '<div class="cartao"><b>🏢 Contrato com a empresa contratante (frota de caminhões)</b><p class="peq mudo" style="margin:2px 0 6px">Lavagem e lubrificação da frota: relação de caminhões (marca e placa), tabela de preços, fechamento mensal, cuidados com o veículo e responsabilidades.</p><div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><label style="min-width:240px">Empresa<select id="ct-e"><option value="">(preencher depois)</option>' + E.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.dados.nome) + "</option>"; }).join("") + '</select></label><button class="prim" id="ct-fro">📜 Criar contrato</button></div></div>' +
      '<div class="cartao"><b>🤝 Contrato com o sócio (sociedade em conta de participação)</b><p class="peq mudo" style="margin:2px 0 6px">Para quem entra com dinheiro ou equipamentos e divide o lucro, sem criar outra empresa. Traz aporte, divisão do lucro, prestação de contas mensal, saída e prazo.</p><button class="prim" id="ct-soc">📜 Criar contrato de sócio</button></div>' +
      '<div class="cartao"><b>👷 Contrato com lavador</b><p class="peq mudo" style="margin:2px 0 6px">Autônomo (parceiro, por diária ou por caminhão lavado) ou funcionário com carteira assinada (CLT).</p><button class="peq" id="ct-par">📜 Abrir modelos de equipe</button></div>';
    $("#ct-fro", c).onclick = function () { contratoEmpresa($("#ct-e", c).value); };
    $("#ct-soc", c).onclick = function () {
      var cf = cfg(), d = Object.assign(emp0(), limparVazios({ cli_nome: cf.socioNome, perc_part: cf.socioPct ? String(cf.socioPct).replace(".", ",") : "", objeto: "Exploração de lava-jato de caminhões, com lavagem, lubrificação e serviços correlatos, em " + (cf.end || "[endereço]") }));
      window.AGE_CONTR.daLavaJato("lj_socio", d);
    };
    $("#ct-par", c).onclick = function () { location.hash = "#contratos"; };
  }

  // ---------- impressão ----------
  function cabecalho(tit) {
    var E = A.CFG.EMPRESA || {}, cf = cfg(), nome = cf.nome || E.nome || "Lava-jato";
    return { nome: nome, html: '<div class="cab"><div><b>' + esc(nome) + "</b><br>" + [cf.doc || E.documento, cf.tel || E.telefone, cf.end || E.endereco].filter(Boolean).map(esc).join(" · ") + '</div><div style="text-align:right">' + esc(tit) + "<br>" + esc(mesBr(mes)) + "</div></div>" };
  }
  function janelaImp(titulo, corpo) {
    var w = window.open("", "_blank");
    if (!w) { A.avisar("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.", "erro"); return; }
    w.document.open(); w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(titulo) + "</title><style>body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:0 auto;padding:26px;max-width:820px}.cab{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #14325c;padding-bottom:10px}.cab b{font-size:19px;color:#14325c}h2{text-align:center;color:#14325c;margin:16px 0 8px;font-size:16px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #999;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eef1f6;font-size:11px;text-transform:uppercase}.d{text-align:right;white-space:nowrap}tfoot td{font-weight:bold;background:#f6f6f6}.ass{margin-top:46px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #333;text-align:center;padding-top:4px}@media print{body{padding:0}button{display:none}}button{padding:10px 16px;font-size:15px;margin:0 0 14px;cursor:pointer}</style></head><body><button onclick=\"window.print()\">🖨 Imprimir / salvar PDF</button>" + corpo + "<script>setTimeout(function(){window.print()},400)<\/script></body></html>"); w.document.close();
  }
  function extrato(empId) {
    var e = acharCad(empId); if (!e) return;
    var L = MOV.filter(function (x) { return x.tipo === "lancamento" && x.dados.empresaId === empId; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    if (!L.length) { A.avisar("Nenhuma lavagem desta empresa em " + mesBr(mes) + ".", "erro"); return; }
    var tot = r2(L.reduce(function (s, x) { return s + totalLanc(x); }, 0)), ab = r2(L.filter(function (x) { return !x.dados.pago; }).reduce(function (s, x) { return s + totalLanc(x); }, 0)), h = cabecalho("Extrato de serviços");
    janelaImp("Extrato " + e.dados.nome, h.html + "<h2>Extrato de serviços – " + esc(e.dados.nome) + "</h2><p><b>Cliente:</b> " + esc(e.dados.nome) + (e.dados.doc ? " · CNPJ " + esc(e.dados.doc) : "") + "<br><b>Período:</b> " + esc(mesBr(mes)) + "</p>" +
      "<table><thead><tr><th>Data</th><th>Caminhão (placa / marca)</th><th>Serviços</th><th class=\"d\">Valor</th><th>Situação</th></tr></thead><tbody>" +
      L.map(function (x) { var v = acharCad(x.dados.veiculoId); return "<tr><td>" + dataBr(x.data) + "</td><td>" + esc(v ? rotVeic(v) : x.dados.placa || "") + "</td><td>" + (x.dados.itens || []).map(function (i) { return esc((Number(i.qtd) > 1 ? fq(i.qtd) + "× " : "") + i.nome); }).join("<br>") + '</td><td class="d">' + din(totalLanc(x)) + "</td><td>" + (x.dados.pago ? "Pago" : "A pagar") + "</td></tr>"; }).join("") +
      '</tbody><tfoot><tr><td colspan="3">TOTAL (' + L.length + ' serviço(s))</td><td class="d">' + din(tot) + "</td><td></td></tr>" + (ab > 0 && ab < tot ? '<tr><td colspan="3">A PAGAR</td><td class="d">' + din(ab) + "</td><td></td></tr>" : "") + "</tfoot></table>" +
      (e.dados.venc ? "<p><b>Condições:</b> " + esc(e.dados.venc) + "</p>" : "") + '<div class="ass"><div>' + esc(h.nome) + "</div><div>De acordo – " + esc(e.dados.nome) + "</div></div>");
  }
  function imprimirResumo(S) {
    var cf = cfg(), h = cabecalho("Prestação de contas");
    function lin(a, v, forte) { return "<tr" + (forte ? ' style="font-weight:bold;background:#f6f6f6"' : "") + "><td>" + a + '</td><td class="d">' + din(v) + "</td></tr>"; }
    janelaImp("Prestação de contas " + mes, h.html + "<h2>Prestação de contas – " + esc(mesBr(mes)) + "</h2><table><tbody>" + lin("Faturado (" + S.n + " caminhões atendidos)", S.fat) + lin("Recebido", S.rec) + lin("A receber", S.aberto) + lin("(−) Comissões dos lavadores", -S.com) + lin("(−) Produtos e materiais dos serviços", -S.prod) + lin("(−) Despesas do mês", -S.desp) + lin("LUCRO DO MÊS", S.lucro, true) +
      (S.pct ? lin("Parte de " + esc(cf.socioNome || "sócio") + " (" + fq(S.pct) + "%)", S.socio, true) + lin("Minha parte (" + fq(100 - S.pct) + "%)", S.minha, true) : "") + "</tbody></table>" +
      (Object.keys(S.despCat).length ? "<h2>Despesas</h2><table><tbody>" + Object.keys(S.despCat).map(function (k) { return lin(esc(k), S.despCat[k]); }).join("") + "</tbody></table>" : "") +
      '<p style="font-size:11px;color:#555">Lucro calculado sobre o valor faturado no mês. Valores sujeitos à conferência.</p><div class="ass"><div>' + esc(h.nome) + "</div><div>" + esc(cf.socioNome || "Sócio") + "</div></div>");
  }

  window.AGE_LJ = { ver: ver, totalLanc: totalLanc, comissoes: comissoes };
})();
