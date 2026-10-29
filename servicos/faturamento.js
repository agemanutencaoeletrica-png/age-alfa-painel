// Painel do dono — 💼 NOTAS E RESULTADO: notas fiscais de serviço emitidas aos clientes (a receber / recebido) e o
// resultado de cada obra/cliente: quanto entrou (notas) menos o que saiu em material, mão de obra e despesas avulsas.
// A obra/cliente é a mesma das Compras ("Para onde foi") e dos Pagamentos ("Obra / cliente"): uma obra do app ou um nome (ex.: DEVA).
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { aba: "notas", periodo: "ano", busca: "", sit: "" };

  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }
  function num2(v) { return v || v === 0 ? Number(v).toFixed(2).replace(".", ",") : ""; }
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function norm(t) { return semAcento(t).replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\b(ltda|me|epp|eireli|sa|s a)\b/g, " ").replace(/\s+/g, " ").trim(); }
  function dig(t) { return String(t || "").replace(/\D/g, ""); }
  function fmtCnpj(t) { var d = dig(t); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : String(t || ""); }

  // ---------------- valores da nota: bruto, impostos e o que ficou ----------------
  // retenções que o tomador desconta na nota (ele paga ao governo) e o imposto que a AGE paga (DAS / Simples Nacional)
  var RET = [["iss", "ISS retido"], ["inss", "INSS"], ["ir", "IR"], ["pis", "PIS"], ["cofins", "COFINS"], ["csll", "CSLL"], ["outras", "Outras retenções"]];
  var CHAVE_ALIQ = "age_aliq_imposto";
  function aliqGuardada() { try { return localStorage.getItem(CHAVE_ALIQ) || ""; } catch (e) { return ""; } }
  // valor (coluna) = líquido recebido; notas antigas sem bruto: bruto = líquido
  // "ISS 2,7%" / "ISS + INSS": o que foi retido na nota
  function descRet(n) {
    var r = n.retencoes || {}, b = Number(n.valor_bruto) || 0;
    return RET.filter(function (x) { return Number(r[x[0]]) > 0; }).map(function (x) { var nm = x[1].replace(" retido", "").replace("Outras retenções", "outras"); return nm + (b ? " " + pct(Number(r[x[0]]) / b * 100) : ""); }).join(" + ");
  }
  function contas(n) {
    var r = n.retencoes || {}, ret = RET.reduce(function (t, x) { return t + (Number(r[x[0]]) || 0); }, 0);
    var liq = Number(n.valor) || 0, bruto = Number(n.valor_bruto) || liq + ret, emp = Number(n.imposto_empresa) || 0;
    return { bruto: bruto, ret: ret, liq: liq, emp: emp, imp: ret + emp, ficou: liq - emp };
  }
  function soma(ns) {
    return ns.reduce(function (t, n) {
      var c = contas(n); t.bruto += c.bruto; t.ret += c.ret; t.liq += c.liq; t.emp += c.emp; t.imp += c.imp; t.ficou += c.ficou;
      if (!n.recebido) { t.areceber += c.liq; t.nAr++; } else { t.recebido += Number(n.valor_recebido) || c.liq; t.nRec++; }
      return t;
    }, { bruto: 0, ret: 0, liq: 0, emp: 0, imp: 0, ficou: 0, areceber: 0, recebido: 0, nAr: 0, nRec: 0 });
  }
  // grava a nota; banco ainda sem as colunas novas (recebimento/avulso): grava sem elas e avisa para rodar o SQL
  var NOVAS = ["comprovante_receb", "valor_recebido", "chave_nfse", "avulso"];
  function gravarReceita(id, dados) {
    var ir = function (d) { return P.q(id ? P.sb.from("receitas").update(d).eq("id", id).select().single() : P.sb.from("receitas").insert(d).select().single()); };
    return ir(dados).catch(function (e) {
      var m = A.msgErro(e);
      if (!NOVAS.some(function (k) { return m.indexOf(k) >= 0; })) throw e;
      var d2 = Object.assign({}, dados); NOVAS.forEach(function (k) { delete d2[k]; });
      if (dados.avulso) d2.retencoes = Object.assign({}, d2.retencoes || {}, { avulso: true });
      A.avisar("Salvo, mas rode de novo o supabase.sql no Supabase para guardar o comprovante do depósito e o recebimento avulso.", "erro");
      return ir(d2);
    });
  }
  function ehAvulso(n) { return !!(n.avulso || (n.retencoes && n.retencoes.avulso)); }
  // empresa (tomador) da nota: pelo CNPJ, senão pelo nome
  function empresaDe(n) { return n.cliente || rotuloDe(n) || "Sem empresa"; }
  function chaveEmpresa(n) { var d = dig(n.tomador_cnpj); return d.length >= 11 ? "c:" + d : "n:" + norm(empresaDe(n)); }

  // ---------------- obra / cliente (centro de custo) ----------------
  function rotuloObra(o) { return o.cliente + (o.chamado ? " · chamado " + o.chamado : ""); }
  function obraPorTexto(t) { t = String(t || "").trim(); return t ? (P.S.obras || []).filter(function (o) { return rotuloObra(o) === t; })[0] || null : null; }
  // texto digitado -> { obra_id, destino }
  function resolver(t) { var o = obraPorTexto(t); return o ? { obra_id: o.id, destino: null } : { obra_id: null, destino: String(t || "").trim() || null }; }
  function rotuloDe(x) { var o = x && x.obra_id ? P.porId(P.S.obras, x.obra_id) : null; return o ? rotuloObra(o) : (x && x.destino) || ""; }
  // chave do resultado: a obra do app, ou o nome escrito (sem diferença de maiúscula/acento/parênteses: "DEVA IVECO (contagem)" = "Deva Iveco")
  function chave(x) { var o = x && x.obra_id ? P.porId(P.S.obras, x.obra_id) : null; if (o) return "o:" + o.id; var n = norm(x && x.destino); return n ? "d:" + n : ""; }
  function opcoes() {
    var v = {};
    (P.S.obras || []).slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).slice(0, 400).forEach(function (o) { v[rotuloObra(o)] = 1; });
    [].concat(P.S.compras || [], P.S.pag || [], P.S.receitas || []).forEach(function (x) { if (x.destino) v[x.destino] = 1; });
    return Object.keys(v);
  }
  function datalist(id) { return '<datalist id="' + id + '">' + opcoes().map(function (t) { return '<option value="' + esc(t) + '">'; }).join("") + "</datalist>"; }

  // DANFSe do padrão nacional (v1/v2): cada campo é um rótulo com o valor logo abaixo, em grade. Lê pela posição na página.
  function lerDanfseNacional(pecas) {
    var P2 = (pecas || []).filter(function (p) { return String(p.s).trim(); }).map(function (p) { return { s: String(p.s).trim(), x: p.x, y: p.y, w: p.w || 0 }; });
    if (!P2.some(function (p) { return /^DANFSe|documento auxiliar da nfs-?e/i.test(p.s); })) return null;
    var rot = function (re, abaixoDe, acimaDe) {
      return P2.filter(function (p) { return re.test(p.s) && (abaixoDe == null || p.y < abaixoDe) && (acimaDe == null || p.y > acimaDe); }).sort(function (a, b) { return b.y - a.y; })[0] || null;
    };
    // valor do campo: o texto logo abaixo do rótulo, começando na mesma coluna
    var abaixo = function (r) {
      if (!r) return "";
      var c = P2.filter(function (p) { return p.y < r.y - 2 && r.y - p.y < 16 && Math.abs(p.x - r.x) < 12; }).sort(function (a, b) { return b.y - a.y; });
      return c.length ? c[0].s : "";
    };
    var abaixoTudo = function (r, ate) {   // nome em 2 linhas ("... CONSTRUCAO" / "CIVIL LTDA")
      if (!r) return "";
      var c = P2.filter(function (p) { return p.y < r.y - 2 && r.y - p.y < (ate || 24) && Math.abs(p.x - r.x) < 12; }).sort(function (a, b) { return b.y - a.y; });
      var out = [];
      c.some(function (p) { if (/^(endere[cç]o|e-?mail|munic[ií]pio|cnpj|cpf|telefone|indicador|nome|c[oó]digo|cep)\b/i.test(p.s)) return true; out.push(p.s); return false; });   // para no próximo rótulo
      return out.join(" ");
    };
    var din = function (t) { var m = String(t || "").match(/\d{1,3}(?:\.\d{3})*,\d{2}/); return m ? A.lerNumero(m[0]) : 0; };
    var r = { nacional: true };
    var tom = rot(/^TOMADOR\s*\/\s*ADQUIRENTE/i), serv = rot(/^SERVI[CÇ]O PRESTADO/i), prest = rot(/^PRESTADOR\s*\/\s*FORNECEDOR/i);
    var nu = abaixo(rot(/^N[ÚU]MERO DA NFS-?e/i)); if (/^\d+$/.test(nu)) r.numero = String(Number(nu));
    var de = abaixo(rot(/^DATA E HORA DA EMISS[ÃA]O DA NFS-?e/i)) || abaixo(rot(/^COMPET[ÊE]NCIA DA NFS-?e/i)), md = de.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (md) r.data = md[3] + "-" + md[2] + "-" + md[1];
    var ch = abaixo(rot(/^CHAVE DE ACESSO DA NFS-?e/i)).replace(/\D/g, ""); if (ch.length >= 44) r.chave = ch;
    if (tom) {
      var nomeT = abaixoTudo(rot(/^Nome\s*\/\s*Nome Empresarial/i, tom.y, serv ? serv.y : null));
      if (nomeT) r.tomador = nomeT.replace(/\s+/g, " ").slice(0, 160);
      var cn = abaixo(rot(/^CNPJ\s*\/\s*CPF/i, tom.y + 3, tom.y - 30)).replace(/\D/g, ""); if (cn.length === 14 || cn.length === 11) r.cnpj = cn;
      var mun = abaixo(rot(/^Munic[ií]pio\s*\/\s*Sigla UF/i, tom.y, serv ? serv.y : null)); if (mun) r.municipio = mun;
    }
    if (prest) { var cp = abaixo(rot(/^CNPJ\s*\/\s*CPF/i, prest.y + 3, prest.y - 30)).replace(/\D/g, ""); if (cp) r.prestadorCnpj = cp; }
    var ds = abaixo(rot(/^Descri[cç][aã]o do Servi[cç]o/i)); if (ds) r.descricao = ds.slice(0, 300);
    r.bruto = din(abaixo(rot(/^VALOR DA OPERA[CÇ][AÃ]O\s*\/\s*SERVI[CÇ]O/i))) || din(abaixo(rot(/^VALOR TOTAL DA NFS-?e/i))) || null;
    r.valor = din(abaixo(rot(/^VALOR L[ÍI]QUIDO DA NFS-?e$/i))) || null;
    var aliq = abaixo(rot(/^Al[ií]quota Aplicada/i)).match(/(\d+(?:,\d+)?)\s*%/); if (aliq) r.aliqIss = A.lerNumero(aliq[1]);
    var ret = {};
    var issRet = /retido/i.test(abaixo(rot(/^Reten[cç][aã]o do ISSQN/i))) && !/n[aã]o\s+retido/i.test(abaixo(rot(/^Reten[cç][aã]o do ISSQN/i)));
    if (issRet) ret.iss = din(abaixo(rot(/^ISSQN Apurado/i)));
    var irrf = din(abaixo(rot(/^IRRF$/i))); if (irrf) ret.ir = irrf;
    var cp2 = din(abaixo(rot(/^Contribui[cç][aã]o Previdenci[aá]ria\s*-\s*Retida/i))); if (cp2) ret.inss = cp2;
    var cs = din(abaixo(rot(/^Contribui[cç][oõ]es Sociais\s*-\s*Retidas/i))); if (cs) ret.outras = cs;   // PIS/COFINS/CSLL retidos juntos
    var desc = din(abaixo(rot(/^Desconto Incondicionado/i))) + din(abaixo(rot(/^Desconto Condicionado/i))); if (desc) ret.outras = Math.round(((ret.outras || 0) + desc) * 100) / 100;
    r.retencoes = ret;
    r.totalRet = din(abaixo(rot(/^Total das Reten[cç][oõ]es/i)));
    if (r.bruto && !r.valor) r.valor = Math.round((r.bruto - Object.keys(ret).reduce(function (t, k) { return t + ret[k]; }, 0)) * 100) / 100;
    return r.valor || r.bruto ? r : null;
  }
  // ---------------- leitura da nota fiscal de serviço (NFS-e: foto, PDF ou XML) ----------------
  function lerNFSe(texto, pecas) {
    var nac = pecas ? lerDanfseNacional(pecas) : null;
    if (nac) return nac;
    var t = String(texto || "").replace(/\r/g, ""), r = {};
    if (/<\s*(?:\w+:)?(?:CompNfse|Nfse|InfNfse|ValorServicos)\b/i.test(t)) {   // XML (padrão ABRASF)
      var tag = function (n) { var m = t.match(new RegExp("<\\s*(?:\\w+:)?" + n + "\\b[^>]*>([^<]*)<", "i")); return m ? m[1].trim() : ""; };
      r.bruto = Number(tag("ValorServicos") || tag("vServ")) || null;
      r.valor = Number(tag("ValorLiquidoNfse") || tag("vLiq")) || r.bruto;
      var nx = function (n) { return Number(tag(n)) || 0; };
      var issRet = tag("IssRetido") === "1" || tag("tpRetISSQN") === "2";
      r.retencoes = { iss: nx("ValorIssRetido") || (issRet ? nx("ValorIss") || nx("vISSQN") : 0), inss: nx("ValorInss") || nx("vRetCP"), ir: nx("ValorIr") || nx("vRetIRRF"),
        pis: nx("ValorPis"), cofins: nx("ValorCofins"), csll: nx("ValorCsll") || nx("vRetCSLL") };
      var mc = t.match(/<\s*(?:\w+:)?(?:Tomador|TomadorServico|toma)\b[\s\S]*?<\s*(?:\w+:)?(?:Cnpj|CNPJ|Cpf|CPF)\b[^>]*>(\d{11,14})</i);
      if (mc) r.cnpj = mc[1];
      r.numero = tag("Numero") ? String(Number(tag("Numero")) || tag("Numero")) : "";
      r.data = (tag("DataEmissao") || tag("DataEmissaoRps")).slice(0, 10);
      var mt = t.match(/<\s*(?:\w+:)?(?:Tomador|TomadorServico|toma)\b[\s\S]*?<\s*(?:\w+:)?(?:RazaoSocial|xNome)\b[^>]*>([^<]*)</i);
      r.tomador = mt ? mt[1].trim() : "";
      r.descricao = tag("Discriminacao").slice(0, 300);
      return r;
    }
    var ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    var vals = function (x) { return (String(x).match(/\d{1,3}(?:\.\d{3})*,\d{2}(?![\d\/])/g) || []).map(A.lerNumero).filter(function (n) { return n > 0; }); };
    var rot = /valor\s+l[ií]quido(?:\s+da\s+nota)?|valor\s+(?:total\s+)?(?:do|dos)\s+servi[cç]os?|valor\s+total\s+da\s+nota|valor\s+da\s+nota|total\s+da\s+nota|valor\s+total/i;
    var achou = null;
    ls.forEach(function (x, i) {
      if (achou !== null || !rot.test(x)) return;
      var v = vals(x.slice(x.search(rot)));
      if (!v.length && ls[i + 1]) v = vals(ls[i + 1]);
      if (v.length) achou = v[v.length - 1];
    });
    if (achou === null) { var tod = vals(t); if (tod.length) { achou = Math.max.apply(null, tod); r.valorIncerto = true; } }
    r.valor = achou;
    var mn = t.match(/n[uú]mero\s+da\s+(?:nfs-?e|nota)[^\d]{0,14}(\d{1,15})/i) || t.match(/nfs-?e\s*(?:n[º°o.]|n[uú]mero)?\s*:?\s*(\d{1,15})/i) || t.match(/\bn[º°o]\s*:?\s*(\d{2,15})/i);
    if (mn) r.numero = String(Number(mn[1]));
    var reD = /(\d{2})\/(\d{2})\/(\d{4})/g, md, ds = [];
    while ((md = reD.exec(t))) { var mes = Number(md[2]), dia = Number(md[1]), ano = Number(md[3]); if (ano >= 2020 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) ds.push({ iso: md[3] + "-" + md[2] + "-" + md[1], em: /emiss|compet/i.test(t.slice(Math.max(0, md.index - 50), md.index)) }); }
    var dE = ds.filter(function (x) { return x.em; })[0] || ds[0];
    if (dE) r.data = dE.iso;
    // tomador: o nome depois de "TOMADOR" (a razão social), sem os rótulos
    var iT = -1;
    for (var i = 0; i < ls.length; i++) if (/tomador/i.test(ls[i])) { iT = i; break; }
    if (iT >= 0) for (var k = iT; k < Math.min(ls.length, iT + 6) && !r.tomador; k++) {
      var x2 = ls[k].replace(/.*?(?:raz[aã]o\s+social|nome(?:\s*\/\s*(?:raz[aã]o\s+social|nome\s+empresarial))?|nome\s+empresarial)\s*:?\s*/i, k === iT && !/raz[aã]o|nome/i.test(ls[k]) ? "\u0000" : "");
      if (x2.indexOf("\u0000") >= 0) continue;
      x2 = x2.replace(/\b(cpf|cnpj|inscri|endere|munic|telefone|e-?mail)\b.*$/i, "").trim();
      if (/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(x2) && !/tomador|prestador/i.test(x2)) r.tomador = x2.slice(0, 120);
    }
    var mdesc = t.match(/discrimina[cç][aã]o\s+(?:dos\s+)?servi[cç]os?\s*:?\s*\n?([^\n]{5,300})/i);
    if (mdesc) r.descricao = mdesc[1].trim();
    // CNPJ do tomador: o primeiro depois de "TOMADOR" (fora o da própria AGE)
    var meu = dig((A.CFG.EMPRESA || {}).documento), reC = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g;
    if (iT >= 0) for (var c2 = iT; c2 < Math.min(ls.length, iT + 9) && !r.cnpj; c2++) (ls[c2].match(reC) || []).forEach(function (x) { if (!r.cnpj && dig(x) !== meu) r.cnpj = dig(x); });
    // valor bruto (dos serviços) e líquido
    var valsTodos = function (x) { return (String(x).match(/\d{1,3}(?:\.\d{3})*,\d{2}(?![\d\/])/g) || []).map(A.lerNumero); };
    var depoisDe = function (re) {
      for (var i2 = 0; i2 < ls.length; i2++) {
        var m2 = ls[i2].match(re); if (!m2) continue;
        var v2 = valsTodos(ls[i2].slice(m2.index + m2[0].length)).filter(function (n) { return n > 0; });
        if (!v2.length && ls[i2 + 1]) v2 = valsTodos(ls[i2 + 1]).filter(function (n) { return n > 0; });
        if (v2.length) return v2[0];
      }
      return null;
    };
    r.bruto = depoisDe(/valor\s+(?:total\s+)?(?:bruto|d[oa]s?\s+servi[cç]os?|do\s+servi[cç]o)/i);
    var liq = depoisDe(/valor\s+l[ií]quido/i);
    if (liq) { r.valor = liq; r.valorIncerto = false; }
    // retenções: "INSS 0,00" na mesma linha, ou os rótulos numa linha e os valores na de baixo (na mesma ordem)
    var defs = [["inss", /\b(?:inss|ret\.?\s*cp|cp(?:\s+retid[oa])?|contribui[cç][aã]o\s+previdenci[aá]ria)\b/i], ["ir", /\b(?:irrf|ir(?:pj)?)\b(?!\s*isento)/i], ["pis", /\bpis(?:\/pasep)?\b/i],
      ["cofins", /\bcofins\b/i], ["csll", /\bcsll\b/i], ["iss", /\biss(?:qn)?\s+retido\b|reten[cç][aã]o\s+(?:do\s+)?iss/i]];
    var ret = {};
    ls.forEach(function (x, i) {
      var achados = defs.map(function (d) { var m3 = x.match(d[1]); return m3 ? { k: d[0], pos: m3.index, fim: m3.index + m3[0].length } : null; }).filter(Boolean).sort(function (a, b) { return a.pos - b.pos; });
      if (!achados.length) return;
      var vl = valsTodos(x);
      if (achados.length > 1 && !vl.length && ls[i + 1]) { vl = valsTodos(ls[i + 1]); if (vl.length === achados.length) achados.forEach(function (a, n) { if (ret[a.k] === undefined) ret[a.k] = vl[n]; }); return; }
      if (achados.length === 1) { var v3 = valsTodos(x.slice(achados[0].fim)); if (v3.length && ret[achados[0].k] === undefined) ret[achados[0].k] = v3[0]; return; }
      if (vl.length === achados.length) achados.forEach(function (a, n) { if (ret[a.k] === undefined) ret[a.k] = vl[n]; });
    });
    r.retencoes = ret;
    return r;
  }
  // tomador da nota -> obra/cliente já usado (pela 1ª palavra forte do nome: "DEVA VEICULOS LTDA" -> "DEVA IVECO (contagem)")
  function sugerirObra(tomador) {
    var pal = norm(tomador).split(" ").filter(function (w) { return w.length >= 4 && !/^(comercio|comercial|servicos|industria|empresa|brasil|distribuidora|veiculos|supermercados?)$/.test(w); });
    if (!pal.length) return "";
    return opcoes().filter(function (o) { var n = norm(o); return pal.some(function (w) { return (" " + n + " ").indexOf(" " + w + " ") >= 0; }); })[0] || "";
  }

  // ---------------- tela ----------------
  function periodo() {
    var h = new Date(), ini, fim = null;
    if (filtro.periodo === "mes") ini = new Date(h.getFullYear(), h.getMonth(), 1);
    else if (filtro.periodo === "mespassado") { ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); fim = new Date(h.getFullYear(), h.getMonth(), 1); }
    else if (filtro.periodo === "ano") ini = new Date(h.getFullYear(), 0, 1);
    else ini = new Date(2000, 0, 1);
    return { de: A.isoLocal(ini), ate: fim ? A.isoLocal(fim) : "9999-12-31" };
  }
  function ver(c, ctx) {
    P = ctx;
    if (P.S.semReceitas) {
      c.innerHTML = '<div class="cab-secao"><h2>💼 Notas e resultado</h2></div><div class="aviso">Para usar esta parte, rode no Supabase o bloco <b>“Notas de serviço”</b> do <b>supabase.sql</b> e depois <code>notify pgrst, \'reload schema\';</code>' +
        (P.S.erroReceitas ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroReceitas) + "</div>" : "") + "</div>";
      return;
    }
    c.innerHTML = '<div class="cab-secao"><h2>💼 Notas e resultado</h2><span><button class="prim" id="ft-arq-b">📷 Nota de serviço</button> <button id="ft-dep">💰 Recebi um depósito</button> <button id="ft-mao">➕ Lançar à mão</button></span></div>' +
      '<input type="file" id="ft-arq" accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml,.zip,application/zip" multiple class="oculto">' +
      '<p class="mudo peq" style="margin-top:-4px">Lance a nota fiscal de serviço que você emitiu (foto, PDF ou XML da prefeitura). Em <b>Resultado por obra</b>: o que entrou menos material, mão de obra e despesas avulsas.</p>' +
      '<div class="filtros">' + [["notas", "🧾 Notas de serviço"], ["empresas", "🏢 Por empresa"], ["resultado", "📊 Resultado por obra"]].map(function (x) { return '<button class="' + (filtro.aba === x[0] ? "prim" : "") + '" data-ftaba="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="filtros"><select id="ft-per" aria-label="Período"><option value="mes">Este mês</option><option value="mespassado">Mês passado</option><option value="ano">Este ano</option><option value="tudo">Tudo</option></select>' +
      (filtro.aba !== "resultado" ? '<select id="ft-sit" aria-label="Situação"><option value="">Todas</option><option value="areceber">⏳ A receber</option><option value="recebido">✅ Recebidas</option></select>' : "") +
      '<input type="search" id="ft-busca" placeholder="Buscar cliente, obra, nº da nota..."></div><div id="ft-res"></div>';
    $("#ft-per").value = filtro.periodo; if ($("#ft-sit")) $("#ft-sit").value = filtro.sit; $("#ft-busca").value = filtro.busca;
    $$("[data-ftaba]", c).forEach(function (b) { b.onclick = function () { filtro.aba = b.dataset.ftaba; ver(c, P); }; });
    $("#ft-per").onchange = function () { filtro.periodo = this.value; desenhar(); };
    if ($("#ft-sit")) $("#ft-sit").onchange = function () { filtro.sit = this.value; desenhar(); };
    $("#ft-busca").oninput = function () { filtro.busca = this.value; desenhar(); };
    $("#ft-arq-b").onclick = function () { $("#ft-arq").value = ""; $("#ft-arq").click(); };
    $("#ft-arq").onchange = function () {
      if (!this.files.length) return;
      A.abrirZips(this.files).then(function (fs) {
        if (!fs.length) { A.avisar("O ZIP não tem fotos, PDF nem XML de nota.", "erro"); return; }
        // várias notas: uma depois da outra
        var proxima = function () { var f = fs.shift(); if (f) receber(f, function () { if (fs.length) proxima(); else ver(c, P); }); else ver(c, P); };
        proxima();
      }).catch(function (e) { A.avisar(A.msgErro(e), "erro"); });
    };
    $("#ft-mao").onclick = function () { formulario({}, function () { ver(c, P); }); };
    $("#ft-dep").onclick = function () { deposito(function () { ver(c, P); }); };
    if (P.atualizarAbas) P.atualizarAbas();
    desenhar();
    function desenhar() {
      var r = $("#ft-res"), m = function () { ver(c, P); };
      if (filtro.aba === "resultado") resultado(r, m); else if (filtro.aba === "empresas") empresas(r, m, c); else notas(r, m);
    }
  }
  function notasFiltradas() {
    var pr = periodo(), b = semAcento(filtro.busca);
    return P.S.receitas.filter(function (n) {
      if (n.emitida_em < pr.de || n.emitida_em >= pr.ate) return false;
      if (filtro.sit === "areceber" && n.recebido) return false;
      if (filtro.sit === "recebido" && !n.recebido) return false;
      return !b || semAcento([rotuloDe(n), n.cliente, n.numero_nota, n.descricao, n.tomador_cnpj].join(" ")).indexOf(b) >= 0 || (dig(b).length >= 4 && dig(n.tomador_cnpj).indexOf(dig(b)) >= 0);
    }).sort(function (a, c) { return c.emitida_em.localeCompare(a.emitida_em); });
  }
  function ladrilhos(T, qtd) {
    return '<div class="grade"><div class="ladrilho" style="border-left:4px solid var(--prim)"><div class="r">Valor bruto emitido</div><div class="v" style="font-size:1.3em">' + dinheiro(T.bruto) + '</div><div class="d">' + qtd + " nota" + (qtd === 1 ? "" : "s") + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--critico)"><div class="r">Impostos</div><div class="v" style="font-size:1.3em">' + dinheiro(T.imp) + '</div><div class="d">retidos ' + dinheiro(T.ret) + " · da empresa " + dinheiro(T.emp) + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--bom)"><div class="r">💰 Ficou para a empresa</div><div class="v" style="font-size:1.3em">' + dinheiro(T.ficou) + '</div><div class="d">' + (T.bruto ? pct(T.ficou / T.bruto * 100) + " do bruto" : "") + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--atencao)"><div class="r">⏳ A receber</div><div class="v" style="font-size:1.3em">' + dinheiro(T.areceber) + '</div><div class="d">' + T.nAr + " nota" + (T.nAr === 1 ? "" : "s") + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--bom)"><div class="r">✅ Recebido</div><div class="v" style="font-size:1.3em">' + dinheiro(T.recebido) + '</div><div class="d">' + T.nRec + " nota" + (T.nRec === 1 ? "" : "s") + "</div></div></div>";
  }
  function botoesExportar() {
    return '<div class="acoes"><button id="ft-n-pdf">📄 Relatório PDF</button><button id="ft-n-csv">⬇ Planilha (CSV)</button></div>';
  }
  function ligarExportar(r, ns) {
    if ($("#ft-n-pdf", r)) $("#ft-n-pdf", r).onclick = function () { pdfNotas(ns, this); };
    if ($("#ft-n-csv", r)) $("#ft-n-csv", r).onclick = function () { csvNotas(ns); };
  }
  function notas(r, mudou) {
    var ns = notasFiltradas(), T = soma(ns);
    r.innerHTML = ladrilhos(T, ns.length) +
      (ns.length ? '<div class="tabela-caixa"><table><thead><tr><th>Emissão</th><th>Nº</th><th>Empresa / obra</th><th class="num">Bruto</th><th class="num">Descontado na nota</th><th class="num">Líquido a receber</th><th class="num">Ficou</th><th>Situação</th><th></th></tr></thead><tbody>' +
        ns.map(function (n) {
          var c = contas(n);
          return "<tr><td>" + esc(A.dataSimples(n.emitida_em)) + "</td><td>" + (ehAvulso(n) ? '<span class="selo">avulso</span>' : esc(n.numero_nota || "—")) + "</td><td><b>" + esc(empresaDe(n)) + "</b>" +
            (n.tomador_cnpj ? '<div class="peq mudo">' + esc(fmtCnpj(n.tomador_cnpj)) + "</div>" : "") +
            (rotuloDe(n) && rotuloDe(n) !== empresaDe(n) ? '<div class="peq mudo">📍 ' + esc(rotuloDe(n)) + "</div>" : "") +
            (n.descricao ? '<div class="peq mudo">' + esc(String(n.descricao).slice(0, 90)) + "</div>" : "") +
            '</td><td class="num">' + dinheiro(c.bruto) + '</td><td class="num">' + (c.ret ? dinheiro(c.ret) + '<div class="peq mudo">' + pct(c.ret / c.bruto * 100) + " · " + esc(descRet(n)) + "</div>" : '<span class="mudo">—</span>') +
            '</td><td class="num"><b>' + dinheiro(c.liq) + "</b>" + (n.recebido && n.valor_recebido && Math.abs(Number(n.valor_recebido) - c.liq) >= 0.01 ? '<div class="peq">caiu ' + dinheiro(n.valor_recebido) + "</div>" : "") +
            '</td><td class="num">' + dinheiro(c.ficou) + (c.emp ? '<div class="peq mudo">DAS ' + dinheiro(c.emp) + "</div>" : "") + "</td><td>" +
            (n.recebido ? '<span class="selo bom">✅ recebido' + (n.recebido_em ? " " + esc(A.dataSimples(n.recebido_em)) : "") + "</span>" + (n.comprovante_receb ? ' <button class="peq" data-ft-comp="' + n.id + '" title="Comprovante do depósito">💰</button>' : "")
              : '<span class="selo atencao">⏳ a receber</span> <button class="peq" data-ft-rec="' + n.id + '">✔ Recebi</button>') +
            "</td><td>" + (n.arquivo ? '<button class="peq" data-ft-arq="' + n.id + '">🧾</button> ' : "") + '<button class="peq" data-ft-ed="' + n.id + '">Editar</button></td></tr>';
        }).join("") + '<tr><td colspan="3"><b>Total</b></td><td class="num"><b>' + dinheiro(T.bruto) + '</b></td><td class="num"><b>' + dinheiro(T.ret) + "</b>" + (T.bruto ? '<div class="peq">' + pct(T.ret / T.bruto * 100) + "</div>" : "") +
          '</td><td class="num"><b>' + dinheiro(T.liq) + '</b></td><td class="num"><b>' + dinheiro(T.ficou) + "</b></td><td></td><td></td></tr></tbody></table></div>" + botoesExportar()
        : '<div class="cartao vazio">Nenhuma nota de serviço neste período. Toque em 📷 Nota de serviço ou ➕ Lançar à mão.</div>');
    $$("[data-ft-ed]", r).forEach(function (bt) { bt.onclick = function () { formulario({ nota: P.porId(P.S.receitas, bt.dataset.ftEd) }, mudou); }; });
    $$("[data-ft-rec]", r).forEach(function (bt) {
      bt.onclick = function () {
        P.q(P.sb.from("receitas").update({ recebido: true, recebido_em: A.isoLocal(new Date()) }).eq("id", bt.dataset.ftRec).select().single())
          .then(function (n) { P.trocar(P.S.receitas, n); A.avisar("✅ Recebido: " + dinheiro(n.valor), "ok"); mudou(); }).catch(P.falhou);
      };
    });
    $$("[data-ft-arq]", r).forEach(function (bt) { bt.onclick = function () { abrirArquivo(P.porId(P.S.receitas, bt.dataset.ftArq).arquivo); }; });
    $$("[data-ft-comp]", r).forEach(function (bt) { bt.onclick = function () { abrirArquivo(P.porId(P.S.receitas, bt.dataset.ftComp).comprovante_receb); }; });
    ligarExportar(r, ns);
  }
  // ---------------- por empresa (tomador): soma tudo automático ----------------
  function porEmpresa(ns) {
    var g = {};
    ns.slice().sort(function (a, b) { return b.emitida_em.localeCompare(a.emitida_em); }).forEach(function (n) {
      var k = chaveEmpresa(n), x = g[k] = g[k] || { nome: empresaDe(n), cnpj: n.tomador_cnpj || "", notas: [] };
      if (!x.cnpj && n.tomador_cnpj) x.cnpj = n.tomador_cnpj;
      x.notas.push(n);
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.T = soma(x.notas); return x; }).sort(function (a, b) { return b.T.bruto - a.T.bruto; });
  }
  function empresas(r, mudou, c) {
    var ns = notasFiltradas(), T = soma(ns), es = porEmpresa(ns);
    r.innerHTML = ladrilhos(T, ns.length) +
      (es.length ? '<div class="tabela-caixa"><table><thead><tr><th>Empresa</th><th class="num">Notas</th><th class="num">Bruto</th><th class="num">Impostos</th><th class="num">Líquido recebido</th><th class="num">Ficou</th><th class="num">A receber</th><th></th></tr></thead><tbody>' +
        es.map(function (x, i) {
          return "<tr><td><b>" + esc(x.nome) + "</b>" + (x.cnpj ? '<div class="peq mudo">' + esc(fmtCnpj(x.cnpj)) + "</div>" : "") + '</td><td class="num">' + x.notas.length +
            '</td><td class="num">' + dinheiro(x.T.bruto) + '</td><td class="num">' + dinheiro(x.T.imp) + '</td><td class="num">' + dinheiro(x.T.liq) + '</td><td class="num"><b>' + dinheiro(x.T.ficou) +
            '</b></td><td class="num">' + (x.T.areceber ? '<span class="selo atencao">' + dinheiro(x.T.areceber) + "</span>" : "—") + '</td><td><button class="peq" data-ft-emp="' + i + '">Ver notas</button></td></tr>';
        }).join("") + '<tr><td><b>Total</b></td><td class="num"><b>' + ns.length + '</b></td><td class="num"><b>' + dinheiro(T.bruto) + '</b></td><td class="num"><b>' + dinheiro(T.imp) + '</b></td><td class="num"><b>' + dinheiro(T.liq) +
        '</b></td><td class="num"><b>' + dinheiro(T.ficou) + '</b></td><td class="num"><b>' + dinheiro(T.areceber) + "</b></td><td></td></tr></tbody></table></div>" + botoesExportar()
        : '<div class="cartao vazio">Nenhuma nota de serviço neste período.</div>');
    $$("[data-ft-emp]", r).forEach(function (bt) {
      bt.onclick = function () { var x = es[Number(bt.dataset.ftEmp)]; filtro.aba = "notas"; filtro.busca = x.cnpj ? fmtCnpj(x.cnpj) : x.nome; ver(c, P); };
    });
    ligarExportar(r, ns);
  }
  // ---------------- exportar: PDF e planilha ----------------
  var NOME_PER = { mes: "este mês", mespassado: "mês passado", ano: "este ano", tudo: "todo o período" };
  function textoPeriodo() { return NOME_PER[filtro.periodo] + (filtro.sit === "areceber" ? " · a receber" : filtro.sit === "recebido" ? " · recebidas" : "") + (filtro.busca ? " · busca: " + filtro.busca : ""); }
  function csvNotas(ns) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var r2 = function (v) { return Number(v || 0).toFixed(2).replace(".", ","); };
    var linhas = [["Emissão", "Nº da nota", "Empresa (tomador)", "CNPJ", "Obra / cliente", "Serviço", "Valor bruto (R$)"].concat(RET.map(function (x) { return x[1] + " (R$)"; }),
      ["Total retido (R$)", "Líquido recebido (R$)", "Imposto da empresa (R$)", "Ficou para a empresa (R$)", "Situação", "Recebido em"])];
    ns.forEach(function (n) {
      var c = contas(n), rt = n.retencoes || {};
      linhas.push([A.dataSimples(n.emitida_em), n.numero_nota || "", empresaDe(n), fmtCnpj(n.tomador_cnpj), rotuloDe(n), n.descricao || "", r2(c.bruto)].concat(RET.map(function (x) { return r2(rt[x[0]]); }),
        [r2(c.ret), r2(c.liq), r2(c.emp), r2(c.ficou), n.recebido ? "recebido" : "a receber", n.recebido_em ? A.dataSimples(n.recebido_em) : ""]));
    });
    var T = soma(ns);
    linhas.push(["TOTAL", "", "", "", "", "", r2(T.bruto)].concat(RET.map(function () { return ""; }), [r2(T.ret), r2(T.liq), r2(T.emp), r2(T.ficou), "", ""]));
    var csv = "\ufeff" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "notas-emitidas-" + A.isoLocal(new Date()) + ".csv");
  }
  function tx(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[−–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[\u00a0\u202f]/g, " ").replace(/[^\x00-\xff]/g, "").trim();
  }
  function pdfNotas(ns, botao) {
    A.ocupado(botao, true, "Gerando...");
    P.carregarJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" }), L = 12, R = 285, y = 16, E = A.CFG.EMPRESA || {}, T = soma(ns);
      var din = function (v) { return tx(A.dinheiro(Number(v) || 0)); };
      function nova(alt) { if (y + alt > 192) { doc.addPage(); y = 16; return true; } return false; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(20, 50, 92); doc.text(tx(E.nome || "AGE Elétrica e Pintura"), L, y);
      doc.setFontSize(12); doc.setTextColor(20, 20, 20); doc.text("NOTAS FISCAIS EMITIDAS", R, y, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(tx([E.documento, E.telefone, E.email].filter(Boolean).join("  ·  ")), L, y + 5);
      doc.text(tx("Período: " + textoPeriodo()), R, y + 5, { align: "right" }); doc.text(tx("Emitido em " + A.data(new Date())), R, y + 9.6, { align: "right" });
      y += 13; doc.setDrawColor(20, 50, 92); doc.setLineWidth(0.7); doc.line(L, y, R, y); y += 7;
      // resumo
      var caixas = [["Valor bruto", T.bruto], ["Impostos retidos", T.ret], ["Imposto da empresa", T.emp], ["Ficou para a empresa", T.ficou], ["A receber", T.areceber], ["Recebido", T.recebido]], w = (R - L) / caixas.length;
      caixas.forEach(function (cx, i) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90); doc.text(tx(cx[0]), L + i * w + 1, y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20); doc.text(din(cx[1]), L + i * w + 1, y + 6);
      });
      y += 14;
      function tabela(titulo, cols, linhas, total) {
        nova(20); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 50, 92); doc.text(tx(titulo), L, y); y += 6;
        var cab = function () { doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(90); cols.forEach(function (c2) { doc.text(tx(c2[1]), c2[0], y, { align: c2[2] }); }); y += 2; doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4; doc.setTextColor(20, 20, 20); };
        cab();
        linhas.concat(total ? [total] : []).forEach(function (l, li) {
          var ult = total && li === linhas.length;
          doc.setFont("helvetica", ult ? "bold" : "normal"); doc.setFontSize(8.5);
          var partes = l.map(function (v, i) { return cols[i][3] ? doc.splitTextToSize(tx(v), cols[i][3]) : [tx(v)]; });
          var alt = Math.max.apply(null, partes.map(function (x) { return x.length; })) * 3.8 + 2;
          if (nova(alt)) cab();
          doc.setFont("helvetica", ult ? "bold" : "normal"); doc.setFontSize(8.5);
          partes.forEach(function (pt, i) { doc.text(pt, cols[i][0], y, { align: cols[i][2] }); });
          y += alt - 2; doc.setDrawColor(225); doc.setLineWidth(0.2); doc.line(L, y - 1.4, R, y - 1.4); y += 3;
        });
        y += 4;
      }
      var es = porEmpresa(ns);
      tabela("Por empresa", [[L + 1, "EMPRESA", "left", 90], [L + 95, "CNPJ", "left"], [152, "NOTAS", "right"], [180, "BRUTO", "right"], [205, "IMPOSTOS", "right"], [232, "LÍQUIDO", "right"], [258, "FICOU", "right"], [R - 1, "A RECEBER", "right"]],
        es.map(function (x) { return [x.nome, fmtCnpj(x.cnpj), String(x.notas.length), din(x.T.bruto), din(x.T.imp), din(x.T.liq), din(x.T.ficou), din(x.T.areceber)]; }),
        ["TOTAL", "", String(ns.length), din(T.bruto), din(T.imp), din(T.liq), din(T.ficou), din(T.areceber)]);
      tabela("Notas", [[L + 1, "EMISSÃO", "left"], [L + 20, "Nº", "left"], [L + 38, "EMPRESA / SERVIÇO", "left", 92], [170, "BRUTO", "right"], [193, "RETIDO", "right"], [216, "LÍQUIDO", "right"], [238, "IMP. EMPRESA", "right"], [260, "FICOU", "right"], [R - 1, "SITUAÇÃO", "right"]],
        ns.map(function (n) { var c = contas(n); return [A.dataSimples(n.emitida_em), n.numero_nota || "-", (ehAvulso(n) ? "[avulso] " : "") + empresaDe(n) + (n.descricao ? " - " + String(n.descricao).slice(0, 90) : ""), din(c.bruto), din(c.ret), din(c.liq), din(c.emp), din(c.ficou), n.recebido ? "recebido" + (n.recebido_em ? " " + A.dataSimples(n.recebido_em).slice(0, 5) : "") : "a receber"]; }),
        ["", "", "TOTAL", din(T.bruto), din(T.ret), din(T.liq), din(T.emp), din(T.ficou), ""]);
      var n = doc.getNumberOfPages();
      for (var pg = 1; pg <= n; pg++) { doc.setPage(pg); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(130); doc.text(tx((E.nome || "AGE") + " - notas fiscais emitidas  ·  página " + pg + " de " + n), 148.5, 203, { align: "center" }); }
      P.baixar(doc.output("blob"), "notas-emitidas-" + A.isoLocal(new Date()) + ".pdf");
      A.ocupado(botao, false);
    }).catch(function (e) { A.ocupado(botao, false); P.falhou(e); });
  }
  function abrirArquivo(cam) {
    var w = window.open("", "_blank");
    P.q(P.sb.storage.from("fotos").createSignedUrls([cam], 600)).then(function (l) { var u = l && l[0] && l[0].signedUrl; if (w) { if (u) w.location = u; else w.close(); } if (!u) A.avisar("Arquivo não encontrado.", "erro"); })
      .catch(function (e) { if (w) w.close(); P.falhou(e); });
  }

  // ---------------- 💰 recebi um depósito: acha a nota (ou as notas) com o mesmo valor e marca como recebida ----------------
  // quem pagou (parte "Origem" / "Pagador" / "De" do comprovante) e o CNPJ/CPF dele
  function pagadorDe(texto) {
    var ls = String(texto || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), r = {};
    var ROT = /^(origem|pagador|quem pagou|dados do pagador|de|remetente|enviado por|pago por|recebido de|transferido por|depositante|nome do pagador)\b[:\s-]*/i;
    var DOC = /\d{2}\.?\d{3}\.?\d{3}\s?\/\s?\d{4}\s?-?\s?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/;
    // CPF/CNPJ de quem pagou: o primeiro nas linhas depois do rótulo (pode estar na linha de baixo de "CPF ou CNPJ")
    var docDepois = function (i0) {
      for (var k2 = i0; k2 < Math.min(ls.length, i0 + 8); k2++) {
        if (k2 > i0 && /^(destino|para|recebedor|favorecido|destinat)/i.test(ls[k2])) break;
        var m = ls[k2].match(DOC); if (m) return dig(m[0]);
      }
      return "";
    };
    for (var i = 0; i < ls.length && !r.nome; i++) {
      if (!ROT.test(ls[i])) continue;
      if (!r.doc) r.doc = docDepois(i);
      var resto = ls[i].replace(ROT, "").replace(/^nome\b[:\s]*/i, "");
      if (/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(resto)) { r.nome = resto; break; }
      for (var k = i + 1; k < Math.min(ls.length, i + 6); k++) {
        if (/^(destino|para|recebedor|favorecido|destinat)/i.test(ls[k])) break;
        var x = ls[k].replace(/^nome\b[:\s]*/i, "");
        if (/^(cpf|cnpj)\b/i.test(x)) { if (!r.doc) r.doc = dig(x); continue; }
        if (/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(x) && !/institui|banco|ag[eê]ncia|conta|chave|tipo|valor|data/i.test(x)) { r.nome = x; break; }
      }
    }
    return r;
  }
  function mesmaEmpresa(n, pg) {
    if (!pg) return false;
    var d = dig(pg.doc), dn = dig(n.tomador_cnpj);
    if (d.length >= 8 && dn.length >= 8 && (dn.indexOf(d) >= 0 || d.indexOf(dn) >= 0)) return true;
    var a = norm(pg.nome).split(" ").filter(function (w) { return w.length >= 4; }), b = " " + norm(empresaDe(n)) + " ";
    return a.length > 0 && a.some(function (w) { return b.indexOf(" " + w + " ") >= 0; });
  }
  // notas a receber cujo líquido bate com o depósito: uma só, ou 2/3 notas da mesma empresa que somam o valor
  function casar(valor, pg) {
    var abertas = (P.S.receitas || []).filter(function (n) { return !n.recebido; }), tol = 0.05, out = [];
    abertas.forEach(function (n) { if (Math.abs(contas(n).liq - valor) <= tol) out.push([n]); });
    var grupos = {};
    abertas.forEach(function (n) { var k = chaveEmpresa(n); (grupos[k] = grupos[k] || []).push(n); });
    Object.keys(grupos).forEach(function (k) {
      var g = grupos[k].slice(0, 25);
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
        var s2 = contas(g[i]).liq + contas(g[j]).liq;
        if (Math.abs(s2 - valor) <= tol) out.push([g[i], g[j]]);
        for (var m = j + 1; m < g.length; m++) if (Math.abs(s2 + contas(g[m]).liq - valor) <= tol) out.push([g[i], g[j], g[m]]);
      }
    });
    out.forEach(function (g) { g.sort(function (a, b) { return String(a.emitida_em).localeCompare(String(b.emitida_em)) || (Number(a.numero_nota) || 0) - (Number(b.numero_nota) || 0); }); });
    // primeiro o que é da empresa que pagou, depois uma nota só, depois a mais antiga
    return out.sort(function (a, b) {
      return (mesmaEmpresa(b[0], pg) - mesmaEmpresa(a[0], pg)) || (a.length - b.length) || String(a[0].emitida_em).localeCompare(String(b[0].emitida_em));
    }).slice(0, 8);
  }
  function deposito(depois) {
    var j = A.janela('<p class="peq mudo" style="margin-top:0">Mande o comprovante do depósito/Pix que <b>você recebeu</b> (foto, PDF ou o texto). O app acha a nota a receber com o mesmo valor líquido e marca como recebida, guardando o comprovante. No computador também dá para copiar a imagem e apertar <b>Ctrl+V</b> aqui.</p>' +
      '<div class="acoes" style="margin-top:0"><button class="prim" id="dp-arq-b">📷 Comprovante (foto ou PDF)</button><button id="dp-colar">📋 Colar texto</button></div>' +
      '<input type="file" id="dp-arq" accept="image/*,application/pdf,.pdf" class="oculto">' +
      '<div id="dp-cx-txt" class="oculto"><textarea id="dp-txt" rows="6" placeholder="Cole aqui o texto do comprovante"></textarea><div class="acoes" style="margin-top:4px"><button class="peq" id="dp-ler-txt">Ler</button></div></div>' +
      '<details style="margin-top:8px"><summary>Ou digite o valor e a data</summary><div class="duas"><div><label for="dp-valor">Valor que caiu (R$)</label><input id="dp-valor" inputmode="decimal"></div>' +
      '<div><label for="dp-data">Data</label><input type="date" id="dp-data" value="' + A.isoLocal(new Date()) + '"></div></div><div class="acoes"><button class="peq" id="dp-buscar">Procurar a nota</button></div></details>' +
      '<div id="dp-st" class="peq" style="margin-top:8px"></div><div id="dp-res"></div>', { titulo: "💰 Recebi um depósito", larga: true });
    var el = j.el, arquivo = null;
    function st(t, tipo) { $("#dp-st", el).innerHTML = t ? '<span style="color:var(--' + (tipo || "texto") + ')">' + esc(t) + "</span>" : ""; }
    function lerTexto(t, f) {
      var px = window.AGE_PAG.lerPix(t), pg = pagadorDe(t);
      if (!(px.valor > 0)) { st("Não achei o valor no comprovante. Digite o valor e a data abaixo.", "critico"); el.querySelector("details").open = true; return; }
      $("#dp-valor", el).value = num2(px.valor); if (px.data) $("#dp-data", el).value = px.data;
      arquivo = f || null;
      mostrar(px.valor, px.data || A.isoLocal(new Date()), pg, px);
    }
    function ler(f) {
      st("📖 Lendo o comprovante... (foto pode levar até 1 minuto)");
      window.AGE_PAG.lerArquivo(f).then(function (r) { lerTexto(r.texto, r.imagem || f); }).catch(function (e) { st("Não consegui ler: " + A.msgErro(e), "critico"); });
    }
    function mostrar(valor, data, pg, px) {
      var ops = casar(valor, pg);
      st("");
      var cab = '<div class="cartao" style="margin-top:8px"><b>Depósito de ' + dinheiro(valor) + "</b> · " + esc(A.dataSimples(data)) + (pg && pg.nome ? " · de " + esc(pg.nome) : "") + "</div>";
      if (!ops.length) {
        var abertas = (P.S.receitas || []).filter(function (n) { return !n.recebido; }).sort(function (a, b) { return Math.abs(contas(a).liq - valor) - Math.abs(contas(b).liq - valor); }).slice(0, 6);
        $("#dp-res", el).innerHTML = cab + '<div class="aviso">Nenhuma nota a receber com o líquido de ' + dinheiro(valor) + ". As mais perto do valor:</div>" +
          (abertas.length ? abertas.map(function (n) {
            var c = contas(n), dif = Math.round((valor - c.liq) * 100) / 100;
            return '<div class="cartao" style="margin:6px 0"><b>Nota ' + esc(n.numero_nota || "s/ nº") + " · " + esc(empresaDe(n)) + "</b> · líquido " + dinheiro(c.liq) + ' · <span class="selo atencao">diferença ' + dinheiro(dif) + "</span>" +
              '<div class="acoes" style="margin-top:6px"><button class="peq" data-dp-usar="' + n.id + '">Marcar esta como recebida mesmo assim</button></div></div>';
          }).join("") : '<div class="mudo peq">Não há notas a receber.</div>') +
          '<div class="acoes"><button id="dp-avulso">💵 Lançar como recebimento avulso (sem nota)</button></div>';
      } else {
        $("#dp-res", el).innerHTML = cab + ops.map(function (g, i) {
          var tot = g.reduce(function (t, n) { return t + contas(n).liq; }, 0), dono = mesmaEmpresa(g[0], pg);
          return '<div class="cartao" style="margin:6px 0;border-left:4px solid var(--' + (i === 0 ? "bom" : "borda") + ')"><b>' + (g.length > 1 ? g.length + " notas: " : "") +
            g.map(function (n) { return "Nota " + esc(n.numero_nota || "s/ nº"); }).join(" + ") + " · " + esc(empresaDe(g[0])) + "</b>" + (dono ? ' <span class="selo bom">mesma empresa que pagou</span>' : "") +
            '<div class="peq mudo">' + g.map(function (n) { var c = contas(n); return esc(A.dataSimples(n.emitida_em)) + ": bruto " + dinheiro(c.bruto) + " − retido " + dinheiro(c.ret) + " = " + dinheiro(c.liq); }).join("<br>") + "</div>" +
            '<div class="peq">✔ ' + (g.length > 1 ? "soma " : "líquido ") + dinheiro(tot) + " bate com o depósito</div>" +
            '<div class="acoes" style="margin-top:6px"><button class="' + (i === 0 ? "prim" : "") + '" data-dp-ok="' + i + '">✅ Marcar como recebida' + (g.length > 1 ? "s" : "") + "</button></div></div>";
        }).join("") + '<div class="acoes"><button class="peq" id="dp-avulso">Não é nenhuma destas: lançar como recebimento avulso</button></div>';
      }
      $$("[data-dp-ok]", el).forEach(function (b) { b.onclick = function () { marcar(ops[Number(b.dataset.dpOk)], valor, data, b); }; });
      $$("[data-dp-usar]", el).forEach(function (b) { b.onclick = function () { marcar([P.porId(P.S.receitas, b.dataset.dpUsar)], valor, data, b); }; });
      if ($("#dp-avulso", el)) $("#dp-avulso", el).onclick = function () {
        guardarComp(data).then(function (cam) {
          j.fechar();
          formulario({ avulso: true, valor: valor, data: data, comprovante: cam, lida: { tomador: pg && pg.nome ? pg.nome : "", cnpj: pg && pg.doc && pg.doc.length >= 11 ? pg.doc : "" } }, depois);
        });
      };
    }
    function guardarComp(data) {
      if (!arquivo) return Promise.resolve(null);
      var f = arquivo, ehImg = /^image\//.test(f.type || "image/jpeg");
      var pr = ehImg ? A.prepararFoto(f, [], 1600).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; }) : Promise.resolve({ bl: f, ext: "pdf", tipo: "application/pdf" });
      return pr.then(function (a) {
        var cam = "admin/receitas/deposito-" + (data || A.isoLocal(new Date())) + "-" + A.uuid() + "." + a.ext;
        return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; });
      }).catch(function () { A.avisar("O comprovante não foi guardado, mas o recebimento será marcado.", "erro"); return null; });
    }
    function marcar(notas, valor, data, botao) {
      A.ocupado(botao, true, "Salvando...");
      var tot = notas.reduce(function (t, n) { return t + contas(n).liq; }, 0);
      guardarComp(data).then(function (cam) {
        return notas.reduce(function (pr, n) {
          return pr.then(function () {
            // várias notas num depósito: cada uma recebe a sua parte (o líquido dela; a diferença de centavos fica na última)
            var parte = notas.length === 1 ? valor : n === notas[notas.length - 1] ? Math.round((valor - (tot - contas(n).liq)) * 100) / 100 : contas(n).liq;
            return gravarReceita(n.id, { recebido: true, recebido_em: data, comprovante_receb: cam, valor_recebido: parte }).then(function (x) { P.trocar(P.S.receitas, x); });
          });
        }, Promise.resolve());
      }).then(function () {
        j.fechar();
        A.avisar("✅ Recebido: " + notas.map(function (n) { return "nota " + (n.numero_nota || "s/ nº"); }).join(" + ") + " · " + dinheiro(valor), "ok");
        if (depois) depois();
      }).catch(function (e) { A.ocupado(botao, false); P.falhou(e); });
    }
    $("#dp-arq-b", el).onclick = function () { $("#dp-arq", el).value = ""; $("#dp-arq", el).click(); };
    $("#dp-arq", el).onchange = function () { var f = this.files[0]; if (f) ler(f); };
    $("#dp-colar", el).onclick = function () { $("#dp-cx-txt", el).classList.remove("oculto"); $("#dp-txt", el).focus(); };
    $("#dp-ler-txt", el).onclick = function () { var t = $("#dp-txt", el).value; if (t.trim()) lerTexto(t, null); };
    $("#dp-buscar", el).onclick = function () {
      var v = A.lerNumero($("#dp-valor", el).value);
      if (!(v > 0)) { st("Digite o valor que caiu.", "critico"); return; }
      mostrar(v, $("#dp-data", el).value || A.isoLocal(new Date()), null, null);
    };
    el.addEventListener("paste", function (ev) {
      var fs = Array.prototype.slice.call((ev.clipboardData && ev.clipboardData.files) || []).filter(function (f) { return /^image\/|pdf/.test(f.type); });
      if (fs.length) { ev.preventDefault(); ler(fs[0]); }
    });
  }

  // ---------------- receber arquivo e formulário ----------------
  function receber(f, depois) {
    var j = A.janela('<div class="peq" id="ft-st">📖 Lendo a nota de serviço...</div>', { titulo: "🧾 Nota de serviço" });
    window.AGE_PAG.lerArquivo(f).then(function (r) {
      j.fechar();
      var d = lerNFSe(r.texto, r.pecas);
      formulario({ lida: d, arquivo: f, bruto: r.texto }, depois);
    }).catch(function () { j.fechar(); formulario({ arquivo: f, erro: true }, depois); });
  }
  function formulario(op, depois) {
    var n0 = op.nota || null, d = op.lida || {};
    var obraTxt = n0 ? rotuloDe(n0) : sugerirObra(d.tomador);
    var clientes = {}; P.S.receitas.forEach(function (x) { if (x.cliente) clientes[x.cliente] = x.tomador_cnpj || ""; });
    var retLida = d.retencoes || {}, somaLida = RET.reduce(function (t, x) { return t + (Number(retLida[x[0]]) || 0); }, 0);
    // a nota tem bruto e líquido diferentes, mas o app não achou as retenções: a diferença vai em "Outras"
    var dif = d.bruto && d.valor && d.bruto - d.valor > 0.009 && !somaLida ? Math.round((d.bruto - d.valor) * 100) / 100 : 0;
    var j = A.janela(
      (op.erro ? '<div class="aviso erro">Não consegui ler o arquivo. Preencha à mão.</div>' : "") +
      (op.lida && (d.valorIncerto || !(d.bruto || d.valor)) ? '<div class="aviso">⚠️ Não achei o valor da nota com clareza: <b>confira os valores</b>.</div>' : "") +
      (dif ? '<div class="aviso">⚠️ O valor bruto (' + dinheiro(d.bruto) + ") e o líquido (" + dinheiro(d.valor) + ") são diferentes e não achei quais impostos foram retidos: coloquei a diferença em <b>Outras retenções</b>. Confira na nota.</div>" : "") +
      '<label class="marca-linha" style="margin:4px 0 8px"><input type="checkbox" id="ft-avulso"> 💵 Recebimento avulso (serviço sem nota fiscal)</label>' +
      (d.nacional ? '<div class="aviso ok">🧾 NFS-e do padrão nacional lida: confira os valores abaixo.</div>' : "") +
      (op.bruto ? '<details class="peq" style="margin:4px 0"><summary>🔍 ver o texto que o app leu</summary><pre style="white-space:pre-wrap;max-height:200px;overflow:auto;font-size:11px">' + esc(String(op.bruto).slice(0, 5000)) + "</pre></details>" : "") +
      '<div class="duas"><div><label for="ft-cli">Empresa (tomador da nota) *</label><input id="ft-cli" list="ft-dl-cli" maxlength="200" placeholder="Ex.: DEVA VEICULOS LTDA"><datalist id="ft-dl-cli">' +
      Object.keys(clientes).map(function (k) { return '<option value="' + esc(k) + '">'; }).join("") + "</datalist></div>" +
      '<div><label for="ft-cnpj">CNPJ da empresa</label><input id="ft-cnpj" inputmode="numeric" maxlength="20" placeholder="00.000.000/0000-00"></div></div>' +
      '<label for="ft-obra">Obra / cliente (o mesmo de “Para onde foi” nas compras — para o resultado por obra)</label><input id="ft-obra" list="ft-dl" maxlength="200" placeholder="Ex.: DEVA IVECO (contagem)">' + datalist("ft-dl") +
      '<div class="duas"><div id="ft-num-c"><label for="ft-num">Nº da nota</label><input id="ft-num" maxlength="30" inputmode="numeric"></div><div><label for="ft-data" id="ft-data-l">Emissão</label><input type="date" id="ft-data"></div></div>' +
      '<label for="ft-valor" id="ft-valor-l">Valor bruto da nota (valor dos serviços, R$) *</label><input id="ft-valor" inputmode="decimal">' +
      '<details id="ft-ret-box" style="margin-top:8px"><summary><b>Impostos retidos na nota</b> <span class="peq mudo">(o que a empresa desconta: ISS retido, INSS, IR, PIS, COFINS, CSLL)</span> <span id="ft-ret-tot" class="selo"></span></summary>' +
      '<div class="grade" style="margin-top:6px">' + RET.map(function (x) { return '<div><label for="ft-r-' + x[0] + '">' + x[1] + ' (R$)</label><input id="ft-r-' + x[0] + '" inputmode="decimal" class="ft-r"></div>'; }).join("") + "</div></details>" +
      '<div class="duas"><div><label for="ft-aliq">Imposto da empresa (DAS / Simples, % do bruto)</label><input id="ft-aliq" inputmode="decimal" placeholder="Ex.: 6"></div>' +
      '<div><label for="ft-emp">Imposto da empresa (R$)</label><input id="ft-emp" inputmode="decimal"></div></div>' +
      '<div class="cartao" id="ft-conta" style="margin-top:10px"></div>' +
      '<label for="ft-desc">Serviço</label><input id="ft-desc" maxlength="300" placeholder="Ex.: pintura das faixas amarelas e demarcações de combate a incêndio">' +
      '<div class="duas"><div><label class="marca-linha" style="margin-top:28px"><input type="checkbox" id="ft-rec"> ✅ Já recebi</label></div><div id="ft-rec-c"><label for="ft-rec-em">Recebido em</label><input type="date" id="ft-rec-em"></div></div>' +
      '<div id="ft-erro"></div><div class="acoes"><button class="prim" id="ft-salvar">Salvar</button>' + (n0 ? '<button class="perigo" id="ft-apagar">Apagar</button>' : "") + "</div>",
      { titulo: n0 ? "🧾 Nota de serviço" : "🧾 Nova nota de serviço", larga: true });
    var el = j.el, c0 = n0 ? contas(n0) : null, ret0 = n0 ? n0.retencoes || {} : retLida;
    $("#ft-cli", el).value = n0 ? n0.cliente || "" : d.tomador || "";
    $("#ft-cnpj", el).value = fmtCnpj(n0 ? n0.tomador_cnpj : d.cnpj);
    $("#ft-obra", el).value = obraTxt || "";
    $("#ft-num", el).value = n0 ? n0.numero_nota || "" : d.numero || "";
    $("#ft-data", el).value = n0 ? n0.emitida_em : d.data || A.isoLocal(new Date());
    $("#ft-valor", el).value = num2(n0 ? c0.bruto : d.bruto || d.valor);
    RET.forEach(function (x) { var v = Number(ret0[x[0]]) || (!n0 && x[0] === "outras" ? dif : 0); $("#ft-r-" + x[0], el).value = v ? num2(v) : ""; });
    if (n0 ? c0.ret : somaLida || dif) $("#ft-ret-box", el).open = true;
    if (n0) { $("#ft-emp", el).value = c0.emp ? num2(c0.emp) : ""; if (c0.emp && c0.bruto) $("#ft-aliq", el).value = A.numero(Math.round(c0.emp / c0.bruto * 10000) / 100); }
    else $("#ft-aliq", el).value = aliqGuardada();
    $("#ft-desc", el).value = n0 ? n0.descricao || "" : d.descricao || "";
    $("#ft-rec", el).checked = n0 ? !!n0.recebido : false;
    $("#ft-rec-em", el).value = n0 && n0.recebido_em ? n0.recebido_em : A.isoLocal(new Date());
    var verRec = function () { $("#ft-rec-c", el).classList.toggle("oculto", !$("#ft-rec", el).checked); };
    $("#ft-rec", el).onchange = verRec; verRec();
    // avulso: sem número de nota e sem impostos retidos; o valor é o que foi combinado/recebido
    var verAvulso = function () {
      var av = $("#ft-avulso", el).checked;
      $("#ft-num-c", el).classList.toggle("oculto", av); $("#ft-ret-box", el).classList.toggle("oculto", av);
      $("#ft-valor-l", el).textContent = av ? "Valor do serviço (R$) *" : "Valor bruto da nota (valor dos serviços, R$) *";
      $("#ft-data-l", el).textContent = av ? "Data do serviço" : "Emissão";
      if (av) $$(".ft-r", el).forEach(function (i) { i.value = ""; });
      conta();
    };
    $("#ft-avulso", el).checked = n0 ? ehAvulso(n0) : !!op.avulso;
    if (op.avulso && !n0) { $("#ft-rec", el).checked = true; verRec(); if (op.valor) $("#ft-valor", el).value = num2(op.valor); if (op.data) { $("#ft-data", el).value = op.data; $("#ft-rec-em", el).value = op.data; } }
    $("#ft-avulso", el).onchange = verAvulso;
    // empresa já usada antes: o CNPJ vem junto
    $("#ft-cli", el).onchange = function () {
      var cn = clientes[this.value.trim()];
      if (cn && !dig($("#ft-cnpj", el).value)) $("#ft-cnpj", el).value = fmtCnpj(cn);
      if (!$("#ft-obra", el).value.trim()) $("#ft-obra", el).value = sugerirObra(this.value);
    };
    $("#ft-cnpj", el).onchange = function () { this.value = fmtCnpj(this.value); };
    function ler() {
      var bruto = A.lerNumero($("#ft-valor", el).value) || 0, ret = {}, tr = 0;
      RET.forEach(function (x) { var v = Math.round((A.lerNumero($("#ft-r-" + x[0], el).value) || 0) * 100) / 100; if (v > 0) { ret[x[0]] = v; tr += v; } });
      var emp = Math.round((A.lerNumero($("#ft-emp", el).value) || 0) * 100) / 100;
      tr = Math.round(tr * 100) / 100;
      return { bruto: bruto, ret: ret, tr: tr, emp: emp, liq: Math.round((bruto - tr) * 100) / 100, ficou: Math.round((bruto - tr - emp) * 100) / 100 };
    }
    function conta() {
      var v = ler(), linha = function (r, val, forte) { return '<div class="linha' + (forte ? " forte" : "") + '"><span>' + r + '</span><span class="dir">' + val + "</span></div>"; };
      $("#ft-ret-tot", el).textContent = v.tr ? dinheiro(v.tr) : "";
      $("#ft-conta", el).innerHTML = linha("Valor bruto", dinheiro(v.bruto)) + linha("− Impostos retidos na nota", dinheiro(v.tr)) + linha("= Líquido que a empresa paga", dinheiro(v.liq), true) +
        linha("− Imposto da empresa (DAS / Simples)", dinheiro(v.emp)) +
        '<div class="linha forte" style="font-size:18px;margin-top:4px"><span>💰 Ficou para a empresa</span><span class="dir" style="color:var(--' + (v.ficou < 0 ? "critico" : "bom") + ')">' + dinheiro(v.ficou) + "</span></div>";
    }
    // % do imposto da empresa → valor (o % fica guardado neste aparelho para as próximas notas)
    function pelaAliq() { var a = A.lerNumero($("#ft-aliq", el).value), b = A.lerNumero($("#ft-valor", el).value); if (a > 0 && b > 0) $("#ft-emp", el).value = num2(Math.round(b * a) / 100); }
    $("#ft-aliq", el).oninput = function () { pelaAliq(); conta(); try { localStorage.setItem(CHAVE_ALIQ, this.value.trim()); } catch (e) { /* sem armazenamento */ } };
    $("#ft-valor", el).oninput = function () { if ($("#ft-aliq", el).value.trim()) pelaAliq(); conta(); };
    $("#ft-emp", el).oninput = function () {
      var b = A.lerNumero($("#ft-valor", el).value), e = A.lerNumero(this.value);
      $("#ft-aliq", el).value = b > 0 && e > 0 ? A.numero(Math.round(e / b * 10000) / 100) : "";
      conta();
    };
    $$(".ft-r", el).forEach(function (i) { i.oninput = conta; });
    if (!n0 && $("#ft-aliq", el).value.trim()) pelaAliq();
    verAvulso();
    $("#ft-salvar", el).onclick = function () {
      var b = this, v = ler(), cli = $("#ft-cli", el).value.trim(), txt = $("#ft-obra", el).value.trim() || cli;
      var erro = !txt ? "Informe a empresa (tomador)." : !(v.bruto > 0) ? "Informe o valor bruto da nota." : !(v.liq > 0) ? "Os impostos retidos passam do valor bruto: confira." : !$("#ft-data", el).value ? "Informe a data de emissão." : "";
      if (erro) { $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + erro + "</div>"; return; }
      var rs = resolver(txt), rec = $("#ft-rec", el).checked, av = $("#ft-avulso", el).checked;
      var dados = { obra_id: rs.obra_id, destino: rs.destino, cliente: cli || txt, numero_nota: $("#ft-num", el).value.trim() || null, emitida_em: $("#ft-data", el).value,
        valor: v.liq, valor_bruto: v.bruto, retencoes: v.ret, imposto_empresa: v.emp || null, tomador_cnpj: dig($("#ft-cnpj", el).value) || null,
        descricao: $("#ft-desc", el).value.trim() || null, recebido: rec, recebido_em: rec ? $("#ft-rec-em", el).value || A.isoLocal(new Date()) : null, avulso: av };
      if (av) { dados.numero_nota = null; dados.retencoes = {}; dados.valor = v.bruto; }
      if (!n0 && d.chave) dados.chave_nfse = d.chave;
      if (!n0 && op.comprovante) { dados.comprovante_receb = op.comprovante; dados.valor_recebido = op.valor || null; }
      // mesma nota lançada duas vezes (mesmo número e valor)
      var rep = dados.numero_nota && P.S.receitas.filter(function (x) { return x.id !== (n0 && n0.id) && x.numero_nota === dados.numero_nota && Math.abs(contas(x).bruto - v.bruto) < 0.01; })[0];
      if (rep && b.dataset.confirmou !== "1") { $("#ft-erro", el).innerHTML = '<div class="aviso erro">⚠️ A nota nº ' + esc(rep.numero_nota) + " de " + dinheiro(contas(rep).bruto) + " já foi lançada (" + esc(empresaDe(rep)) + ").</div>"; b.dataset.confirmou = "1"; b.textContent = "Salvar mesmo assim"; return; }
      A.ocupado(b, true, "Salvando...");
      var f = op.arquivo, ehPdf = f && (/pdf/.test(f.type) || /\.pdf$/i.test(f.name || ""));
      var pArq = !f ? Promise.resolve(null) : (/^image\//.test(f.type) ? A.prepararFoto(f, [], 1800).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; })
        : Promise.resolve({ bl: f, ext: ehPdf ? "pdf" : "xml", tipo: ehPdf ? "application/pdf" : "text/xml" })).then(function (a) {
          var cam = "admin/receitas/" + dados.emitida_em + "-" + A.uuid() + "." + a.ext;
          return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; });
        }).catch(function () { return null; });   // sem o arquivo, a nota é salva do mesmo jeito
      pArq.then(function (cam) {
        if (cam) dados.arquivo = cam;
        return gravarReceita(n0 && n0.id, dados);
      }).then(function (n) {
        P.trocar(P.S.receitas, n); j.fechar();
        if (n.emitida_em < periodo().de) filtro.periodo = "tudo";
        A.avisar("🧾 Nota salva: " + empresaDe(n) + " · bruto " + dinheiro(contas(n).bruto) + " · ficou " + dinheiro(contas(n).ficou), "ok");
        if (depois) depois();
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/valor_bruto|retencoes|imposto_empresa|tomador_cnpj/.test(m)) m = "O banco ainda não tem os campos de impostos. Rode no Supabase o supabase.sql atualizado e depois notify pgrst, 'reload schema';";
        $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>";
      });
    };
    if ($("#ft-apagar", el)) $("#ft-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta nota de serviço?")) return;
      P.q(P.sb.from("receitas").delete().eq("id", n0.id)).then(function () { P.tirar(P.S.receitas, n0.id); j.fechar(); if (depois) depois(); }).catch(P.falhou);
    };
  }

  // ---------------- resultado por obra ----------------
  function montar() {
    var pr = periodo(), g = {};
    var grupo = function (k, nome) { return g[k] = g[k] || { k: k, nome: nome, notas: [], compras: [], desp: [], pags: [], recebido: 0, notasV: 0, impEmp: 0, mat: 0, mo: 0, av: 0, portal: 0 }; };
    var nomeK = function (x) { return rotuloDe(x) || "Sem obra definida"; };
    P.S.receitas.forEach(function (n) { if (n.emitida_em < pr.de || n.emitida_em >= pr.ate) return; var x = grupo(chave(n) || "-", nomeK(n)); x.notas.push(n); x.notasV += Number(n.valor); x.impEmp += contas(n).emp; if (n.recebido) x.recebido += Number(n.valor); });
    (P.S.compras || []).forEach(function (c) {
      if (c.comprado_em < pr.de || c.comprado_em >= pr.ate) return;
      var x = grupo(chave(c) || "-", nomeK(c));
      if (c.tipo === "despesa") { x.desp.push(c); x.av += Number(c.valor); } else { x.compras.push(c); x.mat += Number(c.valor); }
    });
    (P.S.pag || []).forEach(function (p) {
      var dt = A.isoLocal(new Date(p.pago_em));
      if (dt < pr.de || dt >= pr.ate) return;
      var x = grupo(chave(p) || "-", nomeK(p)); x.pags.push(p); x.mo += Number(p.valor);
    });
    // chamados com valor no portal (Supermercados BH) e sem nota de serviço lançada: o valor do chamado conta como entrada
    Object.keys(g).forEach(function (k) {
      var x = g[k];
      if (/^o:/.test(k) && !x.notas.length) { var o = P.porId(P.S.obras, k.slice(2)); if (o && o.portal && Number(o.portal.valor) > 0) x.portal = Number(o.portal.valor); }
      // notas: líquido recebido menos o imposto da empresa
      x.entrada = x.notasV ? x.notasV - x.impEmp : x.portal; x.gastos = x.mat + x.mo + x.av; x.lucro = x.entrada - x.gastos; x.margem = x.entrada ? x.lucro / x.entrada * 100 : null;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return (a.k === "-") - (b.k === "-") || b.entrada - a.entrada || b.gastos - a.gastos; });
  }
  function pct(v) { return v === null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ",") + "%"; }
  function resultado(r, mudou) {
    var b = semAcento(filtro.busca), ls = montar().filter(function (x) { return !b || semAcento(x.nome).indexOf(b) >= 0; });
    var T = ls.filter(function (x) { return x.k !== "-"; }).reduce(function (t, x) { t.e += x.entrada; t.m += x.mat; t.o += x.mo; t.a += x.av; return t; }, { e: 0, m: 0, o: 0, a: 0 });
    var sem = ls.filter(function (x) { return x.k === "-"; })[0];
    r.innerHTML = (ls.length ? '<div class="tabela-caixa"><table><thead><tr><th>Obra / cliente</th><th class="num">Notas (entrada, sem impostos)</th><th class="num">🧱 Materiais</th><th class="num">👷 Mão de obra</th><th class="num">⛽ Avulsos</th><th class="num">Resultado</th><th class="num">Margem</th><th></th></tr></thead><tbody>' +
      ls.map(function (x, i) {
        return "<tr" + (x.k === "-" ? ' class="mudo"' : "") + "><td><b>" + esc(x.nome) + "</b>" + (x.portal && !x.notasV ? '<div class="peq mudo">valor do chamado no portal</div>' : x.notasV && x.recebido < x.notasV ? '<div class="peq"><span class="selo atencao">a receber ' + dinheiro(x.notasV - x.recebido) + "</span></div>" : "") +
          '</td><td class="num">' + (x.entrada ? dinheiro(x.entrada) : "—") + '</td><td class="num">' + dinheiro(x.mat) + '</td><td class="num">' + dinheiro(x.mo) + '</td><td class="num">' + dinheiro(x.av) +
          '</td><td class="num"><b style="color:var(--' + (x.lucro < 0 ? "critico" : "bom") + ')">' + (x.entrada ? dinheiro(x.lucro) : "—") + '</b></td><td class="num">' + (x.entrada ? pct(x.margem) : "—") +
          '</td><td><button class="peq" data-ft-res="' + i + '">Ver</button></td></tr>';
      }).join("") +
      '<tr><td><b>Total (com obra)</b></td><td class="num"><b>' + dinheiro(T.e) + '</b></td><td class="num">' + dinheiro(T.m) + '</td><td class="num">' + dinheiro(T.o) + '</td><td class="num">' + dinheiro(T.a) +
      '</td><td class="num"><b>' + dinheiro(T.e - T.m - T.o - T.a) + '</b></td><td class="num">' + (T.e ? pct((T.e - T.m - T.o - T.a) / T.e * 100) : "—") + "</td><td></td></tr></tbody></table></div>" +
      (sem ? '<div class="aviso">⚠️ ' + dinheiro(sem.gastos + sem.notasV) + ' estão <b>sem obra definida</b> (compras sem “Para onde foi” ou pagamentos sem “Obra / cliente”). Toque em <b>Ver</b> na linha e informe a obra para entrarem no resultado certo.</div>' : "") +
      '<div class="acoes"><button id="ft-csv">⬇ Planilha (CSV)</button></div>'
      : '<div class="cartao vazio">Nada neste período. Lance notas de serviço aqui, as compras em 🧾 Compras (com “Para onde foi”) e os pagamentos da equipe com a obra.</div>');
    $$("[data-ft-res]", r).forEach(function (bt) { bt.onclick = function () { detalhe(ls[Number(bt.dataset.ftRes)], mudou); }; });
    if ($("#ft-csv", r)) $("#ft-csv", r).onclick = function () { baixarCsv(ls); };
  }
  function textoResultado(x) {
    return "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Resultado: " + x.nome + "*\n" +
      (x.notasV ? "🧾 Notas de serviço: " + dinheiro(x.notasV) + (x.recebido < x.notasV ? " (recebido " + dinheiro(x.recebido) + ")" : "") : x.portal ? "🧾 Valor do chamado: " + dinheiro(x.portal) : "🧾 Notas de serviço: —") +
      (x.impEmp ? "\n🏛️ Imposto da empresa: " + dinheiro(x.impEmp) : "") + "\n🧱 Materiais: " + dinheiro(x.mat) + "\n👷 Mão de obra: " + dinheiro(x.mo) + "\n⛽ Avulsos (gasolina, lanche e outros): " + dinheiro(x.av) +
      "\nTotal de gastos: " + dinheiro(x.gastos) + (x.entrada ? "\n*Resultado: " + dinheiro(x.lucro) + " (" + pct(x.margem) + ")*" : "");
  }
  function detalhe(x, mudou) {
    var linha = function (dt, txt, v, extra) { return "<tr><td>" + esc(A.dataSimples(dt)) + "</td><td>" + txt + '</td><td class="num">' + dinheiro(v) + "</td><td>" + (extra || "") + "</td></tr>"; };
    var obraSel = function (tab, id) { return x.k === "-" ? '<button class="peq" data-ft-obra="' + tab + ":" + id + '">📍 Informar obra</button>' : ""; };
    var sec = function (tit, v, linhas) { return linhas.length ? '<h3 style="margin:12px 0 4px">' + tit + " · " + dinheiro(v) + '</h3><div class="tabela-caixa"><table><tbody>' + linhas.join("") + "</tbody></table></div>" : ""; };
    var j = A.janela('<div class="grade">' +
      [["🧾 Entrada", x.entrada, "prim"], ["🧱 Materiais", x.mat, "pintura"], ["👷 Mão de obra", x.mo, "eletrica"], ["⛽ Avulsos", x.av, "atencao"], ["Resultado" + (x.entrada ? " (" + pct(x.margem) + ")" : ""), x.lucro, x.lucro < 0 ? "critico" : "bom"]].map(function (y) {
        return '<div class="ladrilho" style="border-left:4px solid var(--' + y[2] + ')"><div class="r">' + y[0] + '</div><div class="v" style="font-size:1.2em">' + dinheiro(y[1]) + "</div></div>";
      }).join("") + "</div>" +
      sec("🧾 Notas de serviço", x.notasV, x.notas.map(function (n) { return linha(n.emitida_em, "Nota " + esc(n.numero_nota || "s/ nº") + (n.descricao ? " · " + esc(n.descricao.slice(0, 80)) : "") + (n.recebido ? ' <span class="selo bom">recebida</span>' : ' <span class="selo atencao">a receber</span>'), n.valor); })) +
      (x.portal && !x.notasV ? '<div class="peq mudo" style="margin-top:8px">Entrada pelo valor do chamado no portal: ' + dinheiro(x.portal) + "</div>" : "") +
      sec("🧱 Materiais", x.mat, x.compras.map(function (c) { return linha(c.comprado_em, esc(c.fornecedor || "Loja") + (c.itens && c.itens.length ? '<div class="peq mudo">' + esc(c.itens.map(function (y) { return y.item; }).join(", ").slice(0, 120)) + "</div>" : ""), c.valor, obraSel("compras", c.id)); })) +
      sec("👷 Mão de obra", x.mo, x.pags.map(function (p) { return linha(A.isoLocal(new Date(p.pago_em)), esc(P.nomeFunc(p.funcionario_id) || p.favorecido || "—") + (p.descricao ? " · " + esc(p.descricao) : ""), p.valor, obraSel("pagamentos", p.id)); })) +
      sec("⛽ Avulsos", x.av, x.desp.map(function (c) { return linha(c.comprado_em, esc(c.fornecedor || "") + " " + esc(c.descricao || ""), c.valor, obraSel("compras", c.id)); })) +
      (x.k !== "-" ? '<div class="acoes"><button class="prim" id="ft-comp">📤 Compartilhar resultado</button></div>' : ""), { titulo: "📊 " + x.nome, larga: true });
    var el = j.el;
    if ($("#ft-comp", el)) $("#ft-comp", el).onclick = function () { A.compartilhar({ titulo: "Resultado " + x.nome, texto: textoResultado(x) }); };
    $$("[data-ft-obra]", el).forEach(function (bt) {
      bt.onclick = function () {
        var p = bt.dataset.ftObra.split(":"), t = window.prompt("Obra / cliente deste lançamento (ex.: " + (opcoes()[0] || "DEVA") + "):", "");
        if (!t) return;
        var rs = resolver(t), lista = p[0] === "compras" ? P.S.compras : P.S.pag;
        P.q(P.sb.from(p[0]).update(rs).eq("id", p[1]).select().single()).then(function (n) { P.trocar(lista, n); j.fechar(); A.avisar("📍 Obra informada: " + t, "ok"); if (mudou) mudou(); }).catch(P.falhou);
      };
    });
  }
  function baixarCsv(ls) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var r2 = function (v) { return Number(v || 0).toFixed(2).replace(".", ","); };
    var linhas = [["Obra / cliente", "Notas de serviço (R$)", "Recebido (R$)", "Valor do chamado (R$)", "Materiais (R$)", "Mão de obra (R$)", "Avulsos (R$)", "Total de gastos (R$)", "Resultado (R$)", "Margem (%)"]];
    ls.forEach(function (x) { linhas.push([x.nome, r2(x.notasV), r2(x.recebido), r2(x.portal), r2(x.mat), r2(x.mo), r2(x.av), r2(x.gastos), x.entrada ? r2(x.lucro) : "", x.margem === null ? "" : r2(x.margem)]); });
    var csv = "\ufeff" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "resultado-obras-" + A.isoLocal(new Date()) + ".csv");
  }

  window.AGE_FAT = { ver: ver, lerNFSe: lerNFSe, resolver: function (ctx, t) { P = ctx; return resolver(t); }, rotuloDe: function (ctx, x) { P = ctx; return rotuloDe(x); },
    datalist: function (ctx, id) { P = ctx; return datalist(id); }, aReceber: function (S) { return (S.receitas || []).filter(function (n) { return !n.recebido; }); } };
})();
