// Lê o documento "DADOS DAS LOJAS" (Word .doc ou .docx) e devolve a lista de lojas.
// Formato esperado de cada loja (3 linhas, separadas por linha em branco):
//   SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A        LOJA – 141 DONA CLARA
//   Av. SEBASTIÃO DE BRITO   Nº 1415   B: DONA CLARA   BELO HORIZONTE / MG   CEP:31.260-000
//   C.N.P.J.  04.641.376/0119-28        INSC.EST. 002.048.829.1607
// Linhas soltas em maiúsculas (ex.: "DADOS LOJAS VALE DO AÇO/BRETAS") viram a região.
(function (raiz) {
  "use strict";

  // ---------- texto do Word ----------
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }
  function semCampos(t) {
    // códigos de campo do Word: \x13 código \x14 resultado \x15 -> fica só o resultado
    var antes;
    do { antes = t; t = t.replace(/\x13[^\x13\x14\x15]*\x14/g, "").replace(/\x13[^\x13\x14\x15]*\x15/g, ""); } while (t !== antes);
    return t.replace(/\x15/g, "");
  }
  var CP1252 = { 128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡", 136: "ˆ", 137: "‰", 138: "Š", 139: "‹", 140: "Œ", 142: "Ž",
    145: "‘", 146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—", 152: "˜", 153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ" };
  function textoDoc(cfb, CFB) {
    var wd = CFB.find(cfb, "WordDocument");
    if (!wd) throw new Error("Este arquivo não é um documento do Word.");
    var w = wd.content, flags = u16(w, 0x0A);
    var tb = CFB.find(cfb, flags & 0x0200 ? "1Table" : "0Table");
    if (!tb) throw new Error("Documento do Word incompleto.");
    var t = tb.content, fcClx = u32(w, 0x1A2), lcbClx = u32(w, 0x1A6), i = fcClx;
    if (!lcbClx) throw new Error("Documento do Word em formato antigo demais. Salve como .docx e tente de novo.");
    while (t[i] === 1) i += 3 + u16(t, i + 1);
    if (t[i] !== 2) throw new Error("Não consegui ler o texto deste documento.");
    var lcb = u32(t, i + 1), plc = i + 5, n = (lcb - 4) / 12, partes = [];
    for (var k = 0; k < n; k++) {
      var cp0 = u32(t, plc + k * 4), cp1 = u32(t, plc + (k + 1) * 4), fc = u32(t, plc + (n + 1) * 4 + k * 8 + 2), tam = cp1 - cp0, s = "";
      if (fc & 0x40000000) {
        var o = (fc & ~0x40000000) / 2;
        for (var x = 0; x < tam; x++) { var c = w[o + x]; s += c >= 128 && c < 160 ? (CP1252[c] || "") : String.fromCharCode(c); }
      } else {
        for (var y = 0; y < tam; y++) s += String.fromCharCode(u16(w, fc + 2 * y));
      }
      partes.push(s);
    }
    return semCampos(partes.join(""));
  }
  function textoDocx(cfb, CFB) {
    var f = CFB.find(cfb, "word/document.xml") || CFB.find(cfb, "/word/document.xml");
    if (!f) throw new Error("Este arquivo não é um documento do Word.");
    var xml = new TextDecoder("utf-8").decode(f.content instanceof Uint8Array ? f.content : new Uint8Array(f.content));
    var ent = function (s) {
      return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(Number(d)); }).replace(/&amp;/g, "&");
    };
    var linhas = [];
    xml.replace(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g, function (p) {
      var s = "";
      p.replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g, function (m, txt) {
        s += txt !== undefined ? ent(txt) : m === "<w:tab/>" ? "\t" : "\n";
        return m;
      });
      linhas.push(s);
      return p;
    });
    return linhas.join("\n");
  }
  // bytes = Uint8Array do arquivo; CFB = biblioteca SheetJS cfb
  function textoDoWord(bytes, CFB) {
    var zip = bytes[0] === 0x50 && bytes[1] === 0x4B;
    var cfb = CFB.read(bytes, { type: "buffer" });
    return zip ? textoDocx(cfb, CFB) : textoDoc(cfb, CFB);
  }

  // ---------- separar as lojas ----------
  var RE_CNPJ = /(\d{2})\.?\s?(\d{3})\.?(\d{3})\s*\/\s*(\d{4})\s*-?\s*(\d{2})/;
  var RE_CEP = /CEP\s*[.:]?\s*(\d[\d.\- ]{6,11}\d)/i;
  var RE_EMPRESA = /(SUPERM[A-Z0-9_]*\s+BH[^\t]*?(S\/A|LTDA\.?)|TRANSPORTADORAS?\s*BH\s+LTDA|COMERCIO E DISTRIBUICAO SALES LTDA|[A-Z][A-Z .&]+ LTDA\.?|[A-Z][A-Z .&]+ S\/A)/i;
  var CIDADES_BASE = ["BELO HORIZONTE", "CONTAGEM", "BETIM", "SANTA LUZIA", "SABARA", "NOVA LIMA", "IBIRITE", "RIBEIRAO DAS NEVES", "VESPASIANO",
    "LAGOA SANTA", "PEDRO LEOPOLDO", "SERRA", "VITORIA", "VILA VELHA", "CARIACICA", "MONTES CLAROS", "OURO BRANCO"];
  var APELIDOS = { "BHTE": "Belo Horizonte", "BELO HORINTE": "Belo Horizonte", "BELO-HORIZONTE": "Belo Horizonte", "BH": "Belo Horizonte" };

  function semAcento(x) { return String(x || "").normalize("NFD").replace(/[^\x00-\x7f]/g, "").toUpperCase(); }
  function aparar(x, chars) {
    var a = 0, b = x.length;
    while (a < b && chars.indexOf(x[a]) >= 0) a++;
    while (b > a && chars.indexOf(x[b - 1]) >= 0) b--;
    return x.slice(a, b);
  }
  function limpa(x) { return aparar(String(x || "").replace(/\s+/g, " "), " -–/:.,"); }
  function titulo(x) { return String(x || "").replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, function (w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); }); }
  function conectores(x) { return x.replace(/(^|[^A-Za-zÀ-ÿ])(De|Da|Do|Das|Dos)(?=$|[^A-Za-zÀ-ÿ])/g, function (m, a, b) { return a + b.toLowerCase(); }); }
  function romanos(x) {
    return x.replace(/(^|[^A-Za-zÀ-ÿ])([IiVvXx]{1,4})(?=$|[^A-Za-zÀ-ÿ])/g, function (m, a, r) {
      return a + (/^x{0,3}(ix|iv|v?i{0,3})$/i.test(r) ? r.toUpperCase() : r);
    });
  }

  function blocosDoTexto(texto) {
    var t = texto.replace(/\r/g, "\n").replace(/\x07/g, "\n").replace(/\x0b/g, "\n").replace(/\xa0/g, " ")
      .replace(/[\x00-\x08\x0c\x0e-\x1f]/g, "").replace(/_{2,}/g, " ");
    var secao = "", blocos = [], atual = [];
    t.split("\n").forEach(function (l) {
      var s = l.trim();
      if (!s) { if (atual.length) { blocos.push([secao, atual]); atual = []; } return; }
      if (/^C\.?\s?N\.?\s?P\.?\s?J/i.test(s) && !RE_CNPJ.test(s)) return;
      if (!RE_CNPJ.test(s) && !RE_CEP.test(s) && !RE_EMPRESA.test(s) && !/N[º°:]\s*\d|B\s*:/.test(s) && s.toUpperCase() === s && s.length < 70) {
        if (atual.length) { blocos.push([secao, atual]); atual = []; }
        secao = s; return;
      }
      atual.push(s);
    });
    if (atual.length) blocos.push([secao, atual]);
    return blocos;
  }

  function lerBloco(secao, linhas) {
    var txt = linhas.join("\n"), m = RE_CNPJ.exec(txt), mcep = RE_CEP.exec(txt);
    var cab = linhas[0], me = RE_EMPRESA.exec(cab);
    var empresa = me ? limpa(me[0]) : "";
    var nome = limpa(me ? cab.slice(me.index + me[0].length) : cab).replace(/^C\/C\s*\d+\s*/, "");
    var mc = /LOJA\s*[-–]*\s*(\d+)/i.exec(nome) || /^(\d+)\s*[-–]/.exec(nome) || /[-–]\s*(\d+)\s*$/.exec(nome);
    var cod = mc ? (mc[1].replace(/^0+/, "") || "0") : "";
    if (!m && !mcep) {
      // só o cabeçalho com nº da loja (endereço ainda não preenchido no documento)
      if (!me || !cod) return null;
      nome = nome.split(/\s\/\s|\s{2,}|\t/)[0];
      return { regiao: secao, codigo: cod, nomeBruto: nome, empresa: empresa, endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "MG", cep: "", cnpj: "" };
    }
    var cnpj = m ? m[1] + "." + m[2] + "." + m[3] + "/" + m[4] + "-" + m[5] : "";
    var endL = "";
    for (var i = 1; i < linhas.length; i++) { if (/^\s*(C\.?\s?N\.?\s?P\.?\s?J|CNPJ)/i.test(linhas[i])) continue; endL = linhas[i]; break; }
    var cep = mcep ? mcep[1].replace(/\D/g, "") : "";
    var e = endL ? endL.split(/CEP\s*[.:]?\s*\d[\d.\- ]{6,11}\d/i)[0] : "";
    e = e.replace(/(CNPJ|C\.N\.P\.J).*$/i, "").replace(/\t/g, "   ").replace(/\s*CEP\s*[.:-]*\s*[\d.\- ]*$/i, "");
    var uf = "", mu = /\s*\/?\s*\b(MG|ES|SP|RJ|GO|BA|DF)\s*[-–]?\s*$/.exec(e);
    if (mu) { uf = mu[1]; e = e.slice(0, mu.index); }
    var mb = /(?:^|\s)B\s*:\s*|\s{2,}B\s+(?=[A-ZÀ-Ú])|\s[-–]\s*B\s*:?\s*/.exec(e), ruaNum = e, resto = "";
    if (mb) { ruaNum = e.slice(0, mb.index); resto = e.slice(mb.index + mb[0].length); }
    var br = resto.trim().split(/\s{2,}/).filter(function (x) { return aparar(x, " -–"); });
    var bairro = "", cidade = "";
    if (br.length >= 2) { bairro = br.slice(0, -1).join(" "); cidade = br[br.length - 1]; } else if (br.length) { bairro = br[0]; cidade = "?"; }
    var mn = /\s+N\s*[º°o:.]\s*|\s+º\s*|\s+N\s+(?=\d)|,\s*(?=\d)|\s+(?=S\/N\b)/.exec(ruaNum), rua = ruaNum, numero = "";
    if (mn) { rua = ruaNum.slice(0, mn.index); numero = ruaNum.slice(mn.index + mn[0].length); }
    rua = limpa(rua).replace(/^(R|AV|ROD|PRACA|PÇA|AL|TV)\s*[:.]\s*/i, function (x, t1) { return t1 + " "; });
    var pn = numero.replace(/[-–]\s*$/, "").trim().split(/\s{2,}/).filter(function (x) { return x.trim(); });
    numero = pn.length ? limpa(pn[0]) : "";
    var extra = pn.slice(1), complemento = "";
    if (extra.length && !bairro && !cidade) {
      if (extra.length >= 2) { bairro = extra.slice(0, -1).join(" "); cidade = extra[extra.length - 1]; } else { bairro = extra[0]; cidade = "?"; }
    } else if (extra.length) complemento = limpa(extra.join(" "));
    var mcomp = /^(\d+)\s+(.+)$/.exec(numero);
    if (mcomp && !complemento) { numero = mcomp[1]; complemento = mcomp[2]; }
    // "N.º 1580" -> número 1580
    rua = rua.replace(/\s+N?\s*\.?\s*[º°]\s*$/, "").trim();
    var mr = /^(.*?)\s+N?\.?\s*[º°]\s*(\d.*)$/.exec(rua);
    if (mr && !numero) { rua = mr[1]; numero = mr[2]; }
    numero = numero.replace(/^[º°.: ]+/, "");
    return { regiao: secao, codigo: cod, nomeBruto: nome, empresa: empresa, endereco: rua, numero: numero, complemento: complemento,
      bairro: limpa(bairro), cidade: limpa(cidade), uf: uf || "MG", cep: cep.length === 8 ? cep : "", cnpj: cnpj };
  }

  function extrairLojas(texto) {
    var lojas = blocosDoTexto(texto).map(function (b) { return lerBloco(b[0], b[1]); }).filter(Boolean);
    // cidades conhecidas (das linhas bem separadas) para separar "BAIRRO CIDADE" com um espaço só
    var conj = {};
    lojas.forEach(function (x) { if (x.cidade && x.cidade !== "?") conj[semAcento(x.cidade)] = 1; });
    CIDADES_BASE.forEach(function (c) { conj[c] = 1; });
    var conhecidas = Object.keys(conj).sort(function (a, b) { return b.length - a.length; });
    lojas.forEach(function (x) {
      if (x.cidade === "?") {
        var b = x.bairro, sb = semAcento(b), achou = "";
        for (var i = 0; i < conhecidas.length; i++) { if (sb === conhecidas[i] || sb.slice(-conhecidas[i].length - 1) === " " + conhecidas[i]) { achou = conhecidas[i]; break; } }
        if (achou) { x.cidade = b.slice(b.length - achou.length).trim(); x.bairro = aparar(b.slice(0, b.length - achou.length).trim(), " -–"); } else x.cidade = "";
      }
      if (x.cidade && x.bairro) {   // "SANTA   LUZIA" (cidade de 2 palavras com espaço largo)
        var pal = x.bairro.split(" ");
        for (var k = 1; k <= 2; k++) {
          if (pal.length > k && conj[semAcento(pal.slice(-k).join(" ") + " " + x.cidade)]) { x.cidade = pal.slice(-k).join(" ") + " " + x.cidade; x.bairro = pal.slice(0, -k).join(" "); break; }
        }
      }
      x.cidade = APELIDOS[semAcento(x.cidade)] || x.cidade;
      x.cidade = conectores(titulo(x.cidade));
      x.bairro = conectores(titulo(x.bairro));
    });
    // grafia única por cidade (prefere a com acento mais usada)
    var grupos = {};
    lojas.forEach(function (x) { var k = semAcento(x.cidade); (grupos[k] = grupos[k] || []).push(x.cidade); });
    Object.keys(grupos).forEach(function (k) {
      var cont = {}, ordem = [];
      grupos[k].forEach(function (c) { if (!(c in cont)) { cont[c] = 0; ordem.push(c); } cont[c]++; });
      var com = ordem.filter(function (c) { return /[^\x00-\x7f]/.test(c); }), cand = com.length ? com : ordem, melhor = cand[0];
      cand.forEach(function (c) { if (cont[c] > cont[melhor]) melhor = c; });
      lojas.forEach(function (x) { if (semAcento(x.cidade) === k) x.cidade = melhor; });
    });
    // CEP faltando/errado: usa o de outra loja no mesmo endereço
    lojas.forEach(function (x) {
      if (x.cep || !x.endereco) return;
      var igual = lojas.filter(function (y) { return y !== x && y.cep && semAcento(y.endereco) === semAcento(x.endereco) && y.numero === x.numero && semAcento(y.cidade) === semAcento(x.cidade); })[0];
      if (igual) x.cep = igual.cep;
    });
    // nome curto e tipo
    lojas.forEach(function (x) {
      var up = x.nomeBruto.toUpperCase();
      var n = x.nomeBruto.replace(/LOJA\s*[-–]*\s*\d+\s*[-–]*/i, "").trim().replace(/^\d+\s*[-–]\s*/, "").replace(/\s*[-–]\s*\d+\s*$/, "");
      n = aparar(n.replace(/\s+/g, " "), " -–/");
      x.tipo = /POSTO/.test(up) ? "posto" : /\bCD\b|ALMOX|DEP\. PESSOAL/.test(up) ? "cd" : "loja";
      if (!n) n = /^SUPERM/i.test(x.empresa) ? "Escritório " + titulo(x.endereco) : titulo(x.empresa);
      x.nome = conectores(romanos(titulo(n))).replace(/(^|\s)Cd(?=\s|$)/g, "$1CD");
      x.regiao = conectores(titulo(x.regiao));
      if (!x.cidade && !x.endereco && x.tipo === "loja") x.cidade = titulo(n);   // loja nova sem endereço: usa o nome (geralmente a cidade)
      delete x.nomeBruto;
    });
    return lojas;
  }

  var API = { textoDoWord: textoDoWord, extrairLojas: extrairLojas, semAcento: semAcento };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.AGE_LOJAS_DOC = API;
})(typeof window !== "undefined" ? window : this);
