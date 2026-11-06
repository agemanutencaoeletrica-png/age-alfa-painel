// Painel do dono — 📐 PROPOSTA DE PROJETO: proposta técnico-comercial (SPDA, aterramento, diagrama unifilar...) com os dados da AGE,
// em PDF, para mandar ao cliente. Escolha os serviços, preencha o cliente, o valor e as condições; o app monta o PDF e envia.
// O responsável técnico (nome e CREA) é digitado uma vez e fica lembrado neste aparelho. Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var RT_CHAVE = "age_resp_tecnico_v1";

  var ITENS = [
    ["Levantamento dimensional e arquitetônico", "Visita técnica no local para medição e registro das dimensões e características arquitetônicas da edificação."],
    ["Documento de Análise de Gerenciamento de Risco", "Avaliação do risco de danos por descargas atmosféricas para as edificações, subsidiando a definição do nível de proteção do SPDA."],
    ["Projeto de SPDA", "Projeto do Sistema de Proteção contra Descargas Atmosféricas, com captação, descidas e demais elementos aplicáveis."],
    ["Projeto de Aterramento", "Projeto do sistema de aterramento das edificações, integrado ao SPDA e às instalações elétricas."],
    ["Memorial Descritivo do Projeto de Aterramento e SPDA", "Descrição técnica dos critérios, premissas e soluções adotadas nos projetos de SPDA e aterramento."],
    ["Lista de Materiais", "Relação dos materiais e componentes necessários à execução dos projetos."],
    ["Emissão de ART", "Anotação de Responsabilidade Técnica junto ao CREA referente aos serviços contratados."],
    ["Diagrama Unifilar de {n} Quadros Elétricos", "Elaboração do diagrama unifilar de {n} quadros elétricos, conforme informações de circuitos fornecidas pelo contratante."],
    ["Etiquetas de identificação", "Fornecimento de etiquetas de identificação dos quadros elétricos e das tomadas."]
  ];
  var RESP = "tipo de solo do terreno;\ntipo e espessura das telhas das coberturas;\npara os diagramas unifilares, a indicação do destino de cada circuito (carga ou ponto atendido) de cada quadro elétrico;\ndemais informações necessárias sobre as estruturas.";
  var NAO = "Realização de testes nos quadros elétricos e nos circuitos, não incluídos no escopo dos diagramas unifilares;\nExecução, instalação ou fornecimento dos materiais relacionados na Lista de Materiais, que será entregue apenas como documento técnico;\nServiços não descritos expressamente no escopo desta proposta, que poderão ser objeto de orçamento complementar.";

  function din(v) { return A.dinheiro(Number(v) || 0); }
  // título = profissão ("Engenheira Eletricista", "Eletricista"); só recusa o que parece nome de pessoa (3 palavras ou mais, sem palavra de profissão)
  function tituloValido(t) { t = String(t || "").trim(); return /engenh|t[eé]cnic|arquitet|tecn[oó]log|respons|perit|eletric/i.test(t) || t.split(/\s+/).length < 3; }
  function limpaNome(t) { return String(t || "").replace(/\s+/g, " ").replace(/[\s.;,]+$/, "").trim(); }
  function creaTxt(c) { c = String(c || "").trim().replace(/^(CREA-[A-Za-z]{2})\s*:\s*/i, "$1 "); return !c ? "" : /^CREA/i.test(c) ? c : "CREA: " + c; }
  function lerRT() { try { return JSON.parse(localStorage.getItem(RT_CHAVE) || "{}") || {}; } catch (e) { return {}; } }
  function gravarRT(o) { try { localStorage.setItem(RT_CHAVE, JSON.stringify(o)); } catch (e) { /* sem espaço: segue */ } }
  function linhas(t) { return String(t || "").split("\n").map(function (x) { return x.trim().replace(/^[-•*]\s*/, "").replace(/;$/, ""); }).filter(Boolean); }
  function dataExtensa(d) {
    var M = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return d.getDate() + " de " + M[d.getMonth()] + " de " + d.getFullYear();
  }

  // valor por extenso em reais (ex.: 6000 -> "seis mil reais")
  function extenso(v) {
    v = Math.round((Number(v) || 0) * 100) / 100;
    var U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    var Dz = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    var C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
    function ate999(n) {
      if (n === 0) return "";
      if (n === 100) return "cem";
      var c = Math.floor(n / 100), r = n % 100, p = [];
      if (c) p.push(C[c]);
      if (r) p.push(r < 20 ? U[r] : Dz[Math.floor(r / 10)] + (r % 10 ? " e " + U[r % 10] : ""));
      return p.join(" e ");
    }
    function inteiro(n) {
      if (n === 0) return "zero";
      var partes = [], mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), res = n % 1000;
      if (mi) partes.push(ate999(mi) + (mi === 1 ? " milhão" : " milhões"));
      if (mil) partes.push(mil === 1 ? "mil" : ate999(mil) + " mil");
      if (res) partes.push(ate999(res));
      var out = partes[0] || "";
      for (var i = 1; i < partes.length; i++) out += (i === partes.length - 1 && (res < 100 || res % 100 === 0) ? " e " : ", ") + partes[i];
      return out;
    }
    var reais = Math.floor(v), cent = Math.round((v - reais) * 100), t = "";
    if (reais) t = inteiro(reais) + (reais === 1 ? " real" : (reais % 1e6 === 0 && reais >= 1e6 ? " de reais" : " reais"));
    if (cent) t += (t ? " e " : "") + inteiro(cent) + (cent === 1 ? " centavo" : " centavos");
    return t || "zero real";
  }

  // ---------------- janela ----------------
  function abrir(ctx) {
    P = ctx;
    var E = A.CFG.EMPRESA || {}, rt = lerRT();
    var j = A.janela(
      '<p class="peq mudo" style="margin-top:0">Proposta técnico-comercial em PDF, com os dados da <b>' + esc(E.nome || "AGE") + '</b>. Escolha os serviços, preencha o cliente e o valor.</p>' +
      '<label for="pj-cli">Contratante (cliente) *</label><input id="pj-cli" maxlength="200" autocomplete="off">' +
      '<div class="duas"><div><label for="pj-doc">CNPJ ou CPF do cliente</label><input id="pj-doc" inputmode="numeric" maxlength="25"></div><div><label for="pj-local">Local da obra (endereço / cidade)</label><input id="pj-local" maxlength="300"></div></div>' +
      '<div class="duas"><div><label for="pj-data">Data da proposta</label><input id="pj-data" type="date"></div><div></div></div>' +
      '<h3 style="margin:12px 0 4px">Serviços desta proposta</h3>' +
      ITENS.map(function (it, i) {
        return '<label class="marca-linha" style="font-weight:400;align-items:flex-start"><input type="checkbox" class="pj-it" data-i="' + i + '" checked> <span><b>' + esc(it[0].replace("{n}", "N")) + "</b><br><span class=\"peq mudo\">" + esc(it[1].replace("{n}", "N")) + "</span></span></label>";
      }).join("") +
      '<div class="duas"><div><label for="pj-nq">Nº de quadros do diagrama unifilar</label><input id="pj-nq" inputmode="numeric" value="4"></div><div><label for="pj-extra">Outro serviço (opcional, uma linha por serviço: Nome; descrição)</label><textarea id="pj-extra" rows="2" placeholder="Laudo de inspeção; Vistoria e relatório técnico das instalações"></textarea></div></div>' +
      '<label for="pj-resp">Responsabilidades do contratante (uma por linha)</label><textarea id="pj-resp" rows="4"></textarea>' +
      '<label for="pj-nao">Itens não contemplados (um por linha)</label><textarea id="pj-nao" rows="4"></textarea>' +
      '<h3 style="margin:12px 0 4px">Investimento</h3>' +
      '<div class="duas"><div><label for="pj-valor">Valor total (R$) *</label><input id="pj-valor" inputmode="decimal"></div><div><label for="pj-nf">Nota fiscal</label><select id="pj-nf"><option value="">não informar</option><option value="com emissão de nota fiscal">com emissão de nota fiscal</option><option value="sem emissão de nota">sem emissão de nota</option></select></div></div>' +
      '<label for="pj-pag">Condição de pagamento</label><textarea id="pj-pag" rows="2"></textarea>' +
      '<div class="duas"><div><label for="pj-val">Validade da proposta (dias)</label><input id="pj-val" inputmode="numeric" value="15"></div><div><label for="pj-prazo">Prazo de entrega (opcional)</label><input id="pj-prazo" maxlength="120" placeholder="Ex.: 15 dias úteis após receber as informações"></div></div>' +
      '<h3 style="margin:12px 0 4px">Responsável técnico (para a ART)</h3>' +
      '<div class="duas"><div><label for="pj-rt">Nome do engenheiro(a)</label><input id="pj-rt" maxlength="160" autocomplete="off"></div><div><label for="pj-crea">CREA</label><input id="pj-crea" maxlength="60" placeholder="CREA-MG 0000000000"></div></div>' +
      '<label for="pj-tit">Título do responsável (opcional) — a profissão, não o nome</label><input id="pj-tit" maxlength="80" placeholder="Engenheira Eletricista">' +
      '<label for="pj-rep">Responsável pela AGE (nome que assina pela empresa)</label><input id="pj-rep" maxlength="120" autocomplete="off" placeholder="Nome de quem assina pela AGE">' +
      '<div id="pj-erro"></div>' +
      '<p class="peq mudo" id="pj-estado" style="margin:10px 0 0"></p>' +
      '<div class="acoes"><button class="prim" id="pj-salvar">💾 Salvar proposta</button><button id="pj-nova" class="oculto">📋 Salvar como nova</button><button id="pj-salvas">📂 Propostas salvas</button></div>' +
      '<div class="acoes"><button class="prim" id="pj-pdf">📄 Gerar PDF</button><button id="pj-env">📤 Enviar ao cliente</button><button id="pj-fim">Fechar</button></div>',
      { titulo: "📐 Proposta de projeto", larga: true, fixa: true });
    var el = j.el;
    $("#pj-data", el).value = A.isoLocal(new Date());
    $("#pj-resp", el).value = RESP; $("#pj-nao", el).value = NAO; $("#pj-pag", el).value = "50% na aprovação da proposta e 50% na entrega dos projetos.";
    $("#pj-rt", el).value = rt.nome || ""; $("#pj-crea", el).value = rt.crea || ""; $("#pj-tit", el).value = rt.titulo || ""; $("#pj-rep", el).value = rt.rep || "";
    $("#pj-fim", el).onclick = function () { j.fechar(); };
    // ---- 💾 propostas salvas (tabela propostas_projeto): guarda todos os campos da tela para abrir, editar ou usar como modelo ----
    var atual = null;   // proposta salva que está sendo editada
    function tudo() {
      var o = { _it: [] };
      $$('input[id^="pj-"], textarea[id^="pj-"], select[id^="pj-"]', el).forEach(function (c) { o[c.id] = c.value; });
      $$(".pj-it", el).forEach(function (cb) { o._it[Number(cb.dataset.i)] = cb.checked; });
      return o;
    }
    function aplicar(o, modelo) {
      Object.keys(o).forEach(function (k) { if (k === "_it") return; var c = $("#" + k, el); if (c) c.value = o[k]; });
      (o._it || []).forEach(function (v, i) { var cb = $('.pj-it[data-i="' + i + '"]', el); if (cb) cb.checked = !!v; });
      if (modelo) { $("#pj-cli", el).value = ""; $("#pj-doc", el).value = ""; $("#pj-local", el).value = ""; $("#pj-data", el).value = A.isoLocal(new Date()); }
    }
    function estado() {
      $("#pj-estado", el).innerHTML = atual ? "✏ Editando a proposta salva de <b>" + esc(atual.cliente || "") + "</b> (salva em " + esc(A.data(atual.atualizado_em || atual.criado_em)) + "). <b>💾 Salvar</b> atualiza esta; <b>📋 Salvar como nova</b> cria outra." : "Proposta nova, ainda não salva.";
      $("#pj-nova", el).classList.toggle("oculto", !atual);
    }
    function semTabela(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
    function salvarProposta(comoNova, b) {
      var cli = $("#pj-cli", el).value.trim();
      if (!cli) { $("#pj-erro", el).innerHTML = '<div class="aviso erro">Informe o contratante (cliente) para salvar.</div>'; return; }
      $("#pj-erro", el).innerHTML = "";
      var reg = { cliente: cli, valor: A.lerNumero($("#pj-valor", el).value) || null, campos: tudo(), atualizado_em: new Date().toISOString() };
      A.ocupado(b, true, "Salvando...");
      var q = atual && !comoNova ? P.sb.from("propostas_projeto").update(reg).eq("id", atual.id).select().single() : P.sb.from("propostas_projeto").insert(reg).select().single();
      Promise.resolve(q).then(function (r) { if (r.error) throw r.error; return r.data; }).then(function (n) { A.ocupado(b, false); atual = n; estado(); A.avisar("💾 Proposta salva", "ok"); })
        .catch(function (e) {
          A.ocupado(b, false);
          $("#pj-erro", el).innerHTML = '<div class="aviso erro">' + (semTabela(e) ? "Para salvar propostas, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>propostas_projeto</b>)." : esc(A.msgErro ? A.msgErro(e) : e.message)) + "</div>";
        });
    }
    $("#pj-salvar", el).onclick = function () { salvarProposta(false, this); };
    $("#pj-nova", el).onclick = function () { salvarProposta(true, this); };
    $("#pj-salvas", el).onclick = function () {
      var jj = A.janela('<div id="ps-lista"><div class="cartao vazio">Carregando...</div></div>', { titulo: "📂 Propostas de projeto salvas", larga: true, semRascunho: true });
      function lista() {
        Promise.resolve(P.sb.from("propostas_projeto").select("*").order("atualizado_em", { ascending: false }).limit(300)).then(function (r) { if (r.error) throw r.error; return r.data || []; }).then(function (ls) {
          var box = $("#ps-lista", jj.el);
          if (!ls.length) { box.innerHTML = '<div class="cartao vazio">Nenhuma proposta salva ainda. Preencha e toque em 💾 Salvar proposta.</div>'; return; }
          box.innerHTML = '<div class="tabela-caixa"><table><thead><tr><th>Cliente</th><th class="num">Valor</th><th>Salva em</th><th></th></tr></thead><tbody>' + ls.map(function (x) {
            return "<tr><td>" + esc(x.cliente) + '</td><td class="num">' + (x.valor ? din(x.valor) : "—") + "</td><td>" + esc(A.data(x.atualizado_em || x.criado_em)) + '</td><td><button class="peq prim" data-ps-abrir="' + x.id + '">Abrir</button> <button class="peq" data-ps-modelo="' + x.id + '" title="Abre com os mesmos serviços e valores, sem o cliente">📋 Usar como modelo</button> <button class="peq perigo" data-ps-del="' + x.id + '">🗑</button></td></tr>';
          }).join("") + "</tbody></table></div>";
          var acha = function (id) { return ls.filter(function (x) { return x.id === id; })[0]; };
          $$("[data-ps-abrir]", box).forEach(function (bt) { bt.onclick = function () { var x = acha(bt.dataset.psAbrir); aplicar(x.campos || {}, false); atual = x; estado(); jj.fechar(); }; });
          $$("[data-ps-modelo]", box).forEach(function (bt) { bt.onclick = function () { var x = acha(bt.dataset.psModelo); aplicar(x.campos || {}, true); atual = null; estado(); jj.fechar(); A.avisar("📋 Modelo carregado: preencha o novo cliente", "ok"); }; });
          $$("[data-ps-del]", box).forEach(function (bt) { bt.onclick = function () {
            var x = acha(bt.dataset.psDel); if (!A.confirmar("Apagar a proposta salva de " + x.cliente + "? Não dá para recuperar.")) return;
            Promise.resolve(P.sb.from("propostas_projeto").delete().eq("id", x.id)).then(function (r) { if (r.error) throw r.error; if (atual && atual.id === x.id) { atual = null; estado(); } lista(); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
          }; });
        }).catch(function (e) { $("#ps-lista", jj.el).innerHTML = '<div class="aviso">' + (semTabela(e) ? "Para guardar propostas, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>propostas_projeto</b>)." : esc(A.msgErro ? A.msgErro(e) : e.message)) + "</div>"; });
      }
      lista();
    };
    estado();
    function ler() {
      var v = A.lerNumero($("#pj-valor", el).value);
      var d = { data: $("#pj-data", el).value || A.isoLocal(new Date()), cliente: $("#pj-cli", el).value.trim(), doc: $("#pj-doc", el).value.trim(), local: $("#pj-local", el).value.trim(), valor: v, nf: $("#pj-nf", el).value, pagamento: $("#pj-pag", el).value.trim(),
        validade: Math.max(1, parseInt($("#pj-val", el).value, 10) || 15), prazo: $("#pj-prazo", el).value.trim(), resp: linhas($("#pj-resp", el).value), nao: linhas($("#pj-nao", el).value),
        rt: $("#pj-rt", el).value.trim(), crea: $("#pj-crea", el).value.trim(), titulo: $("#pj-tit", el).value.trim(), rep: $("#pj-rep", el).value.trim(), itens: [] };
      var nq = Math.max(1, parseInt($("#pj-nq", el).value, 10) || 4);
      $$(".pj-it", el).forEach(function (cb) {
        if (!cb.checked) return;
        var it = ITENS[Number(cb.dataset.i)], desc = it[1].replace("{n}", nq + " (" + extNum(nq) + ")");
        d.itens.push([it[0].replace("{n} Quadros Elétricos", nq + (nq === 1 ? " Quadro Elétrico" : " Quadros Elétricos")), desc]);
      });
      String($("#pj-extra", el).value || "").split("\n").forEach(function (l) {
        l = l.trim(); if (!l) return; var p = l.split(";"); d.itens.push([p[0].trim(), (p.slice(1).join(";") || "").trim()]);
      });
      return d;
    }
    function extNum(n) { return ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"][n] || String(n); }
    function conferir(d) {
      if (!d.cliente) return "Informe o contratante (cliente).";
      if (!d.itens.length) return "Marque pelo menos um serviço.";
      if (!(d.valor > 0)) return "Informe o valor total.";
      return "";
    }
    function gerar(b) {
      var d = ler(), erro = conferir(d);
      $("#pj-erro", el).innerHTML = erro ? '<div class="aviso erro">' + esc(erro) + "</div>" : "";
      if (erro) return Promise.resolve(null);
      if (d.titulo && !tituloValido(d.titulo)) { $("#pj-erro", el).innerHTML = '<div class="aviso">⚠️ O <b>título</b> "' + esc(d.titulo) + '" parece um nome de pessoa: no título vai a profissão (ex.: Engenheira Eletricista). Ele não vai no PDF até você corrigir.</div>'; d.titulo = ""; }
      gravarRT({ nome: d.rt, crea: d.crea, titulo: d.titulo, rep: d.rep });
      if (!d.rt || !d.crea) $("#pj-erro", el).innerHTML = '<div class="aviso">⚠️ Sem o nome e o CREA do responsável técnico, o PDF sai com a linha em branco para preencher à mão. A ART precisa de um profissional habilitado.</div>';
      A.ocupado(b, true, "Gerando...");
      return pdf(d).then(function (r) { A.ocupado(b, false); return { d: d, r: r }; }).catch(function (e) { A.ocupado(b, false); $("#pj-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; return null; });
    }
    $("#pj-pdf", el).onclick = function () { gerar(this).then(function (x) { if (x) { P.baixar(x.r.blob, x.r.nome); A.avisar("📄 PDF gerado", "ok"); } }); };
    $("#pj-env", el).onclick = function () {
      gerar(this).then(function (x) {
        if (!x) return;
        var arq = new File([x.r.blob], x.r.nome, { type: "application/pdf" }), E2 = A.CFG.EMPRESA || {};
        var texto = "Olá! Segue a proposta técnico-comercial de " + x.d.itens.slice(0, 3).map(function (i) { return i[0]; }).join(", ").toLowerCase() + (x.d.itens.length > 3 ? " e outros serviços" : "") + ".\nValor: " + din(x.d.valor) + ".\nQualquer dúvida, é só chamar." + (E2.telefone ? "\n📲 " + E2.telefone : "") + "\n" + (E2.nome || "");
        var podeArq = false; try { podeArq = !!(navigator.canShare && navigator.canShare({ files: [arq] })); } catch (e) { podeArq = false; }
        if (podeArq) A.compartilhar({ titulo: "Proposta " + x.d.cliente, texto: texto, arquivos: [arq] });
        else { P.baixar(x.r.blob, x.r.nome); A.compartilhar({ titulo: "Proposta " + x.d.cliente, texto: texto + "\n(O PDF foi baixado: anexe na conversa.)" }); }
      });
    };
    setTimeout(function () { $("#pj-cli", el).focus(); }, 50);
  }

  // ---------------- PDF ----------------
  function pdf(d) {
    return P.carregarJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: "mm", format: "a4" }), E = A.CFG.EMPRESA || {};
      var L = 15, R = 195, W = R - L, y = 18;
      function tx(v) {
        return String(v === null || v === undefined ? "" : v).replace(/[−–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/•/g, "-").replace(/ /g, " ").replace(/[^\x00-\xff]/g, "");
      }
      function azul() { doc.setTextColor(20, 50, 92); }
      function preto() { doc.setTextColor(25, 25, 25); }
      function fonte(p, t) { doc.setFont("helvetica", p); doc.setFontSize(t); }
      function espaco(alt) { if (y + alt > 272) { doc.addPage(); y = 18; return true; } return false; }
      function titulo(t) { espaco(16); fonte("bold", 12); azul(); doc.text(tx(t), L, y); y += 6; }
      function paragrafo(t, tam, aj) { fonte("normal", tam || 10); preto(); var ls = doc.splitTextToSize(tx(t), W); espaco(ls.length * 4.8 + 2); doc.text(ls, L, y, aj ? { align: "justify", maxWidth: W } : undefined); y += ls.length * 4.8 + 2; }
      function marcadores(arr) {
        arr.forEach(function (t) {
          fonte("normal", 10); preto();
          var ls = doc.splitTextToSize(tx(t), W - 8); espaco(ls.length * 4.8 + 1.5);
          doc.setFillColor(20, 50, 92); doc.circle(L + 3, y - 1.2, 0.7, "F"); doc.text(ls, L + 7, y); y += ls.length * 4.8 + 1.5;
        });
        y += 1.5;
      }
      // cabeçalho da empresa
      fonte("bold", 15); azul(); doc.text(tx(E.nome || "AGE"), L, y);
      fonte("normal", 9); preto(); var yi = y + 5.5;
      [E.documento, E.telefone, E.email, [E.endereco, E.cidade].filter(Boolean).join(", ")].filter(Boolean).forEach(function (l) { doc.text(tx(l), L, yi); yi += 4.3; });
      y = yi + 3;
      doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 10;
      fonte("bold", 17); azul(); doc.text("PROPOSTA TÉCNICO-COMERCIAL", 105, y, { align: "center" }); y += 7;
      fonte("normal", 11); doc.setTextColor(95, 95, 95); doc.text(tx("Projetos de SPDA, Aterramento e Diagramas Unifilares"), 105, y, { align: "center" }); y += 5.5;
      var hoje = new Date(d.data + "T12:00:00"); fonte("normal", 10); doc.text(tx(dataExtensa(hoje)), 105, y, { align: "center" }); y += 8;
      // contratante
      var cli = [["Contratante: ", d.cliente], ["CNPJ/CPF: ", d.doc], ["Local: ", d.local]].filter(function (c) { return c[1]; });
      var altC = cli.reduce(function (s, c) { return s + doc.splitTextToSize(tx(c[1]), 140).length * 5; }, 0) + 4;
      doc.setFillColor(243, 245, 248); doc.roundedRect(L, y - 4, W, altC, 2, 2, "F"); y += 0.5;
      cli.forEach(function (c) { fonte("bold", 10); preto(); doc.text(c[0], L + 3, y); fonte("normal", 10); var ls = doc.splitTextToSize(tx(c[1]), 140); doc.text(ls, L + 30, y); y += ls.length * 5; });
      y += 7;
      // 1. escopo
      titulo("1. Escopo do Serviço");
      doc.setFillColor(20, 50, 92); doc.rect(L, y - 4.2, W, 6.5, "F"); fonte("bold", 9.5); doc.setTextColor(255, 255, 255);
      doc.text("Item", L + 2, y); doc.text("Serviço", L + 16, y); doc.text("Descrição", L + 78, y); y += 5.2;
      d.itens.forEach(function (it, i) {
        fonte("bold", 9.5); var s1 = doc.splitTextToSize(tx(it[0]), 58); fonte("normal", 9.5); var s2 = doc.splitTextToSize(tx(it[1] || ""), W - 78), n = Math.max(s1.length, s2.length), alt = n * 4.5 + 3;
        if (espaco(alt)) { y += 0; }
        if (i % 2) { doc.setFillColor(243, 245, 249); doc.rect(L, y - 3.5, W, alt, "F"); }
        doc.setDrawColor(210); doc.setLineWidth(0.2); doc.line(L, y - 3.5 + alt, R, y - 3.5 + alt);
        fonte("normal", 9.5); preto(); doc.text(String(i + 1), L + 5, y, { align: "center" });
        fonte("bold", 9.5); doc.text(s1, L + 16, y); fonte("normal", 9.5); doc.text(s2, L + 78, y); y += alt;
      });
      y += 5;
      // 2. responsabilidades
      if (d.resp.length) {
        titulo("2. Responsabilidades do Contratante");
        paragrafo("Para a correta elaboração dos projetos, o contratante deverá fornecer todas as informações necessárias à execução dos serviços, tais como:", 10, true);
        marcadores(d.resp);
        paragrafo("A precisão e a tempestividade das informações prestadas são de responsabilidade do contratante, e eventual atraso ou inconsistência poderá impactar o prazo de entrega. Também caberá ao contratante garantir o acesso ao local para a realização da visita técnica.", 10, true);
        y += 2;
      }
      // 3. não contemplados
      if (d.nao.length) { titulo("3. Itens Não Contemplados"); marcadores(d.nao); }
      // 4. investimento
      titulo("4. Investimento e Condições de Pagamento");
      paragrafo("O valor total para a execução integral dos serviços descritos nesta proposta é de:", 10);
      espaco(24);
      doc.setDrawColor(210); doc.setLineWidth(0.2);
      doc.rect(L, y - 3.5, W, 8); fonte("normal", 9.5); preto(); doc.text(tx("Execução integral dos serviços descritos nesta proposta (itens 1 a " + d.itens.length + ")" + (d.nf ? " - " + d.nf : "")), L + 2, y + 1.3);
      doc.text(tx(din(d.valor)), R - 2, y + 1.3, { align: "right" }); y += 4.5;
      doc.setFillColor(20, 50, 92); doc.rect(L, y, W, 8, "F"); fonte("bold", 11); doc.setTextColor(255, 255, 255); doc.text("VALOR TOTAL", L + 2, y + 5.6); doc.text(tx(din(d.valor)), R - 2, y + 5.6, { align: "right" }); y += 14;
      fonte("bold", 10); preto(); doc.text("Valor por extenso: ", L, y); fonte("normal", 10); doc.text(tx(extenso(d.valor) + "."), L + 36, y); y += 6;
      if (d.pagamento) { fonte("bold", 10); doc.text("Condição de pagamento: ", L, y); fonte("normal", 10); var lp = doc.splitTextToSize(tx(d.pagamento), W - 47); doc.text(lp, L + 44, y); y += lp.length * 4.8 + 1.5; }
      if (d.prazo) { fonte("bold", 10); doc.text("Prazo de entrega: ", L, y); fonte("normal", 10); var lz = doc.splitTextToSize(tx(d.prazo), W - 35); doc.text(lz, L + 33, y); y += lz.length * 4.8 + 1.5; }
      y += 4;
      // 5. validade
      titulo("5. Validade da Proposta");
      paragrafo("Esta proposta tem validade de " + d.validade + " dias corridos a partir da data de sua emissão.", 10);
      y += 2;
      // 6. disposições finais
      titulo("6. Disposições Finais");
      paragrafo("A aceitação desta proposta dar-se-á mediante o de acordo do contratante, formalizado por assinatura no campo abaixo ou por confirmação escrita (e-mail ou aplicativo de mensagens).", 10, true);
      if (d.rt) paragrafo("Os serviços de engenharia serão executados sob a responsabilidade técnica de " + limpaNome(d.rt) + (d.titulo ? ", " + d.titulo : "") + (d.crea ? ", " + creaTxt(d.crea) : "") + ", contratado(a) pela " + (E.nome || "AGE") + " para este trabalho. A Anotação de Responsabilidade Técnica (ART) será emitida pelo responsável técnico, nos termos da legislação do Sistema Confea/CREA.", 10, true);
      else paragrafo("A Anotação de Responsabilidade Técnica (ART) será emitida pelo responsável técnico, nos termos da legislação do Sistema Confea/CREA.", 10, true);
      paragrafo("Colocamo-nos à disposição para quaisquer esclarecimentos.", 10);
      y += 2;
      paragrafo([E.cidade ? String(E.cidade).split(" - ")[0] : "", dataExtensa(hoje)].filter(Boolean).join(", ") + ".", 10);
      // assinaturas: AGE, responsável técnico e contratante
      espaco(52); y += 20;
      var bl = [[L, L + 56], [L + 62, L + 118], [R - 56, R]];
      doc.setDrawColor(40); doc.setLineWidth(0.3); bl.forEach(function (b) { doc.line(b[0], y, b[1], y); });
      function centro(i, linhas, negrito) {
        var yy = y + 5;   // cada linha começa abaixo da anterior, mesmo quando o texto quebra em 2 ou 3 linhas
        linhas.filter(Boolean).forEach(function (t, k) {
          fonte(k === 0 && negrito ? "bold" : "normal", k === 0 ? 9.5 : 8.5); preto();
          doc.splitTextToSize(tx(t), 54).slice(0, 3).forEach(function (ln) { doc.text(ln, (bl[i][0] + bl[i][1]) / 2, yy, { align: "center" }); yy += 3.9; });
          yy += 0.8;
        });
      }
      centro(0, [limpaNome(d.rep) || "Responsável pela AGE", E.nome || "AGE", E.documento || ""], true);
      centro(1, [limpaNome(d.rt) || "Responsável técnico", d.titulo || "Responsável técnico", creaTxt(d.crea) || "CREA: ____________"], true);
      centro(2, ["De acordo - Contratante", d.cliente, d.doc ? "CNPJ/CPF: " + d.doc : ""], true);
      // rodapé em todas as páginas
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p); fonte("normal", 8); doc.setTextColor(130, 130, 130);
        doc.text(tx([E.nome, E.documento, d.rt ? "Resp. técnico: " + limpaNome(d.rt) + (d.crea ? " - " + creaTxt(d.crea) : "") : ""].filter(Boolean).join(" - ") + "   |   Página " + p + " de " + n), 105, 290, { align: "center" });
      }
      var nome = "Proposta-Projeto-" + String(d.cliente).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".pdf";
      return { blob: doc.output("blob"), nome: nome };
    });
  }

  window.AGE_PROJ = { abrir: abrir, extenso: extenso };
})();
