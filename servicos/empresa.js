// Painel do dono — 🏢 DADOS DA EMPRESA: um lugar só com as informações da firma (CNPJ, inscrições, endereço, banco, contador...)
// para consultar e copiar na hora, sem ficar procurando. NÃO guarde senhas aqui. Tabela empresa_dados (grupo, rótulo, valor).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, dados = null, semTabela = false, filtro = "";
  var GRUPOS = ["Identificação", "Fiscal", "Endereço e contato", "Banco", "Contador e responsável técnico", "Outros"];
  // o que já sabemos da AGE (entra sozinho na primeira vez; depois tudo é editável)
  var PADRAO = [
    ["Identificação", "Nome fantasia", "AGE Elétrica e Pintura", 10],
    ["Identificação", "Razão social", "AGE SOLUCOES E MANUTENCOES ELETRICAS E CIVIL ELETR", 20],
    ["Identificação", "CNPJ", "17.134.491/0001-66", 30],
    ["Identificação", "Data de abertura", "08/11/2012", 40],
    ["Fiscal", "Inscrição estadual", "20553960040", 10],
    ["Fiscal", "Inscrição municipal", "4694270019", 20],
    ["Fiscal", "Regime", "Simples Nacional (optante), Anexo III", 30],
    ["Fiscal", "Emissor de NFS-e", "https://www.nfse.gov.br/EmissorNacional/", 40],
    ["Endereço e contato", "Endereço", "R. das Canárias, 249 - Palmeiras", 10],
    ["Endereço e contato", "Cidade / CEP", "Ibirité - MG, 32421-250", 20],
    ["Endereço e contato", "Telefone / WhatsApp", "(31) 98858-9772", 30],
    ["Endereço e contato", "E-mail", "agemanutencaoeletrica@gmail.com", 40],
    ["Banco", "Banco / agência / conta", "Itaú · agência 9748 · conta 99892-0", 10],
    ["Contador e responsável técnico", "Contador", "Altaca Contabilidade", 10],
    ["Contador e responsável técnico", "Responsável técnica (projetos)", "Ana Carolina Silva Castro, Engenheira Eletricista, CREA-MG 0000238532D-MG", 20]
  ];

  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function copiar(t, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { A.avisar(msg || "Copiado", "ok"); }, function () { window.prompt("Copie:", t); });
    else window.prompt("Copie:", t);
  }

  function carregar(depois) {
    Promise.resolve(P.sb.from("empresa_dados").select("*").order("ordem").limit(500)).then(function (r) {
      if (r.error) throw r.error;
      if (!(r.data || []).length) {
        // primeira vez: grava o que já sabemos da AGE
        return Promise.resolve(P.sb.from("empresa_dados").insert(PADRAO.map(function (x) { return { grupo: x[0], rotulo: x[1], valor: x[2], ordem: x[3] }; })).select()).then(function (r2) {
          if (r2.error && !/duplicate|unique|23505/i.test(String(r2.error.message || r2.error.code))) throw r2.error;
          return Promise.resolve(P.sb.from("empresa_dados").select("*").order("ordem").limit(500));
        });
      }
      return r;
    }).then(function (r) { if (r.error) throw r.error; dados = r.data || []; semTabela = false; })
      .catch(function (e) {
        dados = PADRAO.map(function (x, i) { return { id: "p" + i, grupo: x[0], rotulo: x[1], valor: x[2], ordem: x[3], padrao: true }; });
        semTabela = semT(e); if (!semTabela) A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro");
      }).then(depois);
  }

  function ver(c, ctx) {
    P = ctx;
    if (dados === null) { c.innerHTML = '<div class="cartao vazio">Carregando os dados da empresa...</div>'; carregar(function () { ver(c, P); }); return; }
    var b = String(filtro || "").toLowerCase().trim();
    var ls = dados.filter(function (x) { return !b || (x.rotulo + " " + x.valor + " " + x.grupo).toLowerCase().indexOf(b) >= 0; });
    var grupos = GRUPOS.concat(dados.map(function (x) { return x.grupo; }).filter(function (g, i, a) { return GRUPOS.indexOf(g) < 0 && a.indexOf(g) === i; }));
    c.innerHTML = '<div class="cab-secao"><h2>🏢 Dados da empresa</h2><span><button class="prim" id="em-novo">+ Novo dado</button> <button id="em-tudo">📋 Copiar tudo</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Um lugar só com as informações da firma, para consultar e <b>copiar</b> sem ficar procurando. <b>Não guarde senhas aqui.</b></p>' +
      (semTabela ? '<div class="aviso">Para guardar e editar, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>empresa_dados</b>). Enquanto isso, esta tela mostra os dados já conhecidos, só para copiar.</div>' : "") +
      '<input id="em-busca" type="search" placeholder="🔍 Buscar (ex.: inscrição, CNPJ, banco)" style="margin-bottom:8px">' +
      grupos.map(function (g) {
        var gs = ls.filter(function (x) { return x.grupo === g; }); if (!gs.length) return "";
        return '<h3 style="margin:14px 0 4px">' + esc(g) + '</h3><div class="cartao tabela-caixa"><table><tbody>' + gs.map(function (x) {
          return '<tr><td style="width:34%"><b>' + esc(x.rotulo) + '</b></td><td style="word-break:break-word">' + (/^https?:\/\//.test(x.valor || "") ? '<a href="' + esc(x.valor) + '" target="_blank" rel="noopener">' + esc(x.valor) + "</a>" : esc(x.valor || "—")) +
            '</td><td style="white-space:nowrap"><button class="peq" data-em-cp="' + x.id + '">📋 Copiar</button>' + (semTabela ? "" : ' <button class="peq" data-em-ed="' + x.id + '">✏</button>') + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      }).join("") + (ls.length ? "" : '<div class="cartao vazio">Nada com essa busca.</div>');
    $("#em-busca", c).value = filtro;
    $("#em-busca", c).oninput = function () { filtro = this.value; var pos = this.selectionStart; ver(c, P); var n = $("#em-busca", c); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* sem seleção */ } };
    $("#em-novo", c).onclick = function () { if (semTabela) { A.avisar("Rode o supabase.sql no Supabase para poder editar.", "erro"); return; } form(c, null); };
    $("#em-tudo", c).onclick = function () {
      copiar(((A.CFG.EMPRESA || {}).nome || "AGE") + " — dados da empresa\n" + grupos.map(function (g) {
        var gs = dados.filter(function (x) { return x.grupo === g; }); return gs.length ? "\n" + g + "\n" + gs.map(function (x) { return x.rotulo + ": " + (x.valor || ""); }).join("\n") : "";
      }).join("\n"), "Todos os dados copiados");
    };
    $$("[data-em-cp]", c).forEach(function (bt) { bt.onclick = function () { var x = dados.filter(function (y) { return String(y.id) === bt.dataset.emCp; })[0]; copiar(x.valor || "", x.rotulo + " copiado"); }; });
    $$("[data-em-ed]", c).forEach(function (bt) { bt.onclick = function () { form(c, dados.filter(function (y) { return String(y.id) === bt.dataset.emEd; })[0]); }; });
  }

  function form(c, x) {
    var j = A.janela('<label for="ef2-g">Grupo</label><select id="ef2-g">' + GRUPOS.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + "</option>"; }).join("") + "</select>" +
      '<label for="ef2-r">Nome do dado *</label><input id="ef2-r" maxlength="80" placeholder="Ex.: Inscrição estadual">' +
      '<label for="ef2-v">Valor</label><textarea id="ef2-v" rows="3" maxlength="1000"></textarea>' +
      '<p class="mudo peq">Não coloque senhas nem chaves secretas.</p>' +
      '<div class="acoes"><button class="prim" id="ef2-ok">Salvar</button>' + (x ? '<button class="perigo" id="ef2-del">Apagar</button>' : "") + "</div>", { titulo: x ? "Editar dado" : "Novo dado", semRascunho: true }), el = j.el;
    $("#ef2-g", el).value = x ? x.grupo : "Outros"; $("#ef2-r", el).value = x ? x.rotulo : ""; $("#ef2-v", el).value = x ? x.valor || "" : "";
    function fim(r) { if (r && r.error) throw r.error; dados = null; j.fechar(); ver(c, P); }
    $("#ef2-ok", el).onclick = function () {
      var r = $("#ef2-r", el).value.trim(); if (!r) { A.avisar("Dê um nome ao dado.", "erro"); return; }
      var d = { grupo: $("#ef2-g", el).value, rotulo: r, valor: $("#ef2-v", el).value.trim() || null, atualizado_em: new Date().toISOString() };
      Promise.resolve(x ? P.sb.from("empresa_dados").update(d).eq("id", x.id) : P.sb.from("empresa_dados").insert(Object.assign(d, { ordem: 100 }))).then(fim)
        .catch(function (e) { A.avisar(/duplicate|unique|23505/i.test(String((e && (e.message || e.code)) || e)) ? "Já existe um dado com esse nome nesse grupo." : (A.msgErro ? A.msgErro(e) : e.message), "erro"); });
    };
    if (x) $("#ef2-del", el).onclick = function () { if (!A.confirmar("Apagar “" + x.rotulo + "”?")) return; Promise.resolve(P.sb.from("empresa_dados").delete().eq("id", x.id)).then(fim).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); }); };
  }

  window.AGE_EMPRESA = { ver: ver, recarregar: function () { dados = null; } };
})();
