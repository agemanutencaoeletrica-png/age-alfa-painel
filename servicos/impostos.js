// Painel do dono — 🧾 IMPOSTOS E DÍVIDAS da firma: cada parcelamento (ou dívida avulsa) separado, com o valor da dívida,
// quantas parcelas são, quantas já foram pagas, quantas faltam, o vencimento de cada uma e o aviso no Telegram.
// Tabelas: impostos_parcelamentos e impostos_parcelas (supabase.sql). O aviso no Telegram é mandado por uma rotina diária do GitHub
// (scripts/lembrete-impostos.mjs); aqui você só vê e controla a chave dela. Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, raiz = null, abertos = {}, fila = Promise.resolve();

  function hoje() { return A.isoLocal(new Date()); }
  function num(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function campo(v) { return v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2).replace(".", ","); }
  function lerValor(t) { var s = String(t || "").trim(); return s ? A.lerNumero(s) : null; }
  function dias(iso) { var a = new Date(iso + "T12:00:00"), b = new Date(hoje() + "T12:00:00"); return Math.round((a - b) / 864e5); }
  function quando(iso) { var d = dias(iso); return d < 0 ? "atrasada há " + (-d) + " dia" + (d === -1 ? "" : "s") : d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : "vence em " + d + " dias"; }
  function dinheiro(v) { return A.dinheiro(num(v)); }
  function dividas() { return (P && P.S.impDividas) || []; }
  function parcelasDe(id) { return ((P && P.S.impParcelas) || []).filter(function (x) { return x.parcelamento_id === id; }).sort(function (a, b) { return a.numero - b.numero; }); }

  // ---------- datas ----------
  function ultimoDiaUtil(ano, mes) {   // mes 0-11; sem considerar feriados
    var d = new Date(ano, mes + 1, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return A.isoLocal(d);
  }
  function maisMeses(iso, k, regra) {
    var p = iso.split("-").map(Number), m = p[1] - 1 + k, ano = p[0] + Math.floor(m / 12), mes = ((m % 12) + 12) % 12;
    if (regra === "ultimo") return ultimoDiaUtil(ano, mes);
    var dia = Math.min(p[2], new Date(ano, mes + 1, 0).getDate());
    return A.isoLocal(new Date(ano, mes, dia));
  }

  // ---------- contas de cada dívida ----------
  function resumo(d) {
    var ps = parcelasDe(d.id), pagas = ps.filter(function (x) { return x.pago_em; }), abertas = ps.filter(function (x) { return !x.pago_em; });
    var total = d.n_parcelas || ps.length, soma = function (l, f) { return l.reduce(function (s, x) { return s + f(x); }, 0); };
    abertas.sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0; });
    return { ps: ps, pagas: pagas.length, abertas: abertas, total: total, faltam: Math.max(0, total - pagas.length),
      valorPago: num(soma(pagas, function (x) { return x.valor_pago !== null && x.valor_pago !== undefined ? Number(x.valor_pago) : Number(x.valor); })),
      restante: num(soma(abertas, function (x) { return Number(x.valor); })), proxima: abertas[0] || null,
      semParcelas: Math.max(0, total - ps.length) };   // parcelas contratadas que ainda não foram cadastradas
  }

  // ---------- gravação ----------
  function gravarParcela(id, dados) {
    var r = fila.then(function () {
      return P.q(P.sb.from("impostos_parcelas").update(dados).eq("id", id).select().single()).then(function (n) { P.trocar(P.S.impParcelas, n); return n; });
    });
    fila = r.catch(function () { /* o erro vai para quem chamou */ });
    return r;
  }

  // ---------- tela ----------
  function ver(c, ctx) {
    P = ctx; raiz = c;
    var S = P.S, ds = dividas().filter(function (d) { return d.ativo !== false; }), rs = ds.map(function (d) { return { d: d, r: resumo(d) }; });
    var aberto = 0, pago = 0, venc7 = 0, nVenc7 = 0, atras = 0, nAtras = 0, proximas = [];
    rs.forEach(function (x) {
      aberto += x.r.restante; pago += x.r.valorPago;
      x.r.abertas.forEach(function (p) {
        var dd = dias(p.vencimento);
        if (dd < 0) { atras += Number(p.valor); nAtras++; } else if (dd <= 7) { venc7 += Number(p.valor); nVenc7++; }
        proximas.push({ d: x.d, p: p, dd: dd });
      });
    });
    proximas.sort(function (a, b) { return a.p.vencimento < b.p.vencimento ? -1 : a.p.vencimento > b.p.vencimento ? 1 : 0; });
    c.innerHTML = '<div class="cab-secao"><h2>🧾 Impostos e dívidas</h2><span><button class="prim" id="im-novo">+ Parcelamento / dívida</button> <button id="im-tg" title="Aviso no Telegram dois dias antes de vencer">🔔 Lembrete no Telegram</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Cada dívida da firma separada, com as parcelas, o que já foi pago e o que falta. Marque a parcela como paga quando pagar.</p>' +
      (S.semImpostos ? '<div class="aviso">Para usar, rode no Supabase o <b>supabase.sql</b> atualizado (tabelas <b>impostos_parcelamentos</b> e <b>impostos_parcelas</b>) e depois o arquivo de dados iniciais.</div>' : "") +
      '<div class="cartao"><div><b>Em aberto:</b> ' + dinheiro(aberto) + ' · <b>Já pago:</b> ' + dinheiro(pago) + '</div>' +
      (nAtras ? '<div style="margin-top:4px;color:var(--critico)"><b>⚠ Atrasadas:</b> ' + nAtras + " parcela(s), " + dinheiro(atras) + "</div>" : "") +
      '<div style="margin-top:4px"><b>Vencem em até 7 dias:</b> ' + nVenc7 + " parcela(s), " + dinheiro(venc7) + "</div>" +
      (proximas.length ? '<div class="peq" style="margin-top:8px"><b>Próximos vencimentos</b>' + proximas.slice(0, 5).map(function (x) {
        return "<div>" + esc(A.dataSimples(x.p.vencimento)) + " · " + dinheiro(x.p.valor) + " · " + esc(x.d.nome) + " (parcela " + x.p.numero + ") · <span style=\"" + (x.dd < 0 ? "color:var(--critico);font-weight:700" : x.dd <= 2 ? "color:var(--atencao);font-weight:700" : "") + "\">" + quando(x.p.vencimento) + "</span></div>";
      }).join("") + "</div>" : "") + "</div>" +
      '<div id="im-lista"></div>';
    var l = $("#im-lista", c);
    l.innerHTML = rs.length ? rs.map(function (x) { return cartao(x.d, x.r); }).join("") : '<div class="cartao mudo">Nenhum parcelamento ou dívida cadastrado. Toque em “+ Parcelamento / dívida”.</div>';
    $("#im-novo", c).onclick = function () { editar(null); };
    $("#im-tg", c).onclick = lembrete;
    $$("[data-ed]", l).forEach(function (b) { b.onclick = function () { editar(P.porId(P.S.impDividas, b.dataset.ed)); }; });
    $$("[data-ap]", l).forEach(function (b) { b.onclick = function () { apagar(P.porId(P.S.impDividas, b.dataset.ap)); }; });
    $$("[data-pagar]", l).forEach(function (b) { b.onclick = function () { alternarPago(b.dataset.pagar, true); }; });
    $$("[data-mais]", l).forEach(function (b) { b.onclick = function () { maisParcela(b.dataset.mais); }; });
    $$("details[data-det]", l).forEach(function (dt) { dt.ontoggle = function () { abertos[dt.dataset.det] = dt.open; }; });
    $$("tr[data-pid]", l).forEach(ligarLinha);
  }

  function cartao(d, r) {
    var pct = r.total ? Math.round(r.pagas / r.total * 100) : 0, prox = r.proxima, dd = prox ? dias(prox.vencimento) : null;
    var comp = [d.principal, d.multa, d.juros].some(function (v) { return v !== null && v !== undefined; });
    return '<div class="cartao"><div style="float:right"><button class="peq" data-ed="' + esc(d.id) + '">✏️ Editar</button> <button class="peq" data-ap="' + esc(d.id) + '" title="Apagar esta dívida e as parcelas dela">🗑</button></div>' +
      "<div><b>" + esc(d.nome) + "</b> " + (d.tipo === "avulsa" ? '<span class="selo">dívida avulsa</span>' : '<span class="selo">parcelamento</span>') + "</div>" +
      '<div class="peq mudo">' + [d.orgao ? esc(d.orgao) : "", d.numero ? "nº " + esc(d.numero) : ""].filter(Boolean).join(" · ") + "</div>" +
      '<div style="margin-top:6px"><b>Valor da dívida: ' + (Number(d.valor_total) ? dinheiro(d.valor_total) : '<span class="mudo">não informado</span>') + "</b>" +
      (comp ? ' <span class="peq mudo">· principal ' + dinheiro(d.principal) + " · multa " + dinheiro(d.multa) + " · juros " + dinheiro(d.juros) + "</span>" : "") + "</div>" +
      '<div style="margin-top:4px">Parcelas: <b>' + r.pagas + (r.pagas === 1 ? " paga" : " pagas") + "</b> de " + (d.n_parcelas ? r.total : '<span title="O total de parcelas não foi informado">?</span>') + " · <b>faltam " + (d.n_parcelas ? r.faltam : r.abertas.length + "+") + "</b>" +
      (r.semParcelas ? ' <span class="peq mudo">(' + r.semParcelas + " ainda sem data cadastrada)</span>" : "") + "</div>" +
      '<div style="background:var(--sup2);border-radius:6px;height:8px;margin:6px 0"><div style="background:var(--bom);height:8px;border-radius:6px;width:' + pct + '%"></div></div>' +
      '<div class="peq">Já pago <b>' + dinheiro(r.valorPago) + "</b> · falta pagar <b>" + dinheiro(r.restante) + "</b></div>" +
      (prox ? '<div style="margin-top:6px"><b>Próxima:</b> parcela ' + prox.numero + " · " + esc(A.dataSimples(prox.vencimento)) + " · " + dinheiro(prox.valor) + " · <span style=\"" + (dd < 0 ? "color:var(--critico);font-weight:700" : dd <= 2 ? "color:var(--atencao);font-weight:700" : "") + "\">" + quando(prox.vencimento) + '</span> <button class="peq prim" data-pagar="' + esc(prox.id) + '">✅ Marcar como paga</button></div>'
        : '<div style="margin-top:6px" class="mudo">' + (r.ps.length ? "Todas as parcelas cadastradas estão pagas." : "Sem parcelas cadastradas.") + "</div>") +
      (d.obs ? '<div class="peq mudo" style="margin-top:6px;white-space:pre-line">' + esc(d.obs) + "</div>" : "") +
      '<details class="peq" data-det="' + esc(d.id) + '"' + (abertos[d.id] ? " open" : "") + ' style="margin-top:8px"><summary>Ver as parcelas (' + r.ps.length + ")</summary>" +
      '<div class="tabela-caixa"><table style="width:100%;margin-top:6px"><thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Paga</th><th>Aviso</th><th></th></tr></thead><tbody>' + r.ps.map(linha).join("") + "</tbody></table></div>" +
      '<div style="margin-top:6px"><button class="peq" data-mais="' + esc(d.id) + '">+ Parcela</button> <span class="mudo">Mude a data ou o valor direto na linha: salva sozinho.</span></div></details></div>';
  }

  function linha(p) {
    var atras = !p.pago_em && dias(p.vencimento) < 0;
    return '<tr data-pid="' + esc(p.id) + '"' + (atras ? ' style="background:var(--critico-f)"' : "") + "><td>" + p.numero + '</td><td><input type="date" class="ip-venc" value="' + esc(p.vencimento) + '"></td>' +
      '<td><input class="ip-val" inputmode="decimal" style="width:96px" value="' + campo(p.valor) + '"></td>' +
      '<td><label class="marca-linha" style="font-weight:400"><input type="checkbox" class="ip-pago"' + (p.pago_em ? " checked" : "") + '> ' + (p.pago_em ? esc(A.dataSimples(p.pago_em)) : "") + "</label></td>" +
      '<td class="peq">' + (p.lembrete_enviado ? "🔔 " + esc(A.dataSimples(p.lembrete_enviado)) : "") + '</td><td><button class="peq ip-del" title="Apagar esta parcela">✕</button></td></tr>';
  }

  function ligarLinha(tr) {
    var id = tr.dataset.pid, st = null;
    function salvar() {
      var venc = $(".ip-venc", tr).value, val = lerValor($(".ip-val", tr).value);
      if (!venc || val === null || val < 0) { A.avisar("Confira a data e o valor da parcela.", "erro"); return; }
      gravarParcela(id, { vencimento: venc, valor: val }).then(function () { A.avisar("✓ Salvo", "ok"); refrescar(); }).catch(P.falhou);
    }
    $(".ip-venc", tr).onchange = salvar; $(".ip-val", tr).onchange = salvar;
    $(".ip-pago", tr).onchange = function () { alternarPago(id, this.checked); };
    $(".ip-del", tr).onclick = function () {
      var p = P.porId(P.S.impParcelas, id); if (!p || !A.confirmar("Apagar a parcela " + p.numero + " (" + A.dataSimples(p.vencimento) + ", " + dinheiro(p.valor) + ")?")) return;
      P.q(P.sb.from("impostos_parcelas").delete().eq("id", id)).then(function () { P.tirar(P.S.impParcelas, id); refrescar(); }).catch(P.falhou);
    };
  }
  function refrescar() { if (raiz) ver(raiz, P); }

  function alternarPago(id, pago) {
    var p = P.porId(P.S.impParcelas, id); if (!p) return;
    gravarParcela(id, pago ? { pago_em: hoje(), valor_pago: Number(p.valor) } : { pago_em: null, valor_pago: null })
      .then(function () { A.avisar(pago ? "✅ Parcela " + p.numero + " marcada como paga" : "Parcela " + p.numero + " voltou para em aberto", "ok"); refrescar(); }).catch(P.falhou);
  }

  function maisParcela(did) {
    var ps = parcelasDe(did), ult = ps[ps.length - 1], d = P.porId(P.S.impDividas, did);
    var venc = ult ? maisMeses(ult.vencimento, 1, "mesmo") : hoje();
    P.q(P.sb.from("impostos_parcelas").insert({ parcelamento_id: did, numero: ult ? ult.numero + 1 : 1, vencimento: venc, valor: ult ? Number(ult.valor) : 0 }).select().single())
      .then(function (n) { P.S.impParcelas.push(n); abertos[did] = true; refrescar(); A.avisar("Parcela " + n.numero + " acrescentada: ajuste a data e o valor.", "ok"); }).catch(P.falhou);
  }

  function apagar(d) {
    if (!d) return;
    var ps = parcelasDe(d.id), pagas = ps.filter(function (x) { return x.pago_em; }).length;
    if (!A.confirmar("Apagar “" + d.nome + "” e as " + ps.length + " parcelas dela (" + pagas + " já marcadas como pagas)?\n\nIsso não tem volta. Se a dívida só acabou, prefira desmarcar “Ativa” em ✏️ Editar.")) return;
    P.q(P.sb.from("impostos_parcelamentos").delete().eq("id", d.id)).then(function () {
      P.tirar(P.S.impDividas, d.id); P.S.impParcelas = P.S.impParcelas.filter(function (x) { return x.parcelamento_id !== d.id; }); A.avisar("Dívida apagada", "ok"); refrescar();
    }).catch(P.falhou);
  }

  // ---------- nova / editar dívida ----------
  function editar(d) {
    var novo = !d;
    var j = A.janela('<label for="id-nome">Nome da dívida *</label><input id="id-nome" maxlength="200" placeholder="Ex.: Parcelamento do Simples Nacional">' +
      '<div class="duas"><div><label for="id-orgao">Órgão</label><input id="id-orgao" maxlength="120" placeholder="Receita, PGFN, Prefeitura..."></div><div><label for="id-num">Número do parcelamento</label><input id="id-num" maxlength="80"></div></div>' +
      '<div class="duas"><div><label for="id-tipo">Tipo</label><select id="id-tipo"><option value="parcelamento">Parcelamento</option><option value="avulsa">Dívida avulsa (uma guia só)</option></select></div>' +
      '<div><label for="id-total">Valor da dívida (R$)</label><input id="id-total" inputmode="decimal" placeholder="Total consolidado"></div></div>' +
      '<div class="duas"><div><label for="id-pri">Principal (R$)</label><input id="id-pri" inputmode="decimal"></div><div><label for="id-mul">Multa (R$)</label><input id="id-mul" inputmode="decimal"></div></div>' +
      '<div class="duas"><div><label for="id-jur">Juros (R$)</label><input id="id-jur" inputmode="decimal"></div><div><label for="id-np" id="id-np-l">Quantidade de parcelas</label><input id="id-np" type="number" min="1" max="200"></div></div>' +
      (novo ? '<div class="cartao" style="margin-top:10px"><b>Gerar as parcelas</b><div class="duas"><div><label for="id-v1">1ª parcela (R$)</label><input id="id-v1" inputmode="decimal"></div><div><label for="id-d1">Vencimento da 1ª</label><input type="date" id="id-d1"></div></div>' +
        '<div class="duas" id="id-dem"><div><label for="id-vd">Demais parcelas (R$)</label><input id="id-vd" inputmode="decimal"></div><div><label for="id-regra">Vencimento das demais</label><select id="id-regra"><option value="ultimo">Último dia útil do mês</option><option value="mesmo">Mesmo dia de cada mês</option></select></div></div>' +
        '<p class="peq mudo" style="margin:4px 0 0">Depois você ajusta qualquer data ou valor na lista de parcelas.</p></div>' : "") +
      '<label for="id-obs">Observações</label><textarea id="id-obs" rows="3" maxlength="3000"></textarea>' +
      (novo ? "" : '<label class="marca-linha" style="font-weight:400"><input type="checkbox" id="id-ativo"> Ativa (desmarque quando a dívida acabar: some da lista e dos avisos)</label>') +
      '<p class="peq" id="id-msg" style="color:var(--critico)"></p><div class="acoes"><button class="prim" id="id-salvar">💾 Salvar</button><button id="id-cancelar">Cancelar</button></div>',
      { titulo: novo ? "Novo parcelamento / dívida" : "Editar: " + d.nome, semRascunho: true }), el = j.el;
    if (P.ligarNome) P.ligarNome($("#id-nome", el));
    if (!novo) {
      $("#id-nome", el).value = d.nome; $("#id-orgao", el).value = d.orgao || ""; $("#id-num", el).value = d.numero || ""; $("#id-tipo", el).value = d.tipo;
      $("#id-total", el).value = campo(d.valor_total); $("#id-pri", el).value = campo(d.principal); $("#id-mul", el).value = campo(d.multa); $("#id-jur", el).value = campo(d.juros);
      $("#id-np", el).value = d.n_parcelas || ""; $("#id-obs", el).value = d.obs || ""; $("#id-ativo", el).checked = d.ativo !== false;
    }
    function tipoMudou() { var av = $("#id-tipo", el).value === "avulsa"; if ($("#id-dem", el)) $("#id-dem", el).style.display = av ? "none" : ""; if (av && novo) $("#id-np", el).value = 1; }
    $("#id-tipo", el).onchange = tipoMudou; tipoMudou();
    $("#id-cancelar", el).onclick = function () { j.fechar(); };
    $("#id-salvar", el).onclick = function () {
      var msg = function (t) { $("#id-msg", el).textContent = t; }, nome = $("#id-nome", el).value.trim();
      if (!nome) return msg("Escreva o nome da dívida.");
      var total = lerValor($("#id-total", el).value), np = parseInt($("#id-np", el).value, 10) || null, tipo = $("#id-tipo", el).value;
      if (tipo === "avulsa") np = 1;
      var dados = { nome: nome, orgao: $("#id-orgao", el).value.trim() || null, numero: $("#id-num", el).value.trim() || null, tipo: tipo, valor_total: total === null ? 0 : total,
        principal: lerValor($("#id-pri", el).value), multa: lerValor($("#id-mul", el).value), juros: lerValor($("#id-jur", el).value), n_parcelas: np, obs: $("#id-obs", el).value.trim() || null };
      var parcelas = [];
      if (novo) {
        var v1 = lerValor($("#id-v1", el).value), d1 = $("#id-d1", el).value, vd = lerValor($("#id-vd", el).value);
        if (v1 !== null || d1) {
          if (v1 === null || !d1) return msg("Para gerar as parcelas, preencha o valor e o vencimento da 1ª.");
          parcelas.push({ numero: 1, vencimento: d1, valor: v1 });
          if (tipo !== "avulsa" && np && np > 1) {
            if (vd === null) return msg("Preencha o valor das demais parcelas.");
            for (var k = 2; k <= np; k++) parcelas.push({ numero: k, vencimento: maisMeses(d1, k - 1, $("#id-regra", el).value), valor: vd });
          }
        }
      } else dados.ativo = $("#id-ativo", el).checked;
      var b = this; A.ocupado(b, true, "Salvando...");
      P.q(novo ? P.sb.from("impostos_parcelamentos").insert(dados).select().single() : P.sb.from("impostos_parcelamentos").update(dados).eq("id", d.id).select().single()).then(function (n) {
        P.trocar(P.S.impDividas, n);
        if (!parcelas.length) return;
        return P.q(P.sb.from("impostos_parcelas").insert(parcelas.map(function (p) { return Object.assign({ parcelamento_id: n.id }, p); })).select()).then(function (ls) { (ls || []).forEach(function (x) { P.S.impParcelas.push(x); }); });
      }).then(function () { A.ocupado(b, false); j.fechar(); A.avisar("Salvo", "ok"); refrescar(); }).catch(function (e) { A.ocupado(b, false); msg("Não salvou: " + A.msgErro(e)); });
    };
  }

  // ---------- aviso no Telegram ----------
  function lembrete() {
    var j = A.janela('<div id="tg-corpo"><span class="carregando"></span> Carregando...</div>', { titulo: "🔔 Lembrete no Telegram", semRascunho: true, larga: true }), el = j.el;
    function desenhar(cfg) {
      $("#tg-corpo", el).innerHTML =
        '<p>Todo dia, às <b>8h da manhã</b>, o GitHub confere o que vence em até <b>' + (cfg ? cfg.dias_antes : 2) + ' dia(s)</b> e manda <b>uma mensagem no seu Telegram</b>. Cada parcela só é avisada uma vez; se você marcar como paga antes, ela não é avisada.</p>' +
        (cfg ? '<label for="tg-dias">Avisar quantos dias antes?</label><input id="tg-dias" type="number" min="0" max="30" value="' + cfg.dias_antes + '" style="width:90px"> <button class="peq" id="tg-salvar-dias">Salvar</button>' +
          '<label for="tg-chave">Chave do lembrete (copie e guarde no GitHub, passo 4)</label><div class="linha"><input id="tg-chave" readonly value="' + esc(cfg.chave) + '" style="flex:1"><button class="peq" id="tg-copiar">📋 Copiar</button></div>'
          : '<div class="aviso">O lembrete ainda não foi ligado. Toque em “Criar a chave” para começar.</div><button class="prim" id="tg-criar">🔑 Criar a chave</button>') +
        '<h3 style="margin-top:14px">Como ligar (uma vez só)</h3><ol class="peq" style="padding-left:20px;line-height:1.6">' +
        "<li><b>Crie o bot:</b> no Telegram, procure <b>@BotFather</b>, mande <b>/newbot</b>, escolha um nome e um usuário que termine em “bot”. Ele entrega o <b>token</b>.</li>" +
        "<li><b>Abra o seu bot</b> no Telegram e toque em <b>Iniciar</b> (/start). Sem isso ele não consegue escrever para você.</li>" +
        "<li><b>Descubra o seu chat id:</b> mande qualquer mensagem para <b>@userinfobot</b>; ele responde com o seu <b>Id</b> (um número).</li>" +
        "<li><b>No GitHub:</b> abra <a href=\"https://github.com/agemanutencaoeletrica-png/age-alfa-painel/settings/secrets/actions\" target=\"_blank\" rel=\"noopener\">Settings › Secrets and variables › Actions</a> e crie 3 segredos (New repository secret): <b>TELEGRAM_BOT_TOKEN</b> (o token), <b>TELEGRAM_CHAT_ID</b> (o Id) e <b>LEMBRETE_CHAVE</b> (a chave acima).</li>" +
        "<li><b>Teste:</b> no GitHub, aba <b>Actions › Lembrete de impostos (Telegram) › Run workflow</b>. Se houver parcela vencendo, a mensagem chega na hora.</li></ol>" +
        '<p class="peq mudo">O token e a chave são senhas: digite só no GitHub e <b>não mande para ninguém</b> (nem para mim). Se vazar, gere outro no @BotFather (/revoke) ou crie outra chave.</p>' +
        '<div class="acoes"><button id="tg-fechar">Fechar</button></div>';
      $("#tg-fechar", el).onclick = function () { j.fechar(); };
      if ($("#tg-criar", el)) $("#tg-criar", el).onclick = function () {
        var b = new Uint8Array(32); crypto.getRandomValues(b);
        var chave = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        P.q(P.sb.from("lembrete_config").insert({ id: true, chave: chave, dias_antes: 2 }).select()).then(function (r) { desenhar((r || [])[0] || { chave: chave, dias_antes: 2 }); }).catch(erro);
      };
      if ($("#tg-copiar", el)) $("#tg-copiar", el).onclick = function () {
        var v = $("#tg-chave", el).value;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { A.avisar("Chave copiada", "ok"); }, function () { $("#tg-chave", el).select(); });
        else { $("#tg-chave", el).select(); document.execCommand("copy"); A.avisar("Chave copiada", "ok"); }
      };
      if ($("#tg-salvar-dias", el)) $("#tg-salvar-dias", el).onclick = function () {
        var n = parseInt($("#tg-dias", el).value, 10); if (!(n >= 0 && n <= 30)) { A.avisar("Use de 0 a 30 dias.", "erro"); return; }
        P.q(P.sb.from("lembrete_config").update({ dias_antes: n }).eq("id", true).select()).then(function (r) { A.avisar("Salvo: avisar " + n + " dia(s) antes", "ok"); desenhar((r || [])[0] || Object.assign({}, cfg, { dias_antes: n })); }).catch(erro);
      };
    }
    function erro(e) { $("#tg-corpo", el).innerHTML = '<div class="aviso erro">' + esc(/lembrete_config|relation|does not exist|schema cache/i.test(A.msgErro(e)) ? "Rode o supabase.sql atualizado no Supabase (tabela lembrete_config)." : A.msgErro(e)) + "</div>"; }
    P.q(P.sb.from("lembrete_config").select("*")).then(function (r) { desenhar((r || [])[0] || null); }).catch(erro);
  }

  window.AGE_IMP = { ver: ver, _resumo: resumo };
})();
