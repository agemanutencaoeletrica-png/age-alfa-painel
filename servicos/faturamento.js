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
  function num2(v) { return v || v === 0 ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""; }   // 17.100,00
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
  var NOVAS = ["comprovante_receb", "valor_recebido", "chave_nfse", "avulso", "deposito_id", "deposito_hash"];
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
  // nota já lançada? mesma chave da NFS-e, ou mesmo número de nota (sem zeros à esquerda). Avulso não tem número e não conta.
  function numNota(t) { var d = String(t || "").replace(/\D/g, "").replace(/^0+/, ""); return d || ""; }
  function notaRepetida(numero, chave, idAtual) {
    var nu = numNota(numero), ch = String(chave || "").replace(/\D/g, "");
    return (P.S.receitas || []).filter(function (x) {
      if (x.id === idAtual || ehAvulso(x)) return false;
      return (ch && String(x.chave_nfse || "").replace(/\D/g, "") === ch) || (nu && numNota(x.numero_nota) === nu);
    })[0] || null;
  }
  function textoRepetida(x) {
    return "⛔ A nota nº " + esc(x.numero_nota || "s/ nº") + " já foi lançada: " + esc(empresaDe(x)) + " · bruto " + dinheiro(contas(x).bruto) + " · emitida em " + esc(A.dataSimples(x.emitida_em)) +
      (x.recebido ? " · ✅ recebida" : " · ⏳ a receber") + ". Ela não pode ser lançada de novo.";
  }
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
      '<input type="search" id="ft-busca" placeholder="Buscar cliente, obra, nº da nota..."></div>' + htmlRasc() + '<div id="ft-res"></div>';
    if ($("#ft-rasc-ok")) {
      $("#ft-rasc-ok").onclick = function () { var r = lerRasc(); if (r) continuarRasc(r, function () { ver(c, P); }); };
      $("#ft-rasc-x").onclick = function () { if (!A.confirmar("Descartar a nota não salva?")) return; apagarRasc(); ver(c, P); };
    }
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
        // várias notas: lê todas e mostra uma tabela para conferir e salvar juntas
        if (fs.length > 1) lote(fs, function () { ver(c, P); });
        else receber(fs[0], function () { ver(c, P); });
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
    var el = j.el, arquivo = null, dep = { id: null, hash: null };
    // "impressão digital" do comprovante: o mesmo arquivo (ou o mesmo texto) mandado de novo é reconhecido mesmo sem o ID do Pix
    function impressao(dado) {
      var fazer = function (buf) { return window.crypto && crypto.subtle ? crypto.subtle.digest("SHA-256", buf).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }) : Promise.resolve(null); };
      if (typeof dado === "string") return fazer(new TextEncoder().encode(dado.replace(/\s+/g, " ").trim().toLowerCase())).catch(function () { return null; });
      return dado.arrayBuffer().then(fazer).catch(function () { return null; });
    }
    // o mesmo comprovante já deu baixa em alguma nota?
    function jaUsado(d) {
      var idN = String(d.id || "").replace(/\s/g, "").toUpperCase();
      // outra foto do mesmo comprovante: o leitor pode trocar 1 ou 2 letras do ID (O/0, I/1)
      var quase = function (a2, b2) { if (!a2 || !b2 || a2.length !== b2.length || a2.length < 20) return a2 === b2 && !!a2; var dif = 0; for (var k = 0; k < a2.length; k++) if (a2[k] !== b2[k] && ++dif > 2) return false; return true; };
      return (P.S.receitas || []).filter(function (n) { return (idN && quase(String(n.deposito_id || "").toUpperCase(), idN)) || (d.hash && n.deposito_hash === d.hash); });
    }
    function htmlUsado(us) {
      return '<div class="aviso erro" id="dp-usado"><b>⛔ Este comprovante já foi usado</b> e não pode ser aceito de novo.<br>' + us.map(function (n) {
        return (ehAvulso(n) ? "Recebimento avulso" : "Nota " + esc(n.numero_nota || "s/ nº")) + " · " + esc(empresaDe(n)) + " · " + dinheiro(Number(n.valor_recebido) || contas(n).liq) + (n.recebido_em ? " · recebido em " + esc(A.dataSimples(n.recebido_em)) : "");
      }).join("<br>") + "</div>";
    }
    function st(t, tipo) { $("#dp-st", el).innerHTML = t ? '<span style="color:var(--' + (tipo || "texto") + ')">' + esc(t) + "</span>" : ""; }
    function lerTexto(t, f) {
      var px = window.AGE_PAG.lerPix(t), pg = pagadorDe(t);
      if (!(px.valor > 0)) { st("Não achei o valor no comprovante. Digite o valor e a data abaixo.", "critico"); el.querySelector("details").open = true; return; }
      $("#dp-valor", el).value = num2(px.valor); if (px.data) $("#dp-data", el).value = px.data;
      arquivo = f || null;
      dep.id = px.id ? String(px.id).replace(/\s/g, "").toUpperCase() : null;
      (f ? Promise.resolve(dep.hash) : impressao(t).then(function (h) { dep.hash = h; })).then(function () {
        var us = jaUsado(dep);
        if (us.length) { st(""); $("#dp-res", el).innerHTML = htmlUsado(us); return; }
        mostrar(px.valor, px.data || A.isoLocal(new Date()), pg, px);
      });
    }
    function ler(f) {
      st("📖 Lendo o comprovante... (foto pode levar até 1 minuto)");
      dep = { id: null, hash: null };
      impressao(f).then(function (h) {
        dep.hash = h;
        var us = jaUsado(dep);   // o mesmo arquivo: nem precisa ler
        if (us.length) { st(""); $("#dp-res", el).innerHTML = htmlUsado(us); return; }
        return window.AGE_PAG.lerArquivo(f).then(function (r) { lerTexto(r.texto, r.imagem || f); });
      }).catch(function (e) { st("Não consegui ler: " + A.msgErro(e), "critico"); });
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
          formulario({ avulso: true, valor: valor, data: data, comprovante: cam, deposito: { id: dep.id, hash: dep.hash }, lida: { tomador: pg && pg.nome ? pg.nome : "", cnpj: pg && pg.doc && pg.doc.length >= 11 ? pg.doc : "" } }, depois);
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
      var us = jaUsado(dep);
      if (us.length) { $("#dp-res", el).innerHTML = htmlUsado(us); return; }
      A.ocupado(botao, true, "Salvando...");
      var tot = notas.reduce(function (t, n) { return t + contas(n).liq; }, 0);
      guardarComp(data).then(function (cam) {
        return notas.reduce(function (pr, n) {
          return pr.then(function () {
            // várias notas num depósito: cada uma recebe a sua parte (o líquido dela; a diferença de centavos fica na última)
            var parte = notas.length === 1 ? valor : n === notas[notas.length - 1] ? Math.round((valor - (tot - contas(n).liq)) * 100) / 100 : contas(n).liq;
            return gravarReceita(n.id, { recebido: true, recebido_em: data, comprovante_receb: cam, valor_recebido: parte, deposito_id: dep.id, deposito_hash: dep.hash }).then(function (x) { P.trocar(P.S.receitas, x); });
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
      var dt = $("#dp-data", el).value || A.isoLocal(new Date());
      dep = { id: null, hash: null };
      // digitado (sem comprovante): se já há recebimento com o mesmo valor e a mesma data, pergunta antes
      var parecido = (P.S.receitas || []).filter(function (n) { return n.recebido && n.recebido_em === dt && Math.abs((Number(n.valor_recebido) || contas(n).liq) - v) < 0.01; });
      if (parecido.length && this.dataset.confirmou !== "1") {
        $("#dp-res", el).innerHTML = '<div class="aviso">⚠️ Já existe recebimento de ' + dinheiro(v) + " em " + esc(A.dataSimples(dt)) + ": " + parecido.map(function (n) { return (ehAvulso(n) ? "avulso" : "nota " + esc(n.numero_nota || "s/ nº")) + " · " + esc(empresaDe(n)); }).join("; ") +
          ". Se for <b>outro</b> depósito, toque em “Procurar a nota” de novo.</div>";
        this.dataset.confirmou = "1"; return;
      }
      this.dataset.confirmou = "";
      mostrar(v, dt, null, null);
    };
    el.addEventListener("paste", function (ev) {
      var fs = Array.prototype.slice.call((ev.clipboardData && ev.clipboardData.files) || []).filter(function (f) { return /^image\/|pdf/.test(f.type); });
      if (fs.length) { ev.preventDefault(); ler(fs[0]); }
    });
  }

  // ---------------- 📝 rascunho da nota: o que foi preenchido fica guardado neste aparelho até salvar ----------------
  var CHAVE_RASC = "age_rasc_nota";
  var CAMPOS_RASC = ["ft-cli", "ft-cnpj", "ft-obra", "ft-num", "ft-data", "ft-valor", "ft-aliq", "ft-emp", "ft-desc", "ft-rec-em"].concat(RET.map(function (x) { return "ft-r-" + x[0]; }));
  var MARCAS_RASC = ["ft-rec", "ft-avulso"];
  function lerRasc() { try { var r = JSON.parse(localStorage.getItem(CHAVE_RASC) || "null"); return r && Date.now() - r.em < 30 * 864e5 ? r : null; } catch (e) { return null; } }
  function apagarRasc() { try { localStorage.removeItem(CHAVE_RASC); } catch (e) { /* sem armazenamento */ } }
  function guardarRasc(r) {
    try { localStorage.setItem(CHAVE_RASC, JSON.stringify(r)); return true; }
    catch (e) { try { var r2 = Object.assign({}, r, { arq: null }); localStorage.setItem(CHAVE_RASC, JSON.stringify(r2)); return true; } catch (e2) { return false; } }   // arquivo grande demais: guarda só os campos
  }
  function resumoRasc(r) {
    var c = r.campos || {};
    return [c["ft-cli"] || (r.op && r.op.lida && r.op.lida.tomador) || "sem empresa", c["ft-num"] ? "nº " + c["ft-num"] : "", c["ft-valor"] ? "R$ " + c["ft-valor"] : ""].filter(Boolean).join(" · ");
  }
  function continuarRasc(r, depois) {
    var op = Object.assign({}, r.op || {}, { rascunho: r });
    if (op.notaId) op.nota = P.porId(P.S.receitas, op.notaId);
    if (!r.arq) { formulario(op, depois); return; }
    fetch(r.arq.url).then(function (x) { return x.blob(); }).then(function (bl) { op.arquivo = new File([bl], r.arq.nome || "nota", { type: r.arq.tipo || bl.type }); })
      .catch(function () { /* sem o arquivo: segue com os campos */ }).then(function () { formulario(op, depois); });
  }
  function htmlRasc() {
    var r = lerRasc(); if (!r) return "";
    return '<div class="aviso" id="ft-rasc" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>📝 Nota não salva: <b>' + esc(resumoRasc(r)) + "</b> <span class=\"peq mudo\">(guardada em " +
      esc(A.data(new Date(r.em))) + " " + new Date(r.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ')</span></span><button class="prim peq" id="ft-rasc-ok">Continuar</button><button class="peq" id="ft-rasc-x">Descartar</button></div>';
  }

  // ---------------- receber arquivo e formulário ----------------
  // ---------------- várias notas de uma vez ----------------
  function ehNFSe(d, texto) {
    if (d.nacional) return true;
    var t = String(texto || "");
    if (/n[aã]o\s+[eé]\s+documento\s+fiscal|documento\s+auxiliar\s+de\s+venda|or[cç]amento/i.test(t) && !/nfs-?e/i.test(t)) return false;
    return /nfs-?e|nota\s+fiscal\s+(eletr[oô]nica\s+)?de\s+servi[cç]os?|<\s*(?:\w+:)?(?:CompNfse|Nfse|InfNfse)\b/i.test(t) && (d.bruto || d.valor) > 0;
  }
  function lote(fs, depois) {
    var itens = [], aliq = aliqGuardada();
    var j = A.janela('<div id="lt-st" class="peq">📖 Lendo as notas...</div><div id="lt-res"></div>', { titulo: "🧾 Lançar várias notas", larga: true, fixa: true });
    var el = j.el;
    fs.reduce(function (pr, f, i) {
      return pr.then(function () {
        $("#lt-st", el).textContent = "📖 Lendo " + (i + 1) + " de " + fs.length + ": " + (f.name || "arquivo") + "...";
        return window.AGE_PAG.lerArquivo(f).then(function (r) { var d = lerNFSe(r.texto, r.pecas); itens.push({ f: f, d: d, texto: r.texto, nfse: ehNFSe(d, r.texto) }); },
          function () { itens.push({ f: f, d: {}, erro: true }); });
      });
    }, Promise.resolve()).then(function () {
      // situação de cada uma: pronta, já lançada, repetida no próprio lote, não é nota de serviço
      var vistos = {};
      itens.forEach(function (it) {
        var d = it.d;
        if (it.erro) { it.motivo = "Não consegui ler o arquivo"; return; }
        if (!it.nfse) { it.motivo = "Não é nota fiscal de serviço (ex.: orçamento de loja)"; return; }
        var rep2 = notaRepetida(d.numero, d.chave, null);
        if (rep2) { it.motivo = "Já lançada (" + (rep2.recebido ? "✅ recebida" : "⏳ a receber") + ")"; return; }
        var k = d.chave || "n" + numNota(d.numero);
        if (k !== "n" && vistos[k]) { it.motivo = "Arquivo repetido neste lote"; return; }
        vistos[k] = 1;
        if (!(d.bruto || d.valor)) { it.motivo = "Não achei o valor"; return; }
        it.ok = true; it.usar = true;
      });
      desenhar();
    });
    function linha(it, i) {
      var d = it.nfse ? it.d : {}, bruto = Number(d.bruto) || Number(d.valor) || 0, ret = RET.reduce(function (t, x) { return t + (Number((d.retencoes || {})[x[0]]) || 0); }, 0);
      var liq = Number(d.valor) || bruto - ret;   // o que não é nota de serviço aparece sem valores
      return "<tr" + (it.ok ? "" : ' class="mudo"') + "><td>" + (it.ok ? '<input type="checkbox" data-lt="' + i + '"' + (it.usar ? " checked" : "") + ' aria-label="Lançar">' : "") + "</td>" +
        '<td class="peq">' + esc(it.f.name || "") + "</td><td><b>" + esc(d.numero || "—") + "</b></td><td>" + esc(d.data ? A.dataSimples(d.data) : "—") + "</td><td>" + esc(d.tomador || "—") + "</td>" +
        '<td class="num">' + (bruto ? dinheiro(bruto) : "—") + '</td><td class="num">' + (ret ? dinheiro(ret) + '<div class="peq mudo">' + pct(ret / bruto * 100) + "</div>" : "—") + '</td><td class="num"><b>' + (liq ? dinheiro(liq) : "—") + "</b></td>" +
        "<td>" + (it.ok ? (it.salva ? '<span class="selo bom">✅ lançada</span>' : it.falhou ? '<span class="selo critico">' + esc(it.falhou) + "</span>" : '<span class="selo">pronta</span> <button class="peq" data-lt-ed="' + i + '">Conferir</button>') :
          '<span class="selo ' + (/já lançada|repetido/i.test(it.motivo) ? "atencao" : "critico") + '">' + esc(it.motivo) + "</span>") + "</td></tr>";
    }
    function desenhar() {
      var prontas = itens.filter(function (it) { return it.ok && it.usar && !it.salva; });
      var tot = prontas.reduce(function (t, it) { var d = it.d; return t + (Number(d.valor) || Number(d.bruto) || 0); }, 0);
      $("#lt-st", el).innerHTML = itens.length + " arquivo(s) lidos · <b>" + itens.filter(function (it) { return it.ok; }).length + "</b> nota(s) para lançar" +
        (itens.some(function (it) { return !it.ok; }) ? " · " + itens.filter(function (it) { return !it.ok; }).length + " ficam de fora" : "");
      $("#lt-res", el).innerHTML = '<div class="tabela-caixa"><table><thead><tr><th></th><th>Arquivo</th><th>Nº</th><th>Emissão</th><th>Empresa</th><th class="num">Bruto</th><th class="num">Retido</th><th class="num">Líquido</th><th></th></tr></thead><tbody>' +
        itens.map(linha).join("") + "</tbody></table></div>" +
        '<div class="duas"><div><label for="lt-aliq">Imposto da empresa (DAS / Simples, % do bruto) — para todas</label><input id="lt-aliq" inputmode="decimal" placeholder="Ex.: 6" value="' + esc(aliq) + '"></div>' +
        '<div><label for="lt-obra">Obra / cliente (vazio = o app sugere pela empresa)</label><input id="lt-obra" list="lt-dl" maxlength="200">' + datalist("lt-dl") + "</div></div>" +
        '<div class="acoes"><button class="prim" id="lt-salvar"' + (prontas.length ? "" : " disabled") + ">💾 Lançar " + prontas.length + " nota(s) · líquido " + dinheiro(tot) + '</button><button id="lt-fechar">Fechar</button></div>';
      $$("[data-lt]", el).forEach(function (cb) { cb.onchange = function () { itens[Number(cb.dataset.lt)].usar = cb.checked; desenhar(); }; });
      $$("[data-lt-ed]", el).forEach(function (b) {
        b.onclick = function () {   // conferir uma: abre o formulário dela; ao salvar, marca como lançada aqui
          var it = itens[Number(b.dataset.ltEd)];
          formulario({ lida: it.d, arquivo: it.f, bruto: it.texto }, function () { if (notaRepetida(it.d.numero, it.d.chave, null)) it.salva = true; desenhar(); });
        };
      });
      $("#lt-aliq", el).oninput = function () { aliq = this.value.trim(); try { localStorage.setItem(CHAVE_ALIQ, aliq); } catch (e) { /* sem armazenamento */ } };
      $("#lt-fechar", el).onclick = function () { j.fechar(); if (depois) depois(); };
      $("#lt-salvar", el).onclick = function () {
        var b = this, lista = itens.filter(function (it) { return it.ok && it.usar && !it.salva; }), al = A.lerNumero($("#lt-aliq", el).value) || 0, obraTxt = $("#lt-obra", el).value.trim();
        A.ocupado(b, true, "Lançando...");
        lista.reduce(function (pr, it) {
          return pr.then(function () {
            var d = it.d;
            if (notaRepetida(d.numero, d.chave, null)) { it.falhou = "já lançada"; return; }   // salva por outro caminho enquanto conferia
            var bruto = Number(d.bruto) || Number(d.valor), ret = {};
            RET.forEach(function (x) { var v = Number((d.retencoes || {})[x[0]]) || 0; if (v > 0) ret[x[0]] = v; });
            var tr = Object.keys(ret).reduce(function (t, k) { return t + ret[k]; }, 0), liq = Number(d.valor) || Math.round((bruto - tr) * 100) / 100;
            if (!tr && bruto - liq > 0.009) ret.outras = Math.round((bruto - liq) * 100) / 100;   // diferença sem imposto identificado
            var rs = resolver(obraTxt || sugerirObra(d.tomador) || d.tomador || "Sem empresa");
            var dados = { obra_id: rs.obra_id, destino: rs.destino, cliente: d.tomador || null, numero_nota: d.numero || null, emitida_em: d.data || A.isoLocal(new Date()),
              valor: liq, valor_bruto: bruto, retencoes: ret, imposto_empresa: al > 0 ? Math.round(bruto * al) / 100 : null, tomador_cnpj: d.cnpj || null,
              descricao: d.descricao || null, recebido: false, recebido_em: null, chave_nfse: d.chave || null };
            var f = it.f, ehPdf = /pdf/.test(f.type) || /\.pdf$/i.test(f.name || "");
            var pArq = (/^image\//.test(f.type) ? A.prepararFoto(f, [], 1800).then(function (bl) { return { bl: bl, ext: "jpg", tipo: "image/jpeg" }; }) : Promise.resolve({ bl: f, ext: ehPdf ? "pdf" : "xml", tipo: ehPdf ? "application/pdf" : "text/xml" }))
              .then(function (a) { var cam = "admin/receitas/" + dados.emitida_em + "-" + A.uuid() + "." + a.ext; return P.q(P.sb.storage.from("fotos").upload(cam, a.bl, { contentType: a.tipo })).then(function () { return cam; }); })
              .catch(function () { return null; });
            return pArq.then(function (cam) { if (cam) dados.arquivo = cam; return gravarReceita(null, dados); })
              .then(function (n) { P.trocar(P.S.receitas, n); it.salva = true; })
              .catch(function (e) { it.falhou = /duplicate|receitas_chave_idx/i.test(A.msgErro(e)) ? "já lançada" : "erro: " + A.msgErro(e).slice(0, 60); });
          });
        }, Promise.resolve()).then(function () {
          var ok2 = lista.filter(function (it) { return it.salva; }), tot = ok2.reduce(function (t, it) { return t + (Number(it.d.valor) || Number(it.d.bruto) || 0); }, 0);
          A.avisar("🧾 " + ok2.length + " nota(s) lançada(s) · líquido a receber " + dinheiro(tot) + (ok2.length < lista.length ? " · " + (lista.length - ok2.length) + " com problema (veja na tabela)" : ""), ok2.length === lista.length ? "ok" : "erro");
          if (ok2.length === lista.length) { j.fechar(); if (depois) depois(); } else desenhar();
        });
      };
    }
  }
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
      (!n0 && notaRepetida(d.numero, d.chave, null) ? '<div class="aviso erro" id="ft-rep-ini">' + textoRepetida(notaRepetida(d.numero, d.chave, null)) +
        '<div class="acoes" style="margin-top:6px"><button class="peq" id="ft-abrir-rep">📂 Abrir a nota já lançada</button></div></div>' : "") +
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
      { titulo: n0 ? "🧾 Nota de serviço" : "🧾 Nova nota de serviço", larga: true, fixa: true, aoFechar: function () {   // fixa: clicar fora não fecha (só o ✕ ou Esc)
        if (salvou || !mexeu) return;
        A.avisar("📝 Guardei o que você preencheu. Para continuar, toque em “Continuar” em Notas e resultado.", "ok");
        if (depois) depois();
      } });
    var salvou = false, mexeu = !!op.lida || !!op.rascunho || !!op.avulso;
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
    if ($("#ft-abrir-rep", el)) $("#ft-abrir-rep", el).onclick = function () { var x = notaRepetida(d.numero, d.chave, null); j.fechar(); formulario({ nota: x }, depois); };
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
    // rascunho: volta o que estava preenchido
    if (op.rascunho) {
      var rc = op.rascunho.campos || {};
      CAMPOS_RASC.forEach(function (id) { var x = $("#" + id, el); if (x && rc[id] !== undefined) x.value = rc[id]; });
      MARCAS_RASC.forEach(function (id) { var x = $("#" + id, el); if (x && rc[id] !== undefined) x.checked = !!rc[id]; });
      if (RET.some(function (x) { return rc["ft-r-" + x[0]]; })) $("#ft-ret-box", el).open = true;
      verRec(); verAvulso(); conta();
      A.avisar("📝 Continuando a nota que não foi salva.", "ok");
    }
    // guarda sozinho a cada mudança (e já ao abrir uma nota lida do arquivo)
    var arqRasc = op.rascunho ? op.rascunho.arq : null, tRasc = null;
    function salvarRasc() {
      if (salvou) return;
      var campos = {};
      CAMPOS_RASC.forEach(function (id) { var x = $("#" + id, el); if (x) campos[id] = x.value; });
      MARCAS_RASC.forEach(function (id) { var x = $("#" + id, el); if (x) campos[id] = x.checked; });
      guardarRasc({ em: Date.now(), campos: campos, arq: arqRasc,
        op: { notaId: n0 ? n0.id : null, lida: op.lida || null, comprovante: op.comprovante || null, deposito: op.deposito || null, avulso: !!op.avulso, valor: op.valor || null, data: op.data || null, bruto: op.bruto ? String(op.bruto).slice(0, 5000) : null } });
    }
    var mudou = function () { mexeu = true; clearTimeout(tRasc); tRasc = setTimeout(salvarRasc, 300); };
    el.addEventListener("input", mudou); el.addEventListener("change", mudou);
    if (op.arquivo && !arqRasc && op.arquivo.size < 3500000) {
      var fr = new FileReader();
      fr.onload = function () { arqRasc = { url: fr.result, nome: op.arquivo.name || "nota", tipo: op.arquivo.type || "" }; if (mexeu) salvarRasc(); };
      fr.readAsDataURL(op.arquivo);
    }
    if (mexeu) salvarRasc();
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
      if (!n0 && op.deposito) { dados.deposito_id = op.deposito.id || null; dados.deposito_hash = op.deposito.hash || null; if (!dados.valor_recebido) dados.valor_recebido = op.valor || null; }
      // a mesma nota não entra duas vezes (mesma chave da NFS-e ou mesmo número): bloqueia, sem "salvar mesmo assim"
      var rep = !av && notaRepetida(dados.numero_nota, dados.chave_nfse || (n0 && n0.chave_nfse), n0 && n0.id);
      if (rep) { $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + textoRepetida(rep) + "</div>"; return; }
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
        salvou = true; clearTimeout(tRasc); apagarRasc();
        P.trocar(P.S.receitas, n); j.fechar();
        if (n.emitida_em < periodo().de) filtro.periodo = "tudo";
        A.avisar("🧾 Nota salva: " + empresaDe(n) + " · bruto " + dinheiro(contas(n).bruto) + " · ficou " + dinheiro(contas(n).ficou), "ok");
        if (depois) depois();
      }).catch(function (e) {
        A.ocupado(b, false);
        var m = A.msgErro(e);
        if (/valor_bruto|retencoes|imposto_empresa|tomador_cnpj/.test(m)) m = "O banco ainda não tem os campos de impostos. Rode no Supabase o supabase.sql atualizado e depois notify pgrst, 'reload schema';";
        if (/receitas_chave_idx|receitas_numero_idx|duplicate key/i.test(m)) m = "⛔ Esta nota já foi lançada (mesma chave ou mesmo número). Ela não pode ser lançada de novo.";
        $("#ft-erro", el).innerHTML = '<div class="aviso erro">' + esc(m) + "</div>";
      });
    };
    if ($("#ft-apagar", el)) $("#ft-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar esta nota de serviço?")) return;
      P.q(P.sb.from("receitas").delete().eq("id", n0.id)).then(function () { salvou = true; apagarRasc(); P.tirar(P.S.receitas, n0.id); j.fechar(); if (depois) depois(); }).catch(P.falhou);
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
