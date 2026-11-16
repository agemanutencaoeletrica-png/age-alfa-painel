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
  function placaDe(d) { var v = d.veiculo_id ? P.porId(P.S.veic || [], d.veiculo_id) : null; return v ? v.placa : "veículo"; }
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
    c.innerHTML = '<div class="cab-secao"><h2>🧾 Impostos e dívidas</h2><span><button class="prim" id="im-novo">+ Parcelamento / dívida</button> <button class="prim" id="im-esc" title="Tira a foto ou escolhe os arquivos: o app separa o que é guia e o que é comprovante e lê tudo">📷 Escanear</button> <button id="im-guia" title="Lê a guia (DAS, DARF ou boleto de imposto) em PDF ou foto e cadastra a parcela ou a dívida">📄 Ler guia</button> <button id="im-comp" title="Dá baixa nas parcelas lendo o comprovante (foto, print ou PDF)">📎 Ler comprovantes</button> <button id="im-veic">🚗 + Imposto de veículo</button> <button id="im-tg" title="Aviso no Telegram dois dias antes de vencer">🔔 Lembrete no Telegram</button></span></div>' +
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
    var firma = rs.filter(function (x) { return x.d.tipo !== "veiculo"; }), veics = rs.filter(function (x) { return x.d.tipo === "veiculo"; });
    l.innerHTML = (firma.length ? firma.map(function (x) { return cartao(x.d, x.r); }).join("") : '<div class="cartao mudo">Nenhum parcelamento ou dívida da firma cadastrado. Toque em “+ Parcelamento / dívida”.</div>') +
      '<h3 style="margin:14px 0 8px">🚗 Veículos</h3>' + (veics.length ? veics.map(function (x) { return cartao(x.d, x.r); }).join("") : '<div class="cartao mudo">Nenhum imposto de veículo. Toque em “🚗 + Imposto de veículo” (IPVA, licenciamento, seguro obrigatório, multas).</div>');
    $("#im-veic", c).onclick = function () { editarVeiculo(); };
    $("#im-comp", c).onclick = function () { lerComprovantes(); };
    $("#im-guia", c).onclick = function () { lerGuias(); };
    $("#im-esc", c).onclick = escanear;
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
      "<div><b>" + esc(d.nome) + "</b> " + (d.tipo === "veiculo" ? '<span class="selo">🚗 ' + esc(placaDe(d)) + (d.categoria ? " · " + esc(d.categoria) : "") + "</span>" : d.tipo === "avulsa" ? '<span class="selo">dívida avulsa</span>' : '<span class="selo">parcelamento</span>') + "</div>" +
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
      '<div class="tabela-caixa"><table style="width:100%;margin-top:6px"><thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Guia nº</th><th>Paga</th><th>Aviso</th><th></th></tr></thead><tbody>' + r.ps.map(linha).join("") + "</tbody></table></div>" +
      '<div style="margin-top:6px"><button class="peq" data-mais="' + esc(d.id) + '">+ Parcela</button> <span class="mudo">Mude a data ou o valor direto na linha: salva sozinho.</span></div></details></div>';
  }

  function linha(p) {
    var atras = !p.pago_em && dias(p.vencimento) < 0;
    return '<tr data-pid="' + esc(p.id) + '"' + (atras ? ' style="background:var(--critico-f)"' : "") + "><td>" + p.numero + '</td><td><input type="date" class="ip-venc" value="' + esc(p.vencimento) + '"></td>' +
      '<td><input class="ip-val" inputmode="decimal" style="width:96px" value="' + campo(p.valor) + '"></td>' +
      '<td><input class="ip-doc" style="width:150px" maxlength="60" placeholder="DAS / guia" title="Número da guia: ajuda a casar o comprovante com a parcela" value="' + esc(p.documento || "") + '"></td>' +
      '<td><label class="marca-linha" style="font-weight:400"><input type="checkbox" class="ip-pago"' + (p.pago_em ? " checked" : "") + '> ' + (p.pago_em ? esc(A.dataSimples(p.pago_em)) + (p.forma ? " · " + esc(p.forma) : "") + (p.valor_pago !== null && p.valor_pago !== undefined && Math.abs(Number(p.valor_pago) - Number(p.valor)) >= 0.005 ? " · pagou " + dinheiro(p.valor_pago) : "") : "") + "</label>" + (p.pago_em ? ' <button class="peq ip-edpag" title="Editar o pagamento">✏️</button>' : "") + "</td>" +
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
    $(".ip-doc", tr).onchange = function () {
      gravarParcela(id, { documento: this.value.trim() || null }).then(function () { A.avisar("✓ Guia salva", "ok"); })
        .catch(function (e) { A.avisar(/documento|column|schema cache/i.test(A.msgErro(e)) ? "Rode de novo o impostos.sql no Supabase (novo: leitura de comprovantes)." : A.msgErro(e), "erro"); });
    };
    $(".ip-pago", tr).onchange = function () { alternarPago(id, this.checked); };
    if ($(".ip-edpag", tr)) $(".ip-edpag", tr).onclick = function () { lancarPagamento(P.porId(P.S.impParcelas, id)); };
    $(".ip-del", tr).onclick = function () {
      var p = P.porId(P.S.impParcelas, id); if (!p || !A.confirmar("Apagar a parcela " + p.numero + " (" + A.dataSimples(p.vencimento) + ", " + dinheiro(p.valor) + ")?")) return;
      P.q(P.sb.from("impostos_parcelas").delete().eq("id", id)).then(function () { P.tirar(P.S.impParcelas, id); refrescar(); }).catch(P.falhou);
    };
  }
  function refrescar() { if (raiz) ver(raiz, P); }

  // marcar como paga abre o lançamento do pagamento: data, valor realmente pago e forma
  var FORMAS = ["Pix", "Boleto", "Débito automático", "Cartão", "Dinheiro", "Outra"];
  function alternarPago(id, pago) {
    var p = P.porId(P.S.impParcelas, id); if (!p) return;
    if (pago) { lancarPagamento(p); return; }
    if (!A.confirmar("Voltar a parcela " + p.numero + " para “em aberto”? O pagamento lançado (" + (p.pago_em ? A.dataSimples(p.pago_em) : "") + ") será apagado.")) { refrescar(); return; }
    gravarParcela(id, { pago_em: null, valor_pago: null, forma: null })
      .then(function () { A.avisar("Parcela " + p.numero + " voltou para em aberto", "ok"); refrescar(); }).catch(P.falhou);
  }
  function lancarPagamento(p) {
    var d = P.porId(P.S.impDividas, p.parcelamento_id), editando = !!p.pago_em;
    var j = A.janela('<p class="peq mudo" style="margin:0 0 8px">' + esc(d ? d.nome : "") + " · parcela " + p.numero + " · vencimento " + esc(A.dataSimples(p.vencimento)) + " · valor " + dinheiro(p.valor) + "</p>" +
      '<div class="duas"><div><label for="lp-data">Data do pagamento *</label><input type="date" id="lp-data"></div><div><label for="lp-valor">Valor pago (R$) *</label><input id="lp-valor" inputmode="decimal"></div></div>' +
      '<label for="lp-forma">Forma de pagamento</label><select id="lp-forma"><option value="">—</option>' + FORMAS.map(function (f) { return "<option>" + esc(f) + "</option>"; }).join("") + "</select>" +
      '<label for="lp-obs">Observação (opcional)</label><input id="lp-obs" maxlength="200" placeholder="Ex.: comprovante no e-mail, pago no app do banco">' +
      '<p class="peq" id="lp-msg" style="color:var(--critico)"></p><div class="acoes"><button class="prim" id="lp-ok">✅ Lançar pagamento</button><button id="lp-cancelar">Cancelar</button></div>',
      { titulo: editando ? "Editar pagamento" : "Lançar pagamento", semRascunho: true, aoFechar: function () { refrescar(); } }), el = j.el;
    $("#lp-data", el).value = p.pago_em || hoje(); $("#lp-valor", el).value = campo(p.valor_pago !== null && p.valor_pago !== undefined ? p.valor_pago : p.valor); $("#lp-forma", el).value = p.forma || "";
    $("#lp-cancelar", el).onclick = function () { j.fechar(); };
    $("#lp-ok", el).onclick = function () {
      var data = $("#lp-data", el).value, val = lerValor($("#lp-valor", el).value), msg = $("#lp-msg", el);
      if (!data) { msg.textContent = "Informe a data do pagamento."; return; }
      if (val === null || !(val > 0)) { msg.textContent = "Informe o valor pago."; return; }
      var nova = ($("#lp-obs", el).value || "").trim(), dados = { pago_em: data, valor_pago: val, forma: $("#lp-forma", el).value || null };
      if (nova) dados.obs = ((p.obs ? p.obs + " · " : "") + nova).slice(0, 500);
      var b = this; A.ocupado(b, true, "Salvando...");
      gravarParcela(p.id, dados).then(function () { A.ocupado(b, false); j.fechar(); A.avisar("✅ Pagamento da parcela " + p.numero + " lançado", "ok"); })
        .catch(function (e) { A.ocupado(b, false); msg.textContent = "Não salvou: " + (/forma|column|schema cache/i.test(A.msgErro(e)) ? "rode de novo o impostos.sql no Supabase. " : "") + A.msgErro(e); });
    };
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
      '<div class="duas"><div><label for="id-tipo">Tipo</label><select id="id-tipo"><option value="parcelamento">Parcelamento</option><option value="avulsa">Dívida avulsa (uma guia só)</option>' + (d && d.tipo === "veiculo" ? '<option value="veiculo">Imposto de veículo</option>' : "") + '</select></div>' +
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

  // ---------- 📎 ler comprovantes e dar baixa ----------
  function reaisDe(s) { return A.lerNumero(String(s).replace(/\s/g, "")); }
  var RE_REAL = /R[$S5]\s*(\d{1,3}(?:\.\d{3})*,\d{2})/;
  function aposRotulo(t, rot, alcance) { var m = new RegExp(rot, "i").exec(t); if (!m) return null; var r = RE_REAL.exec(t.slice(m.index + m[0].length, m.index + m[0].length + (alcance || 60))); return r ? reaisDe(r[1]) : null; }
  // lê o que importa de um comprovante (texto do PDF ou da foto): valor, data, hora, nº do documento e autenticação
  function lerComprovante(texto) {
    var t = String(texto || "").replace(/\r/g, ""), r = { valor: null, data: null, hora: null, identificador: null, autenticacao: null, boleto: /boleto|c[oó]digo de barras/i.test(t), beneficiario: "" };
    r.valor = aposRotulo(t, "valor\\s+total\\s+do\\s+pagamento") || aposRotulo(t, "pagamento\\s+realizado") || aposRotulo(t, "comprovante\\s+(?:de\\s+)?pagamento");
    if (r.valor === null) { var m = RE_REAL.exec(t); if (m) r.valor = reaisDe(m[1]); }
    var d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t); if (d && Number(d[2]) >= 1 && Number(d[2]) <= 12) r.data = d[3] + "-" + d[2] + "-" + d[1];
    var h = /(\d{2}:\d{2})(?::\d{2})?/.exec(t); if (h) r.hora = h[1];
    var id = /identificador\s*[:\-]?\s*([0-9][0-9\s\/.\-]{19,70})/i.exec(t); if (id) r.identificador = id[1].replace(/\D/g, "");
    if (!r.identificador) { var lg = /\b\d{25,48}\b/.exec(t); if (lg) r.identificador = lg[0]; }
    var au = /autentica[cç][aã]o\s*[:\-]?\s*((?:[0-9A-F]{4}-){2,}[0-9A-F]{4})/i.exec(t); if (au) r.autenticacao = au[1].toUpperCase();
    var bn = /quem\s+vai\s+receber[\s\S]{0,30}?nome\s*:?\s*([^\n]+)/i.exec(t); if (bn) r.beneficiario = bn[1].trim();
    return r;
  }
  // acha a parcela em aberto do comprovante: 1º pelo nº da guia, depois pelo valor (e a data mais próxima do vencimento)
  function acharParcela(c, abertas, usadas) {
    var livres = abertas.filter(function (x) { return !usadas[x.p.id]; });
    if (c.identificador) {
      var porDoc = livres.filter(function (x) { var dg = String(x.p.documento || "").replace(/\D/g, ""); return dg.length >= 12 && (c.identificador.indexOf(dg) === 0 || c.identificador.indexOf(dg.slice(0, 12)) === 0); });
      if (porDoc.length === 1) return { x: porDoc[0], como: "pelo nº da guia" };
    }
    var porValor = livres.filter(function (x) { return c.valor !== null && Math.abs(Number(x.p.valor) - c.valor) < 0.005; });
    if (porValor.length === 1) return { x: porValor[0], como: "pelo valor" };
    if (porValor.length > 1 && c.data) {
      porValor.sort(function (a, b) { return Math.abs(new Date(a.p.vencimento) - new Date(c.data)) - Math.abs(new Date(b.p.vencimento) - new Date(c.data)); });
      return { x: porValor[0], como: "pelo valor e pela data", varias: true };
    }
    return null;
  }
  var cacheTxt = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function temValor(tx) { return /(\d{1,3}(?:\.\d{3})*,\d{2})/.test(String(tx || "").replace(/(\d)\s*,\s*(\d{2})\b/g, "$1,$2")); }
  function lerMelhor(f) {
    return window.AGE_PAG.lerArquivo(f).then(function (r) {
      if (!/^image\//.test(f.type || "") || temValor(r.texto)) return r;
      // sem nenhum valor: refaz em outros modos de leitura (página inteira, colunas, cinza) e fica com o primeiro que achar
      var modos = [{ psm: "4" }, { psm: "3" }, { psm: "11" }, { cinza: true, psm: "4" }];
      return modos.reduce(function (pr, op) {
        return pr.then(function (melhor) {
          if (temValor(melhor.texto)) return melhor;
          return window.AGE_PAG.lerArquivo(f, Object.assign({ giro: r.giro }, op)).then(function (r2) { return temValor(r2.texto) ? r2 : melhor; }, function () { return melhor; });
        });
      }, Promise.resolve(r));
    });
  }
  function textoDe(f) { if (!cacheTxt) return lerMelhor(f); if (!cacheTxt.has(f)) cacheTxt.set(f, lerMelhor(f)); return cacheTxt.get(f); }
  function hashArquivo(f) {
    if (!(window.crypto && crypto.subtle && f && f.arrayBuffer)) return Promise.resolve(null);
    return f.arrayBuffer().then(function (b) { return crypto.subtle.digest("SHA-256", b); }).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }).catch(function () { return null; });
  }
  function jaLido(c, hash) {
    var L = P.S.impComprov || [];
    return L.filter(function (x) { return (hash && x.arquivo_hash === hash) || (c && c.autenticacao && x.autenticacao === c.autenticacao) || (c && c.identificador && x.identificador === c.identificador); })[0] || null;
  }
  // ---------- núcleo: analisar e lançar (usado pelas janelas manuais e pelo modo automático) ----------
  function abertasAgora() { var l = []; dividas().filter(function (d) { return d.ativo !== false; }).forEach(function (d) { parcelasDe(d.id).filter(function (p) { return !p.pago_em; }).forEach(function (p) { l.push({ d: d, p: p }); }); }); return l; }
  function novoLote() { return { vistos: {}, usadas: {}, hashes: {} }; }
  function diasEntre(a, b) { return Math.abs(Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 864e5)); }
  function proximoNumero(did) { var ps = parcelasDe(did); return ps.length ? ps[ps.length - 1].numero + 1 : 1; }
  function nomeNova(g) { return g.tipo === "DARF" ? "DARF" + (g.codigo ? " código " + g.codigo : "") : g.parcela ? "Parcelamento (DAS" + (g.parcelamento ? " nº " + g.parcelamento : "") + ")" : "DAS do Simples Nacional"; }
  function parcelaExistente(e) { return e.dividaId && e.numero ? parcelasDe(e.dividaId).filter(function (p) { return p.numero === e.numero && !p.pago_em; })[0] || null : null; }

  function analisarComprovante(f, lote) {
    var e = { tipo: "comprovante", arquivo: f, nome: f.name || "comprovante" };
    return hashArquivo(f).then(function (h) {
      e.hash = h;
      var rep = h && jaLido(null, h);
      if (rep || (h && lote.vistos[h])) { e.repetido = "este arquivo já foi usado" + (rep && rep.pago_em ? " (pago em " + A.dataSimples(rep.pago_em) + ")" : "") + "."; return e; }
      if (h) lote.vistos[h] = true;
      return textoDe(f).then(function (r) {
        e.c = lerComprovante(r.texto);
        var rep2 = jaLido(e.c, null) || (e.c.autenticacao && lote.vistos["a" + e.c.autenticacao] && { pago_em: null }) || (e.c.identificador && lote.vistos["i" + e.c.identificador] && { pago_em: null });
        if (rep2) { e.repetido = "a mesma autenticação/documento já foi lançado" + (rep2.pago_em ? " (pago em " + A.dataSimples(rep2.pago_em) + ")" : "") + "."; return e; }
        if (e.c.autenticacao) lote.vistos["a" + e.c.autenticacao] = true; if (e.c.identificador) lote.vistos["i" + e.c.identificador] = true;
        if (e.c.valor === null) { e.aviso = "Não consegui ler o valor. Escolha a parcela à mão."; }
        else if (!e.c.data) { e.aviso = "Não consegui ler a data: vale a de hoje se você confirmar."; }
        var ach = e.c.valor !== null ? acharParcela(e.c, abertasAgora(), lote.usadas) : null;
        if (ach) { e.parcelaId = ach.x.p.id; e.como = ach.como; lote.usadas[ach.x.p.id] = true; if (ach.varias) e.aviso = "Há parcelas com o mesmo valor: confira se é esta."; }
        else if (e.c.valor !== null) e.aviso = "Não achei parcela em aberto com " + dinheiro(e.c.valor) + ". Escolha à mão ou deixe sem baixa.";
        // seguro para lançar sozinho: valor e data lidos, uma só parcela possível e (nº da guia igual OU valor exato com a data perto do vencimento)
        var par = e.parcelaId ? P.porId(P.S.impParcelas, e.parcelaId) : null;
        e.seguro = !!(par && !e.aviso && e.c.valor !== null && e.c.data && (e.como === "pelo nº da guia" || (e.como === "pelo valor" && diasEntre(e.c.data, par.vencimento) <= 40)));
        return e;
      }, function (er) { e.erro = A.msgErro(er); return e; });
    });
  }
  function aplicarComprovante(e) {
    var p = P.porId(P.S.impParcelas, e.parcelaId), c = e.c || {}, data = c.data || hoje(), val = c.valor !== null && c.valor !== undefined ? c.valor : Number(p.valor);
    var antes = { pago_em: p.pago_em || null, valor_pago: p.valor_pago === undefined ? null : p.valor_pago, forma: p.forma || null };
    return P.q(P.sb.from("impostos_comprovantes").insert({ parcela_id: p.id, arquivo_hash: e.hash || null, identificador: c.identificador || null, autenticacao: c.autenticacao || null, valor: val, pago_em: data, hora: c.hora || null }).select().single())
      .then(function (n) { P.S.impComprov.push(n); e.undo = { comprovId: n.id, parcelaId: p.id, antes: antes }; return gravarParcela(p.id, { pago_em: data, valor_pago: val, forma: c.boleto ? "Boleto" : p.forma || null }); })
      .then(function () { e.salvo = true; e.resultado = "baixa na parcela " + p.numero + " de “" + (P.porId(P.S.impDividas, p.parcelamento_id) || {}).nome + "” (" + dinheiro(val) + ", pago em " + A.dataSimples(data) + ")."; return e; })
      .catch(function (er) { e.erro = /duplicate|unique|23505/i.test(A.msgErro(er) + " " + (er && er.code)) ? "Comprovante repetido (já lançado antes)." : A.msgErro(er); return e; });
  }

  function analisarGuia(f, lote) {
    var e = { tipo: "guia", arquivo: f, nome: f.name || "guia" };
    return hashArquivo(f).then(function (h) {
      if (h && lote.hashes[h]) { e.repetida = "este arquivo já está na lista."; return e; } if (h) lote.hashes[h] = true;
      return textoDe(f).then(function (r) {
        var g = lerGuia(r.texto); e.g = g;
        if (!g.documento && g.valor === null) { e.erro = "Não consegui ler esta guia (sem nº de documento nem valor). Tente o PDF original."; return e; }
        var rep = g.documento ? (P.S.impParcelas || []).filter(function (p) { return soDig(p.documento) === soDig(g.documento); })[0] : null;
        var ach = dividaDaGuia(g); if (ach) { e.dividaId = ach.d.id; e.como = ach.como; }
        if (rep && rep.id) { e.dividaId = rep.parcelamento_id; e.numero = rep.numero; e.como = "pela guia já cadastrada"; }
        else e.numero = g.parcela || (e.dividaId ? null : 1);
        if (e.dividaId && !e.numero) {
          var igual = parcelasDe(e.dividaId).filter(function (p) { return !p.pago_em && g.valor !== null && Math.abs(Number(p.valor) - g.valor) < 0.005 && (!g.vencimento || p.vencimento === g.vencimento); })[0];
          e.numero = igual ? igual.numero : proximoNumero(e.dividaId);
        }
        e.existente = parcelaExistente(e);
        if (rep && rep.pago_em) e.repetida = "a guia " + g.documento + " já foi cadastrada e está paga (parcela " + rep.numero + ").";
        // seguro para cadastrar sozinho: valor, vencimento e nº da parcela lidos, e a dívida achada (ou guia nova com tipo e nº de documento claros)
        e.seguro = !!(!e.repetida && g.valor > 0 && g.vencimento && e.numero && (e.dividaId || (g.tipo && g.documento)));
        return e;
      }, function (er) { e.erro = A.msgErro(er); return e; });
    });
  }
  function aplicarGuia(e) {
    var g = e.g, num = e.numero;
    function daParcela(did, criouDivida) {
      var atual = parcelasDe(did).filter(function (p) { return p.numero === num; })[0];
      var dados = { vencimento: g.vencimento, valor: g.valor, documento: g.documento || null };
      if (atual) {
        if (atual.pago_em) throw new Error("A parcela " + num + " já está paga. Escolha outro nº.");
        e.undo = { dividaId: did, criouDivida: !!criouDivida, parcelaId: atual.id, criouParcela: false, antes: { vencimento: atual.vencimento, valor: atual.valor, documento: atual.documento || null } };
        return gravarParcela(atual.id, dados).then(function () { e.resultado = "parcela " + num + " atualizada (" + dinheiro(g.valor) + ", vence " + A.dataSimples(g.vencimento) + ")."; });
      }
      return P.q(P.sb.from("impostos_parcelas").insert(Object.assign({ parcelamento_id: did, numero: num }, dados)).select().single()).then(function (n) {
        P.S.impParcelas.push(n); e.undo = { dividaId: did, criouDivida: !!criouDivida, parcelaId: n.id, criouParcela: true };
        e.resultado = "parcela " + num + " criada (" + dinheiro(g.valor) + ", vence " + A.dataSimples(g.vencimento) + ").";
      });
    }
    return Promise.resolve().then(function () {
      if (e.dividaId) return daParcela(e.dividaId, false);
      var nova = { nome: nomeNova(g), orgao: g.sispar ? "PGFN" : "Receita Federal", numero: g.sispar ? "PGFN-SISPAR " + g.sispar : g.parcelamento ? "DAS nº " + g.parcelamento : g.darfRef || null, tipo: g.parcelas || g.parcelamento || g.sispar ? "parcelamento" : "avulsa", valor_total: g.parcelas ? 0 : g.valor, n_parcelas: g.parcelas || (g.parcelamento || g.sispar ? null : 1) };
      return P.q(P.sb.from("impostos_parcelamentos").insert(nova).select().single()).then(function (n) { P.trocar(P.S.impDividas, n); e.dividaId = n.id; return daParcela(n.id, true).then(function () { e.resultado = "nova dívida “" + n.nome + "”, " + e.resultado; }); });
    }).then(function () { e.salvo = true; return e; })
      .catch(function (er) { e.erro = A.msgErro(er) + (/documento|column|schema cache/i.test(A.msgErro(er)) ? " — rode de novo o impostos.sql no Supabase." : ""); return e; });
  }
  // desfaz um lançamento automático: volta a parcela como estava (ou apaga o que foi criado)
  function desfazer(e) {
    var u = e.undo; if (!u) return Promise.resolve(e);
    var ps;
    if (e.tipo === "comprovante") {
      ps = P.q(P.sb.from("impostos_comprovantes").delete().eq("id", u.comprovId)).then(function () { P.S.impComprov = P.S.impComprov.filter(function (x) { return x.id !== u.comprovId; }); return gravarParcela(u.parcelaId, u.antes); });
    } else if (u.criouParcela) {
      ps = P.q(P.sb.from("impostos_parcelas").delete().eq("id", u.parcelaId)).then(function () { P.tirar(P.S.impParcelas, u.parcelaId);
        if (u.criouDivida && !parcelasDe(u.dividaId).length) return P.q(P.sb.from("impostos_parcelamentos").delete().eq("id", u.dividaId)).then(function () { P.tirar(P.S.impDividas, u.dividaId); }); });
    } else ps = gravarParcela(u.parcelaId, u.antes);
    return ps.then(function () { e.desfeito = true; e.salvo = false; return e; });
  }

  function lerComprovantes(arquivosIni, depois) {
    if (P.S.semComprov || P.S.semImpostos) { A.avisar("Para ler comprovantes, rode de novo o impostos.sql no Supabase (tabela impostos_comprovantes).", "erro"); return; }
    if (!window.AGE_PAG || !window.AGE_PAG.lerArquivo) { A.avisar("O leitor de comprovantes não carregou. Atualize a página.", "erro"); return; }
    var ents = [], lote = novoLote();
    var j = A.janela('<p class="peq mudo" style="margin:0 0 8px">Escolha os comprovantes (print, foto ou PDF). O app lê o valor e a data, acha a parcela e <b>você confere antes de dar baixa</b>. Comprovante repetido é recusado.</p>' +
      '<div class="acoes"><button class="prim" id="lc-esc">📎 Escolher comprovantes</button></div><input type="file" id="lc-arq" accept="image/*,application/pdf" multiple class="oculto">' +
      '<div id="lc-st" class="peq" style="margin:8px 0"></div><div id="lc-lista"></div><p class="peq" id="lc-msg" style="color:var(--critico)"></p>' +
      '<div class="acoes"><button class="prim" id="lc-ok" disabled>✅ Dar baixa nas parcelas marcadas</button><button id="lc-fechar">Fechar</button></div>', { titulo: "📎 Ler comprovantes", larga: true, semRascunho: true, aoFechar: function () { refrescar(); if (depois) depois(); } }), el = j.el;
    function opcoes(sel) { return '<option value="">— não dar baixa —</option>' + abertasAgora().map(function (x) { return '<option value="' + esc(x.p.id) + '"' + (sel === x.p.id ? " selected" : "") + ">" + esc((x.d.nome.length > 36 ? x.d.nome.slice(0, 35) + "…" : x.d.nome) + " · parcela " + x.p.numero + " · " + A.dataSimples(x.p.vencimento) + " · " + dinheiro(x.p.valor)) + "</option>"; }).join(""); }
    function desenhar() {
      $("#lc-lista", el).innerHTML = ents.map(function (e, i) {
        var estado = e.erro ? '<span style="color:var(--critico)">⚠ ' + esc(e.erro) + "</span>" : e.repetido ? '<span style="color:var(--critico)">⛔ Comprovante repetido: ' + esc(e.repetido) + "</span>" : e.salvo ? "✅ Baixa dada" : e.aviso ? '<span style="color:var(--atencao)">⚠ ' + esc(e.aviso) + "</span>" : "";
        return '<div class="cartao"><b>' + esc(e.nome) + "</b><div class=\"peq\">" + (e.c ? "Valor " + (e.c.valor !== null ? dinheiro(e.c.valor) : "?") + " · data " + (e.c.data ? esc(A.dataSimples(e.c.data)) : "?") + (e.c.hora ? " " + esc(e.c.hora) : "") + (e.c.autenticacao ? " · aut. " + esc(e.c.autenticacao) : "") : "") + "</div>" +
          (e.erro || e.repetido || e.salvo ? "" : '<label class="peq">Dar baixa em: <select data-i="' + i + '" class="lc-sel" style="max-width:100%">' + opcoes(e.parcelaId) + "</select></label>") +
          '<div class="peq" style="margin-top:4px">' + estado + (e.como && !e.salvo && !e.repetido && !e.erro ? ' <span class="mudo">(achou ' + esc(e.como) + ")</span>" : "") + "</div></div>";
      }).join("");
      $$(".lc-sel", el).forEach(function (s) { s.onchange = function () { ents[Number(s.dataset.i)].parcelaId = s.value || null; atualizarOk(); }; });
      atualizarOk();
    }
    function atualizarOk() { var n = ents.filter(function (e) { return e.parcelaId && !e.erro && !e.repetido && !e.salvo; }).length; $("#lc-ok", el).disabled = !n; $("#lc-ok", el).textContent = n ? "✅ Dar baixa em " + n + " parcela(s)" : "✅ Dar baixa nas parcelas marcadas"; }
    $("#lc-esc", el).onclick = function () { $("#lc-arq", el).value = ""; $("#lc-arq", el).click(); };
    function iniciar(fs) {
      if (!fs.length) return;
      fs.reduce(function (pr, f, i) { return pr.then(function () { $("#lc-st", el).textContent = "📖 Lendo o comprovante " + (i + 1) + " de " + fs.length + "... (a 1ª vez demora um pouco)"; return analisarComprovante(f, lote).then(function (e) { ents.push(e); }); }); }, Promise.resolve())
        .then(function () { $("#lc-st", el).textContent = "Confira e toque em dar baixa."; desenhar(); });
    }
    $("#lc-arq", el).onchange = function () { iniciar(Array.prototype.slice.call(this.files || []).slice(0, 20)); };
    if (arquivosIni && arquivosIni.length) iniciar(arquivosIni);
    $("#lc-fechar", el).onclick = function () { j.fechar(); };
    $("#lc-ok", el).onclick = function () {
      var b = this, msg = $("#lc-msg", el); msg.textContent = ""; A.ocupado(b, true, "Dando baixa...");
      var alvo = ents.filter(function (e) { return e.parcelaId && !e.erro && !e.repetido && !e.salvo; }), escolhidas = {}, dup = false;
      alvo.forEach(function (e) { if (escolhidas[e.parcelaId]) dup = true; escolhidas[e.parcelaId] = true; });
      if (dup) { A.ocupado(b, false); msg.textContent = "Dois comprovantes estão na mesma parcela. Deixe um deles sem baixa."; return; }
      alvo.reduce(function (pr, e) { return pr.then(function () { return aplicarComprovante(e); }); }, Promise.resolve())
        .then(function () { A.ocupado(b, false); var ok = ents.filter(function (e) { return e.salvo; }).length; $("#lc-st", el).textContent = ok ? "✅ " + ok + " baixa(s) dada(s)." : ""; desenhar(); })
        .catch(function (er) { A.ocupado(b, false); msg.textContent = A.msgErro(er); });
    };
  }

  // ---------- 📄 ler guia (DAS, DARF, DAS de parcelamento, dívida ativa) e cadastrar ----------
  function moedas(t) { var l = [], re = /(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d\/])/g, m; while ((m = re.exec(t))) l.push(reaisDe(m[1])); return l; }
  function maisFrequente(l) { var n = {}, melhor = null; l.forEach(function (v) { n[v] = (n[v] || 0) + 1; }); Object.keys(n).forEach(function (k) { if (melhor === null || n[k] > n[melhor] || (n[k] === n[melhor] && Number(k) > Number(melhor))) melhor = k; }); return melhor === null ? null : Number(melhor); }
  function lerGuia(texto) {
    var t = String(texto || "").replace(/\r/g, ""), g = { tipo: null, documento: null, valor: null, vencimento: null, parcela: null, parcelas: null, parcelamento: null, sispar: null, darfRef: null, codigo: null };
    if (/simples\s+nacional/i.test(t) && /documento\s+de\s+arrecada/i.test(t)) g.tipo = "DAS"; else if (/\bDARF\b/.test(t)) g.tipo = "DARF"; else if (/documento\s+de\s+arrecada/i.test(t)) g.tipo = "DAS";
    var dc = /n[uú]mero\s+do\s+documento\s*:?\s*(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)/i.exec(t) || /\b(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)\b/.exec(t); if (dc) g.documento = dc[1];
    var px = /\bvalor\s*:\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t.replace(/\s+/g, " "));   // bloco "Pague com o PIX": Valor: 1.844,56
    g.valor = px ? reaisDe(px[1]) : maisFrequente(moedas(t));
    var datas = [], rd = /(\d{2})\/(\d{2})\/(\d{4})(?!\s*[-–]?\s*\d{2}:\d{2})/g, m;
    while ((m = rd.exec(t))) { if (Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) { var sufixo = t.slice(rd.lastIndex, rd.lastIndex + 12); if (!/^\s*\d{2}:\d{2}/.test(sufixo)) datas.push(m[3] + "-" + m[2] + "-" + m[1]); } }
    var ap = /pagar\s+(?:este\s+documento\s+)?at[eé]\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(t.replace(/\s+/g, " "));
    g.vencimento = ap ? ap[3] + "-" + ap[2] + "-" + ap[1] : (function () { var n = {}, b = null; datas.forEach(function (d) { n[d] = (n[d] || 0) + 1; }); Object.keys(n).forEach(function (k) { if (b === null || n[k] > n[b]) b = k; }); return b; })();
    var pc = /parcela\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i.exec(t); if (pc) { g.parcela = Number(pc[1]); g.parcelas = Number(pc[2]); }
    var np = /n[uú]mero\s+do\s+parcelamento\s*:?\s*(\d+)/i.exec(t); if (np) g.parcelamento = np[1];
    var sp = /PGFN[\s\-]*SISPAR\s*:?\s*(\d{6,})/i.exec(t); if (sp) g.sispar = sp[1];
    var dr = /\b(\d{23})\b/.exec(t); if (dr) g.darfRef = dr[1];
    var cr = /c[oó]digo\s+da\s+receita[\s\S]{0,40}?\b(\d{4})\b/i.exec(t); if (cr) g.codigo = cr[1];
    return g;
  }
  var soDig = function (s) { return String(s || "").replace(/\D/g, ""); };
  // acha a dívida a que a guia pertence: nº do parcelamento da Receita/DARF, SISPAR da PGFN, PARCSN ou outra parcela que já tenha a mesma guia
  function dividaDaGuia(g) {
    var ds = dividas().filter(function (d) { return d.ativo !== false; });
    var porDoc = g.documento ? (P.S.impParcelas || []).filter(function (p) { return soDig(p.documento) === soDig(g.documento); })[0] : null;
    if (porDoc) return { d: P.porId(P.S.impDividas, porDoc.parcelamento_id), como: "pela guia já cadastrada" };
    if (g.darfRef) { var a = ds.filter(function (d) { return soDig(d.numero) === g.darfRef; })[0]; if (a) return { d: a, como: "pelo nº do parcelamento" }; }
    if (g.sispar) { var b = ds.filter(function (d) { return soDig(d.numero).indexOf(g.sispar) >= 0; })[0]; if (b) return { d: b, como: "pelo nº SISPAR da PGFN" }; }
    if (g.parcelamento && g.tipo === "DAS") { var c = ds.filter(function (d) { return new RegExp("PARCSN\\s*" + g.parcelamento + "\\b", "i").test(d.numero || ""); })[0]; if (c) return { d: c, como: "pelo nº do parcelamento (PARCSN " + g.parcelamento + ")" }; }
    return null;
  }
  function lerGuias(arquivosIni, depois) {
    if (P.S.semImpostos) { A.avisar("Para usar, rode o impostos.sql atualizado no Supabase.", "erro"); return; }
    if (!window.AGE_PAG || !window.AGE_PAG.lerArquivo) { A.avisar("O leitor de arquivos não carregou. Atualize a página.", "erro"); return; }
    var ents = [], lote = novoLote();
    var j = A.janela('<p class="peq mudo" style="margin:0 0 8px">Escolha a guia (DAS, DARF, DAS de parcelamento, dívida ativa) em <b>PDF ou foto</b>. O app lê o número da guia, o valor e o vencimento e <b>cadastra a parcela</b> na dívida certa, ou cria a dívida se for nova. Você confere antes.</p>' +
      '<div class="acoes"><button class="prim" id="lg-esc">📄 Escolher guias</button></div><input type="file" id="lg-arq" accept="application/pdf,image/*" multiple class="oculto">' +
      '<div id="lg-st" class="peq" style="margin:8px 0"></div><div id="lg-lista"></div><p class="peq" id="lg-msg" style="color:var(--critico)"></p>' +
      '<div class="acoes"><button class="prim" id="lg-ok" disabled>💾 Cadastrar</button><button id="lg-fechar">Fechar</button></div>', { titulo: "📄 Ler guia de imposto", larga: true, semRascunho: true, aoFechar: function () { refrescar(); if (depois) depois(); } }), el = j.el;
    function opcoesDiv(sel) { return '<option value="">➕ Criar dívida nova</option>' + dividas().filter(function (d) { return d.ativo !== false; }).map(function (d) { return '<option value="' + esc(d.id) + '"' + (sel === d.id ? " selected" : "") + ">" + esc(d.nome.length > 40 ? d.nome.slice(0, 39) + "…" : d.nome) + "</option>"; }).join(""); }
    function desenhar() {
      $("#lg-lista", el).innerHTML = ents.map(function (e, i) {
        if (e.erro) return '<div class="cartao"><b>' + esc(e.nome) + '</b><div class="peq" style="color:var(--critico)">⚠ ' + esc(e.erro) + "</div></div>";
        if (e.salvo) return '<div class="cartao"><b>' + esc(e.nome) + '</b><div class="peq">✅ Cadastrada: ' + esc(e.resultado) + "</div></div>";
        if (e.repetida) return '<div class="cartao"><b>' + esc(e.nome) + '</b><div class="peq" style="color:var(--critico)">⛔ Guia repetida: ' + esc(e.repetida) + "</div></div>";
        var g = e.g;
        return '<div class="cartao" data-e="' + i + '"><b>' + esc(e.nome) + '</b> <span class="selo">' + esc(g.tipo || "guia") + "</span>" +
          '<div class="peq">' + (g.documento ? "Guia nº " + esc(g.documento) : '<span style="color:var(--atencao)">⚠ não li o nº da guia</span>') + (g.codigo ? " · código da receita " + esc(g.codigo) : "") + (g.sispar ? " · PGFN SISPAR " + esc(g.sispar) : "") + (g.parcelamento ? " · parcelamento nº " + esc(g.parcelamento) : "") + "</div>" +
          '<div class="duas"><div><label>Dívida</label><select class="lg-div">' + opcoesDiv(e.dividaId) + "</select></div><div><label>Nº da parcela</label><input class=\"lg-num\" type=\"number\" min=\"1\" max=\"200\" value=\"" + (e.numero || "") + "\"></div></div>" +
          '<div class="duas"><div><label>Valor (R$)</label><input class="lg-val" inputmode="decimal" value="' + campo(g.valor) + '"></div><div><label>Vencimento</label><input type="date" class="lg-venc" value="' + esc(g.vencimento || "") + '"></div></div>' +
          '<div class="peq mudo">' + (e.como ? "Dívida achada " + esc(e.como) + ". " : "Não achei a dívida: será criada uma nova (ou escolha uma). ") + (e.existente ? "Já existe a parcela " + e.existente.numero + " em aberto nessa dívida: ela será atualizada com esta guia." : "") + "</div></div>";
      }).join("");
      $$("[data-e]", el).forEach(function (cx) {
        var e = ents[Number(cx.dataset.e)];
        $(".lg-div", cx).onchange = function () { e.dividaId = this.value || null; e.como = null; e.numero = e.dividaId ? (e.g.parcela || proximoNumero(e.dividaId)) : (e.g.parcela || 1); achar(e); desenhar(); };
        $(".lg-num", cx).onchange = function () { e.numero = parseInt(this.value, 10) || null; achar(e); desenhar(); };
        $(".lg-val", cx).onchange = function () { e.g.valor = lerValor(this.value); };
        $(".lg-venc", cx).onchange = function () { e.g.vencimento = this.value || null; };
      });
      var n = ents.filter(function (e) { return !e.erro && !e.salvo && !e.repetida; }).length; $("#lg-ok", el).disabled = !n; $("#lg-ok", el).textContent = n ? "💾 Cadastrar " + n + " guia(s)" : "💾 Cadastrar";
    }
    function achar(e) { e.existente = parcelaExistente(e); }
    $("#lg-esc", el).onclick = function () { $("#lg-arq", el).value = ""; $("#lg-arq", el).click(); };
    function iniciar(fs) {
      if (!fs.length) return;
      fs.reduce(function (pr, f, i) { return pr.then(function () { $("#lg-st", el).textContent = "📖 Lendo a guia " + (i + 1) + " de " + fs.length + "..."; return analisarGuia(f, lote).then(function (e) { ents.push(e); }); }); }, Promise.resolve())
        .then(function () { $("#lg-st", el).textContent = "Confira e toque em Cadastrar."; desenhar(); });
    }
    $("#lg-arq", el).onchange = function () { iniciar(Array.prototype.slice.call(this.files || []).slice(0, 20)); };
    if (arquivosIni && arquivosIni.length) iniciar(arquivosIni);
    $("#lg-fechar", el).onclick = function () { j.fechar(); };
    $("#lg-ok", el).onclick = function () {
      var b = this, msg = $("#lg-msg", el); msg.textContent = "";
      var alvo = ents.filter(function (e) { return !e.erro && !e.salvo && !e.repetida; });
      for (var k = 0; k < alvo.length; k++) {
        var g = alvo[k].g; if (!(g.valor > 0) || !g.vencimento) { msg.textContent = "Preencha o valor e o vencimento de “" + alvo[k].nome + "”."; return; }
        if (!alvo[k].numero) { msg.textContent = "Informe o nº da parcela de “" + alvo[k].nome + "”."; return; }
      }
      A.ocupado(b, true, "Cadastrando...");
      alvo.reduce(function (pr, e) { return pr.then(function () { return aplicarGuia(e); }); }, Promise.resolve())
        .then(function () { A.ocupado(b, false); var ok = ents.filter(function (e) { return e.salvo; }).length; $("#lg-st", el).textContent = ok ? "✅ " + ok + " guia(s) cadastrada(s)." : ""; desenhar(); });
    };
  }

  // ---------- 📷 escanear: foto ou arquivos de guias e comprovantes, o app separa e lê ----------
  // guia (DAS/DARF) tem o cabeçalho "Documento de Arrecadação"; comprovante diz "comprovante" ou "pagamento realizado". A guia traz um campo
  // "autenticação bancária" em branco: por isso o cabeçalho da guia vale primeiro.
  function tipoDoc(texto) {
    var t = String(texto || "");
    if (/comprovante/i.test(t) || /pagamento\s+(?:realizado|efetuado|conclu[ií]do)/i.test(t) || /pago\s+com\s+sucesso/i.test(t)) return "comprovante";
    if (/documento\s+de\s+arrecada/i.test(t) || /\bDARF\b/.test(t)) return "guia";
    if (/identificador|autentica[cç][aã]o|valor\s+total\s+do\s+pagamento/i.test(t) && /R\$\s*\d/.test(t)) return "comprovante";
    return null;
  }
  function tipoDoc(texto) {
    var t = String(texto || "");
    if (/comprovante/i.test(t) || /pagamento\s+(?:realizado|efetuado|conclu[ií]do)/i.test(t) || /pago\s+com\s+sucesso/i.test(t)) return "comprovante";
    if (/documento\s+de\s+arrecada/i.test(t) || /\bDARF\b/.test(t)) return "guia";
    if (/identificador|autentica[cç][aã]o|valor\s+total\s+do\s+pagamento/i.test(t) && /R\$\s*\d/.test(t)) return "comprovante";
    return null;
  }
  function escanear() {
    if (P.S.semImpostos) { A.avisar("Para usar, rode o impostos.sql atualizado no Supabase.", "erro"); return; }
    if (!window.AGE_PAG || !window.AGE_PAG.lerArquivo) { A.avisar("O leitor de arquivos não carregou. Atualize a página.", "erro"); return; }
    var auto = true; try { auto = localStorage.getItem("age_imp_auto") !== "0"; } catch (e0) { /* sem armazenamento */ }
    var j = A.janela('<p class="peq mudo" style="margin:0 0 8px">Tire a <b>foto</b> do documento ou escolha os <b>arquivos</b> (PDF, print, foto). O app separa o que é <b>guia</b> (DAS, DARF) e o que é <b>comprovante</b>, lê tudo e <b>lança sozinho o que tiver certeza</b>. O que tiver dúvida fica para você conferir. Tudo pode ser desfeito.</p>' +
      '<div class="acoes"><button class="prim" id="es-foto">📷 Tirar foto</button><button id="es-esc">📁 Escolher arquivos</button></div>' +
      '<input type="file" id="es-cam" accept="image/*" capture="environment" class="oculto"><input type="file" id="es-arq" accept="application/pdf,image/*" multiple class="oculto">' +
      '<label class="marca-linha" style="font-weight:400;margin-top:8px"><input type="checkbox" id="es-auto"> Lançar sozinho o que tiver certeza (desmarque para conferir tudo antes)</label>' +
      '<div id="es-st" class="peq" style="margin:8px 0"></div><div id="es-lista"></div>' +
      '<div class="acoes"><button class="prim" id="es-ok" disabled>Continuar</button><button id="es-fechar">Fechar</button></div>', { titulo: "📷 Escanear guias e comprovantes", larga: true, semRascunho: true }), el = j.el;
    $("#es-auto", el).checked = auto;
    $("#es-auto", el).onchange = function () { try { localStorage.setItem("age_imp_auto", this.checked ? "1" : "0"); } catch (e0) { /* sem armazenamento */ } resumo(); };
    var guias = [], comps = [], sem = [];
    function resumo() {
      var automatico = $("#es-auto", el).checked;
      $("#es-lista", el).innerHTML = '<div class="cartao"><b>' + guias.length + "</b> guia(s) · <b>" + comps.length + "</b> comprovante(s)" + (sem.length ? ' · <span style="color:var(--atencao)"><b>' + sem.length + "</b> não identificado(s): " + sem.map(function (f) { return esc(f.name || "arquivo"); }).join(", ") + "</span>" : "") + "</div>";
      $("#es-ok", el).disabled = !(guias.length || comps.length);
      $("#es-ok", el).textContent = automatico ? "⚡ Lançar agora" : guias.length ? "Continuar: conferir as guias" + (comps.length ? " e depois os comprovantes" : "") : comps.length ? "Continuar: conferir os comprovantes" : "Continuar";
    }
    function ler(fs) {
      fs = fs.slice(0, 20); if (!fs.length) return;
      fs.reduce(function (pr, f, i) {
        return pr.then(function () {
          $("#es-st", el).textContent = "📖 Lendo " + (i + 1) + " de " + fs.length + "... (a 1ª vez demora um pouco)";
          return textoDe(f).then(function (r) { var tp = tipoDoc(r.texto); (tp === "guia" ? guias : tp === "comprovante" ? comps : sem).push(f); }, function () { sem.push(f); });
        });
      }, Promise.resolve()).then(function () { $("#es-st", el).textContent = "Pronto."; resumo(); });
    }
    $("#es-foto", el).onclick = function () { $("#es-cam", el).value = ""; $("#es-cam", el).click(); };
    $("#es-esc", el).onclick = function () { $("#es-arq", el).value = ""; $("#es-arq", el).click(); };
    $("#es-cam", el).onchange = function () { ler(Array.prototype.slice.call(this.files || [])); };
    $("#es-arq", el).onchange = function () { ler(Array.prototype.slice.call(this.files || [])); };
    $("#es-fechar", el).onclick = function () { j.fechar(); };
    $("#es-ok", el).onclick = function () {
      var g = guias.slice(), c = comps.slice(), n = sem.slice(), automatico = $("#es-auto", el).checked;
      if (!automatico) { j.fechar(); if (g.length) lerGuias(g, c.length ? function () { lerComprovantes(c); } : null); else lerComprovantes(c); return; }
      $("#es-ok", el).disabled = true; $("#es-st", el).textContent = "⚡ Lançando...";
      lancarAuto(g, c, n).then(function (res) { j.fechar(); mostrarResultado(res); }, function (er) { $("#es-st", el).textContent = "⚠ " + A.msgErro(er); $("#es-ok", el).disabled = false; });
    };
  }
  // modo automático: guias primeiro (para existirem as parcelas), depois os comprovantes; só lança o que tem certeza
  function lancarAuto(guias, comps, sem) {
    var lote = novoLote(), res = { feitos: [], conferir: [], repetidos: [], sem: sem };
    function triagem(e, aplicar) {
      if (e.repetida || e.repetido) { res.repetidos.push(e); return Promise.resolve(); }
      if (e.erro || !e.seguro) { res.conferir.push(e); return Promise.resolve(); }
      return aplicar(e).then(function () { (e.erro ? res.conferir : res.feitos).push(e); });
    }
    var comprovOk = !P.S.semComprov;
    return guias.reduce(function (pr, f) { return pr.then(function () { return analisarGuia(f, lote).then(function (e) { return triagem(e, aplicarGuia); }); }); }, Promise.resolve())
      .then(function () { return comps.reduce(function (pr, f) { return pr.then(function () { return analisarComprovante(f, lote).then(function (e) { if (!comprovOk) { e.erro = "rode de novo o impostos.sql no Supabase (tabela impostos_comprovantes)"; } return triagem(e, aplicarComprovante); }); }); }, Promise.resolve()); })
      .then(function () { return res; });
  }
  function mostrarResultado(res) {
    var j = A.janela('<div id="rs-corpo"></div><div class="acoes"><button class="prim" id="rs-fechar">Fechar</button></div>', { titulo: "⚡ Resultado do escaneamento", larga: true, semRascunho: true, aoFechar: function () { refrescar(); } }), el = j.el;
    function linha(e) { return '<div class="cartao"><b>' + esc(e.nome) + "</b>"; }
    function desenhar() {
      var h = "";
      var feitos = res.feitos.filter(function (e) { return !e.desfeito; });
      h += '<div class="cartao"><b>✅ ' + feitos.length + " lançado(s) automaticamente</b> · " + res.conferir.length + " para conferir · " + res.repetidos.length + " repetido(s) recusado(s)" + (res.sem.length ? " · " + res.sem.length + " não identificado(s)" : "") + "</div>";
      res.feitos.forEach(function (e, i) {
        h += linha(e) + ' <span class="selo">' + (e.tipo === "guia" ? "guia" : "comprovante") + "</span>" + (e.desfeito ? '<div class="peq mudo">↩ Desfeito.</div>' : '<div class="peq">✅ ' + esc(e.resultado || "") + ' <button class="peq" data-des="' + i + '">↩ Desfazer</button></div>') + "</div>";
      });
      res.conferir.forEach(function (e, i) {
        h += linha(e) + ' <span class="selo atencao">conferir</span><div class="peq" style="color:var(--atencao)">⚠ ' + esc(e.erro || e.aviso || "Não tive certeza: confira na tela.") + ' <button class="peq prim" data-conf="' + i + '">Conferir</button></div></div>';
      });
      res.repetidos.forEach(function (e) { h += linha(e) + '<div class="peq" style="color:var(--critico)">⛔ Repetido: ' + esc(e.repetido || e.repetida) + "</div></div>"; });
      res.sem.forEach(function (f) { h += '<div class="cartao"><b>' + esc(f.name || "arquivo") + '</b><div class="peq mudo">❓ Não identifiquei se é guia ou comprovante. Tente o PDF original ou use 📄 Ler guia / 📎 Ler comprovantes.</div></div>'; });
      $("#rs-corpo", el).innerHTML = h;
      $$("[data-des]", el).forEach(function (b) { b.onclick = function () { var e = res.feitos[Number(b.dataset.des)]; if (!A.confirmar("Desfazer este lançamento?")) return; b.disabled = true; desfazer(e).then(desenhar).catch(function (er) { A.avisar(A.msgErro(er), "erro"); desenhar(); }); }; });
      $$("[data-conf]", el).forEach(function (b) { b.onclick = function () { var e = res.conferir[Number(b.dataset.conf)]; j.fechar(); if (e.tipo === "guia") lerGuias([e.arquivo]); else lerComprovantes([e.arquivo]); }; });
    }
    $("#rs-fechar", el).onclick = function () { j.fechar(); };
    desenhar();
  }

  // ---------- imposto de veículo (IPVA, licenciamento, seguro obrigatório, multa...) ----------
  var CAT_VEIC = ["IPVA", "Licenciamento", "Seguro obrigatório (DPVAT/SPVAT)", "Multa", "Outro"];
  function editarVeiculo() {
    var vs = (P.S.veic || []).filter(function (v) { return v.ativo !== false; });
    if (!vs.length) { A.avisar("Cadastre antes o veículo na aba 🚗 Veículos.", "erro"); return; }
    var j = A.janela('<label for="iv-veic">Veículo *</label><select id="iv-veic">' + vs.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.placa + (v.modelo ? " — " + v.modelo : "")) + "</option>"; }).join("") + "</select>" +
      '<div class="duas"><div><label for="iv-cat">O que é *</label><select id="iv-cat">' + CAT_VEIC.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + '</select></div>' +
      '<div><label for="iv-ref">Ano ou referência</label><input id="iv-ref" maxlength="40" placeholder="Ex.: 2026"></div></div>' +
      '<div class="duas"><div><label for="iv-total">Valor total (R$) *</label><input id="iv-total" inputmode="decimal"></div><div><label for="iv-np">Em quantas parcelas (cotas)?</label><input id="iv-np" type="number" min="1" max="12" value="1"></div></div>' +
      '<div class="duas"><div><label for="iv-d1">Vencimento da 1ª (ou única) *</label><input type="date" id="iv-d1"></div><div><label for="iv-regra">Vencimento das demais</label><select id="iv-regra"><option value="mesmo">Mesmo dia de cada mês</option><option value="ultimo">Último dia útil do mês</option></select></div></div>' +
      '<p class="peq mudo" style="margin:2px 0">As parcelas saem iguais (valor total ÷ parcelas; a última fecha o centavo). Valores e datas: confira na guia do Detran e ajuste na lista de parcelas.</p>' +
      '<label for="iv-obs">Observações</label><textarea id="iv-obs" rows="2" maxlength="3000"></textarea><p class="peq" id="iv-msg" style="color:var(--critico)"></p>' +
      '<div class="acoes"><button class="prim" id="iv-salvar">💾 Salvar</button><button id="iv-cancelar">Cancelar</button></div>', { titulo: "🚗 Imposto de veículo", semRascunho: true }), el = j.el;
    $("#iv-ref", el).value = String(new Date().getFullYear());
    $("#iv-cancelar", el).onclick = function () { j.fechar(); };
    $("#iv-salvar", el).onclick = function () {
      var msg = function (t) { $("#iv-msg", el).textContent = t; }, total = lerValor($("#iv-total", el).value), d1 = $("#iv-d1", el).value, np = parseInt($("#iv-np", el).value, 10) || 1;
      if (!(total > 0)) return msg("Informe o valor total.");
      if (!d1) return msg("Informe o vencimento da 1ª parcela.");
      var vid = $("#iv-veic", el).value, v = P.porId(P.S.veic, vid), cat = $("#iv-cat", el).value, ref = $("#iv-ref", el).value.trim();
      var base = Math.floor(total / np * 100) / 100, parcelas = [], soma = 0;
      for (var k = 1; k <= np; k++) { var val = k === np ? num(total - soma) : base; soma += val; parcelas.push({ numero: k, vencimento: k === 1 ? d1 : maisMeses(d1, k - 1, $("#iv-regra", el).value), valor: val }); }
      var dados = { nome: cat.replace(/ \(.*\)$/, "") + (ref ? " " + ref : "") + " — " + (v ? v.placa : ""), orgao: "Detran / Estado", tipo: "veiculo", categoria: cat.replace(/ \(.*\)$/, ""), veiculo_id: vid,
        valor_total: total, n_parcelas: np, obs: $("#iv-obs", el).value.trim() || null };
      var b = this; A.ocupado(b, true, "Salvando...");
      P.q(P.sb.from("impostos_parcelamentos").insert(dados).select().single()).then(function (n) {
        P.trocar(P.S.impDividas, n);
        return P.q(P.sb.from("impostos_parcelas").insert(parcelas.map(function (p) { return Object.assign({ parcelamento_id: n.id }, p); })).select()).then(function (ls) { (ls || []).forEach(function (x) { P.S.impParcelas.push(x); }); });
      }).then(function () { A.ocupado(b, false); j.fechar(); A.avisar("Salvo", "ok"); refrescar(); }).catch(function (e) { A.ocupado(b, false); msg(/veiculo_id|categoria|impostos_parcelamentos_tipo_check|violates check/i.test(A.msgErro(e)) ? "Rode de novo o impostos.sql no Supabase (novo: impostos de veículos)." : "Não salvou: " + A.msgErro(e)); });
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
