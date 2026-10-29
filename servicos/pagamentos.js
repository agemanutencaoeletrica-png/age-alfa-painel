// Painel do dono — 💰 PAGAMENTOS da equipe (Pix):
// o comprovante do app do banco (imagem, PDF ou texto, pelo "Compartilhar" ou escolhendo o arquivo)
// é lido pelo app: valor, data, hora e quem recebeu. Você confere, ele guarda com o comprovante e
// monta o relatório por semana com o total de cada funcionário. Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { periodo: "4sem", func: "", de: "", ate: "", forma: "" };
  var TIPOS = { diaria: "Diária", salario: "Salário", adiantamento: "Adiantamento", vale: "Vale", reembolso: "Reembolso (material/combustível)", outro: "Outro" };
  var MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  var TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function dois(n) { return String(n).padStart(2, "0"); }
  function dinheiro(v) { return A.dinheiro(Number(v) || 0); }

  // ---------------- leitura do comprovante ----------------
  var ROT_DEST = /^(destino|destinat[aá]rio|para|recebedor|favorecido|quem recebeu|dados do recebedor|dados de quem recebeu|pago para|transferido para|enviado para)\b[:\s-]*/i;
  var ROT_FIM = /^(origem|pagador|quem pagou|dados do pagador|de)\b/i;
  var NAO_NOME = /cpf|cnpj|institui|banco|ag[eê]ncia|conta|chave|tipo|valor|data|hor[aá]rio|autentica|transa|identifica|comprovante|pix|\d{3}|\*{2}|•/i;
  function limpar(n) { return String(n || "").replace(/\s+/g, " ").replace(/[^A-Za-zÀ-ú.' ]/g, "").trim().slice(0, 120); }
  function pareceNome(x) { return !NAO_NOME.test(x) && /^[A-Za-zÀ-ú][A-Za-zÀ-ú.' ]*\s+[A-Za-zÀ-ú.' ]+$/.test(x.trim()); }
  // nome que o comprovante quebrou em 2 linhas ("MATEUS HENRIQUE SILVA DE" / "PAULA")
  function comContinuacao(ls, k, nome) {
    var prox = ls[k + 1];
    if (prox && /^[A-ZÀ-Ú][A-ZÀ-Ú' ]{1,40}$/.test(prox) && !NAO_NOME.test(prox) && !ROT_FIM.test(prox) && nome === nome.toUpperCase()) return nome + " " + prox;
    return nome;
  }
  function favorecido(ls) {
    for (var i = 0; i < ls.length; i++) {
      var m = ls[i].match(ROT_DEST);
      if (!m) continue;
      var resto = ls[i].slice(m[0].length).replace(/^nome\b[:\s]*/i, "").trim();
      if (resto && pareceNome(resto)) return limpar(resto);
      for (var k = i + 1; k < Math.min(ls.length, i + 8); k++) {
        var x = ls[k];
        if (ROT_FIM.test(x)) break;
        if (/^nome\b/i.test(x)) {
          var v = x.replace(/^nome\b[:\s]*/i, "");
          if (v && pareceNome(v)) return limpar(comContinuacao(ls, k, v));
          if (ls[k + 1] && pareceNome(ls[k + 1])) return limpar(comContinuacao(ls, k + 1, ls[k + 1]));
          continue;
        }
        if (pareceNome(x)) return limpar(comContinuacao(ls, k, x));
      }
    }
    return "";
  }
  // texto do comprovante -> { valor, data (aaaa-mm-dd), hora (hh:mm), favorecido, id }
  function lerPix(texto) {
    var t = String(texto || "").replace(/\r/g, ""), ls = t.split("\n").map(function (x) { return x.trim(); }).filter(Boolean), r = {};
    var mv = t.match(/valor[^\n\d]{0,40}?R\s?[$S5]?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i) || t.match(/R\s?[$S5]\s*(\d{1,3}(?:\.\d{3})*,\d{2})/) || t.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/);
    if (mv) r.valor = A.lerNumero(mv[1]);
    var md = t.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[^\d\n]{1,8}(\d{2})[:h](\d{2}))?/);
    var mm = semAcento(t).match(/(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(?:de\s+)?(\d{4})(?:[^\d\n]{1,10}(\d{2})[:h](\d{2}))?/);
    if (md) { r.data = md[3] + "-" + md[2] + "-" + md[1]; if (md[4]) r.hora = md[4] + ":" + md[5]; }
    else if (mm) { r.data = mm[3] + "-" + dois(MESES[mm[2]]) + "-" + dois(mm[1]); if (mm[4]) r.hora = mm[4] + ":" + mm[5]; }
    if (!r.hora) { var mh = t.match(/\b([01]\d|2[0-3])[:h]([0-5]\d)(?::[0-5]\d)?\b/); if (mh) r.hora = mh[1] + ":" + mh[2]; }
    var mi = t.replace(/\s/g, "").match(/E\d{8}[0-9A-Za-z]{23}/);
    if (mi) r.id = mi[0];
    else {
      // "ID da transação" / "Autenticação": o código pode vir quebrado em várias linhas
      // primeiro o "ID da transação" (só números: o leitor de imagem acerta mais), depois a autenticação
      var rotulos = [/^(id da transa|identificador|codigo da transa)/, /^autentica/];
      for (var q = 0; q < rotulos.length && !r.id; q++) for (var i = 0; i < ls.length && !r.id; i++) {
        if (!rotulos[q].test(semAcento(ls[i]))) continue;
        var cod = ls[i].replace(/^[^:]*:?/, "").replace(/[^0-9A-Za-z]/g, "");
        for (var k = i + 1; k < ls.length && /^[0-9A-Za-z ]{6,}$/.test(ls[k]) && !/[a-z]{4,}/.test(ls[k]); k++) cod += ls[k].replace(/\s/g, "");
        if (cod.length >= 16) r.id = cod.slice(0, 80);
      }
    }
    // chave Pix e CPF de quem recebeu (parte "para"): é por eles que o app acha o funcionário
    var mc = t.match(/chave(?:\s+pix)?\s*[:-]?\s*([^\s][^\n]*)/i);
    if (mc) r.chave = mc[1].trim().slice(0, 120);
    var noDestino = false;
    ls.forEach(function (x) {
      if (ROT_DEST.test(x)) noDestino = true; else if (ROT_FIM.test(x)) noDestino = false;
      // CPF mascarado ("***.832.066-**"): guarda só os dígitos que aparecem
      var mcpf = noDestino && x.match(/cpf\b(.*)$/i);
      if (mcpf && !r.cpf) { var vis = mcpf[1].replace(/^[^\d*•"]*/, "").replace(/\D/g, ""); if (vis.length >= 5) r.cpf = vis; }
    });
    r.favorecido = favorecido(ls);
    return r;
  }
  // nome do comprovante -> funcionário da equipe (primeiro nome igual ou dois nomes em comum)
  // 1º pela chave Pix cadastrada, 2º pelo CPF parcial, 3º pelo telefone, 4º pelo nome. Devolve { f, por }
  function soDig(x) { return String(x || "").replace(/\D/g, ""); }
  function mesmaChave(a, b) {
    a = String(a || "").trim().toLowerCase(); b = String(b || "").trim().toLowerCase();
    if (!a || !b) return false;
    if (a.indexOf("@") >= 0 || b.indexOf("@") >= 0 || /[a-f0-9]{8}-[a-f0-9]{4}/.test(a)) return a.replace(/\s/g, "") === b.replace(/\s/g, "");
    var da = soDig(a), db = soDig(b);
    return da.length >= 8 && db.length >= 8 && (da === db || da.slice(-8) === db.slice(-8) && Math.min(da.length, db.length) <= 13);
  }
  function cpfConfere(visiveis, cpf) {
    var v = soDig(visiveis), d = soDig(cpf);
    return d.length === 11 && v.length >= 5 && (v === d || d.indexOf(v) >= 0);
  }
  function acharFunc(nome, chave, cpf) {
    var fs = P.S.func;
    var f = chave && fs.filter(function (x) { return x.pix && mesmaChave(x.pix, chave); })[0];
    if (f) return { f: f, por: "chave Pix" };
    f = cpf && fs.filter(function (x) { return x.pix && cpfConfere(cpf, x.pix); })[0];
    if (f) return { f: f, por: "CPF" };
    var fim = soDig(chave).slice(-8);
    f = fim.length === 8 && fs.filter(function (x) { return soDig(x.telefone).slice(-8) === fim; })[0];
    if (f) return { f: f, por: "telefone" };
    f = acharPorNome(nome);
    return f ? { f: f, por: "nome" } : null;
  }
  function acharPorNome(nome) {
    var tk = semAcento(nome).split(/[^a-z]+/).filter(function (w) { return w.length >= 3 && !/^(dos|das)$/.test(w); });
    if (!tk.length) return null;
    var melhor = null, nota = 0;
    P.S.func.forEach(function (f) {
      var fk = semAcento(f.nome).split(/[^a-z]+/).filter(function (w) { return w.length >= 3; });
      var n = tk.filter(function (w) { return fk.indexOf(w) >= 0; }).length, primeiro = fk[0] === tk[0];
      var sc = n + (primeiro ? 1 : 0);
      if (sc > nota && (n >= 2 || primeiro)) { nota = sc; melhor = f; }
    });
    return melhor;
  }

  // ---------------- arquivos: imagem (OCR), PDF ou texto ----------------
  var scripts = {};
  function carregarScript(url, pronto) {
    if (pronto()) return Promise.resolve();
    if (!scripts[url]) scripts[url] = new Promise(function (ok, falha) {
      var sc = document.createElement("script");
      sc.src = url;
      sc.onload = function () { pronto() ? ok() : falha(new Error("Falha ao carregar o leitor.")); };
      sc.onerror = function () { delete scripts[url]; sc.remove(); falha(new Error("Sem internet para ler o comprovante. Tente de novo.")); };
      document.head.appendChild(sc);
    });
    return scripts[url];
  }
  var leitor = null, progresso = null;
  // op: { psm: "6" (bloco, padrão do tesseract.js) ou "3"/"4" (página/colunas), endireitar: true (corrige foto torta), cinza: true (sem preto e branco), giro: 0/90/270 já conhecido }
  // devolve { texto, giro }
  function ocr(f, op) {
    op = op || {};
    return carregarScript(TESS + "tesseract.min.js", function () { return !!window.Tesseract; }).then(function () {
      if (!leitor) leitor = window.Tesseract.createWorker("por", 1, {
        workerPath: TESS + "worker.min.js", corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
        langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por@1.0.0/4.0.0_best_int",
        logger: function (m) { if (progresso && m.status === "recognizing text") progresso(Math.round(m.progress * 100)); }
      }).catch(function (e) { leitor = null; throw e; });
      return leitor;
    }).then(function (w) {
      // foto deitada (comum em nota grande): se a leitura sai ruim, tenta girada para os dois lados e fica com a melhor
      var ler = function (giro) {
        return w.setParameters({ tessedit_pageseg_mode: op.psm || "6" }).then(function () { return realcar(f, giro, op.cinza, op.endireitar); })
          .then(function (img) { return w.recognize(img); }).then(function (r) { return { texto: r.data.text || "", giro: giro }; });
      };
      if (op.giro !== undefined) return ler(op.giro);
      return ler(0).then(function (t0) {
        if (qualidade(t0.texto) >= 20) return t0;
        return ler(90).then(function (t1) {
          return ler(270).then(function (t2) {
            return [t0, t1, t2].sort(function (a, b) { return qualidade(b.texto) - qualidade(a.texto); })[0];
          });
        });
      });
    });
  }
  // nota de leitura: valores em reais e palavras de verdade
  // nota da leitura: valores em dinheiro e palavras de verdade de nota/comprovante (foto deitada dá só "letras soltas", que não contam)
  var VOCAB = /^(valor|total|nota|fiscal|data|emissao|cnpj|cpf|produto|produtos|descricao|quantidade|quant|unitario|unit|rua|avenida|bairro|cep|municipio|endereco|telefone|fone|pagamento|pix|cartao|dinheiro|troco|documento|eletronica|consumidor|chave|acesso|protocolo|serie|item|codigo|desconto|icms|frete|inscricao|estadual|razao|social|destinatario|emitente|transferencia|comprovante|para|nome|instituicao|banco|agencia|conta|horario|tipo|cupom|venda|cliente|vencimento|fatura|natureza|operacao|tributos|forma|pagto|danfe|saida|entrada|autorizacao|transacao|enviado|recebido|realizado|origem|destino|subtotal|qtde|qtd|vendedor|pedido)$/;
  function qualidade(t) {
    var pal = (semAcento(t).match(/[a-z]+/g) || []).filter(function (x) { return VOCAB.test(x); }).length;
    return (String(t).match(/\d,\d{2}\b/g) || []).length * 2 + pal * 3;
  }
  // foto de papel (sombra, inclinação): amplia, passa para preto e branco pela claridade de cada região. Melhora muito a leitura de notas.
  // foto um pouco torta (papel inclinado): mede o ângulo das linhas de texto (-6° a 6°) pela projeção dos pontos escuros
  // em cada ângulo; o melhor é o que deixa as linhas mais "cheias" e as entrelinhas mais vazias
  function inclinacao(cv) {
    var k = Math.min(1, 900 / Math.max(cv.width, cv.height)), w = Math.round(cv.width * k), h = Math.round(cv.height * k);
    var c2 = document.createElement("canvas"); c2.width = w; c2.height = h;
    var x2 = c2.getContext("2d"); x2.drawImage(cv, 0, 0, w, h);
    var px = x2.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), i;
    for (i = 0; i < w * h; i++) g[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
    // só o texto: ponto bem mais escuro que a vizinhança, em fundo claro (o papel), sem a mesa escura em volta
    var I = new Float64Array((w + 1) * (h + 1)), xs = [], ys = [], r = Math.max(6, Math.round(Math.max(w, h) / 40)), x, y;
    for (y = 0; y < h; y++) { var sl = 0; for (x = 0; x < w; x++) { sl += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + sl; } }
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        if (m > 110 && g[y * w + x] < m - 30) { xs.push(x - w / 2); ys.push(y); }
      }
    }
    if (xs.length < 500) return 0;
    var melhor = 0, nota = -1;
    for (var a = -6; a <= 6.001; a += 0.25) {
      var t = a * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t), hist = new Float64Array(h * 2 + 2), n = 0;
      for (i = 0; i < xs.length; i++) { var yy = Math.round(ys[i] * cs - xs[i] * sn) + h; if (yy >= 0 && yy < hist.length) hist[yy]++; }
      for (i = 0; i < hist.length; i++) n += hist[i] * hist[i];
      if (n > nota * 1.0005) { nota = n; melhor = a; }   // empate: fica com o menor giro
    }
    return Math.abs(melhor) >= 0.5 ? melhor : 0;
  }
  function realcar(f, giro, cinza, endireitar) {
    if (!window.createImageBitmap) return Promise.resolve(f);
    return createImageBitmap(f).then(function (bmp) {
      var k = Math.min(2, 3200 / Math.max(bmp.width, bmp.height)), w0 = Math.round(bmp.width * k), h0 = Math.round(bmp.height * k);
      var deitar = giro === 90 || giro === 270, W = deitar ? h0 : w0, H = deitar ? w0 : h0;
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      var cx = cv.getContext("2d");
      if (giro) { cx.translate(W / 2, H / 2); cx.rotate(giro * Math.PI / 180); cx.drawImage(bmp, -w0 / 2, -h0 / 2, w0, h0); cx.setTransform(1, 0, 0, 1, 0, 0); }
      else cx.drawImage(bmp, 0, 0, W, H);
      if (bmp.close) bmp.close();
      // endireita a foto torta (leitura extra da nota): as colunas de preço não "sobem" para a linha do material de cima
      var ang = endireitar ? inclinacao(cv) : 0;
      if (ang) {
        var cr = document.createElement("canvas"); cr.width = W; cr.height = H;
        var xr = cr.getContext("2d"); xr.fillStyle = "#fff"; xr.fillRect(0, 0, W, H);
        xr.translate(W / 2, H / 2); xr.rotate(-ang * Math.PI / 180); xr.drawImage(cv, -W / 2, -H / 2);
        cv = cr; cx = xr; cx.setTransform(1, 0, 0, 1, 0, 0);
      }
      var d = cx.getImageData(0, 0, W, H), px = d.data, g = new Float32Array(W * H), I = new Float64Array((W + 1) * (H + 1)), x, y;
      for (var i = 0; i < W * H; i++) g[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
      if (cinza) {   // só tons de cinza (a 2ª leitura de nota usa assim)
        for (i = 0; i < W * H; i++) px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g[i];
        cx.putImageData(d, 0, 0);
        return new Promise(function (ok) { cv.toBlob(function (b) { ok(b || f); }, "image/png"); });
      }
      for (y = 0; y < H; y++) { var sl = 0; for (x = 0; x < W; x++) { sl += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + sl; } }
      var r = Math.max(8, Math.round(Math.max(W, H) / 60));
      for (y = 0; y < H; y++) {
        var y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
        for (x = 0; x < W; x++) {
          var x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
          var m = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
          var v = g[y * W + x] < m - 12 ? 0 : 255, o = (y * W + x) * 4;
          px[o] = px[o + 1] = px[o + 2] = v;
        }
      }
      cx.putImageData(d, 0, 0);
      return new Promise(function (ok) { cv.toBlob(function (b) { ok(b || f); }, "image/png"); });
    }).catch(function () { return f; });
  }
  // tabela de materiais de um PDF digital (orçamento ou nota gerada pelo sistema da loja): usa a POSIÇÃO de cada texto na
  // página. Acha o cabeçalho (Descrição, Quantidade, Unidade, Valor unitário, Total), põe cada número na sua coluna e junta
  // a descrição que a loja quebrou em 2 linhas. Devolve { itens, total } ou null se não achar a tabela.
  function tabelaDoPdf(pecas) {
    var P = pecas.filter(function (p) { return p.s.trim(); });
    var acha = function (re) { return P.filter(function (p) { return re.test(p.s.trim()); }); };
    var cab = null;
    acha(/^descri[cç][aã]o|^produto|^material|^mercadoria/i).some(function (d) {
      var mesma = function (re) { return P.filter(function (p) { return Math.abs(p.y - d.y) < 4 && re.test(p.s.trim()); })[0] || null; };
      var q = mesma(/^(quant|qtd|qtde|qde)/i), t = mesma(/^(valor\s*)?total|^vl\.?\s*total|^subtotal/i);
      if (q && t) { cab = { y: d.y, desc: d, qtd: q, tot: t, un: mesma(/^(un|und|unid|unidade|u\.?m\.?)\.?$/i), unit: mesma(/unit|^valor\s*un|^vl\.?\s*un|^pre[cç]o|^v\.?\s*un/i),
        extra: mesma(/^desc\.\s*\/|acr[eé]sc|^desconto$|^ipi$|^icms$/i) };   // "extra": coluna que não interessa, mas recebe números
        return true;
      }
      return false;
    });
    if (!cab) return null;
    var num = /^-?\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?$|^-?\d+(?:,\d{1,4})?$/;
    var colunas = ["qtd", "un", "unit", "extra", "tot"].filter(function (k) { return cab[k]; }).map(function (k) { return { k: k, c: cab[k].x + cab[k].w / 2 }; });
    var fimY = -1e9;   // a tabela acaba no primeiro "Total ..." abaixo do cabeçalho que não é a coluna Total
    P.forEach(function (p) { if (p.y < cab.y - 4 && /^(total|valor total|sub-?total|desconto|forma de pag|observa)/i.test(p.s.trim()) && p.y > fimY && p !== cab.tot) fimY = p.y; });
    var corpo = P.filter(function (p) { return p.y < cab.y - 4 && p.y > fimY + 2; });
    // linhas: onde há quantidade na coluna "Quantidade"
    var colDe = function (p) { var cx = p.x + p.w / 2, m = null, dm = 1e9; colunas.forEach(function (c) { var d = Math.abs(c.c - cx); if (d < dm) { dm = d; m = c.k; } }); return m; };
    var linhas = [];
    corpo.forEach(function (p) {
      var s = p.s.trim();
      // só número que está mesmo embaixo de "Quantidade" (não um código no meio da descrição)
      if (num.test(s) && colDe(p) === "qtd" && p.x + p.w > cab.qtd.x - 10 && !linhas.some(function (l) { return Math.abs(l.y - p.y) < 2; })) linhas.push({ y: p.y, qtd: A.lerNumero(s), desc: [] });
    });
    if (!linhas.length) return null;
    linhas.sort(function (a, b) { return b.y - a.y; });
    var gaps = linhas.slice(1).map(function (l, i) { return linhas[i].y - l.y; }).sort(function (x, y) { return x - y; });
    var passo = gaps.length ? Math.max(6, gaps[Math.floor(gaps.length / 2)]) : 12;   // espaço típico entre linhas (mediana)
    var maisPerto = function (y) { var m = null, dm = 1e9; linhas.forEach(function (l) { var d = Math.abs(l.y - y); if (d < dm) { dm = d; m = l; } }); return dm <= passo * 0.75 ? m : null; };
    corpo.forEach(function (p) {
      var s = p.s.trim(), l = maisPerto(p.y); if (!l) return;
      var limiteDesc = cab.qtd.x - 2;
      if (/[A-Za-zÀ-ú]/.test(s) && p.x >= cab.desc.x - 25 && p.x < limiteDesc) { l.desc.push(p); return; }
      if (cab.un && colDe(p) === "un" && /^[A-Za-z²³]{1,5}\.?$/.test(s)) { l.un = s.toLowerCase().replace(/\.$/, ""); return; }
      if (num.test(s)) { var k = colDe(p); if (k === "unit" && l.unit == null) l.unit = A.lerNumero(s); else if (k === "tot") l.valor = A.lerNumero(s); }
    });
    var itens = linhas.map(function (l) {
      var item = l.desc.sort(function (a, b) { return b.y - a.y || a.x - b.x; }).map(function (p) { return p.s.trim(); }).join(" ").replace(/\s+/g, " ").trim();
      var r = { item: item.slice(0, 160), qtd: l.qtd, un: l.un || "un", unit: l.unit != null ? Math.round(l.unit * 100) / 100 : null, valor: l.valor != null ? l.valor : null };
      if (r.valor == null && r.unit) r.valor = Math.round(r.qtd * r.unit * 100) / 100;
      if (r.unit == null && r.valor && r.qtd) r.unit = Math.round(r.valor / r.qtd * 100) / 100;
      return r;
    }).filter(function (r) { return r.item && r.qtd > 0; });
    if (!itens.length) return null;
    // total a pagar: "Total líquido" / "Total a pagar" / "Valor total" e o número logo abaixo (ou ao lado)
    var total = null;
    acha(/total\s*l[ií]quido|total\s*a\s*pagar|valor\s*total\s*(da\s*nota|a\s*pagar)?$|^total\s*geral|^total\s*da\s*(nota|venda|proposta)/i).some(function (h) {
      if (h.y >= cab.y - 4) return false;
      var cand = P.filter(function (p) { return num.test(p.s.trim()) && /,\d{2}$/.test(p.s.trim()) && ((p.y < h.y && h.y - p.y < 25 && Math.abs((p.x + p.w) - (h.x + h.w)) < 60) || (Math.abs(p.y - h.y) < 4 && p.x > h.x + h.w - 2)); })
        .sort(function (a, b) { return Math.abs(a.y - h.y) - Math.abs(b.y - h.y) || a.x - b.x; });
      if (cand.length) { total = A.lerNumero(cand[0].s.trim()); return true; }
      return false;
    });
    return { itens: itens, total: total };
  }
  function lerPdf(f) {
    return carregarScript(PDFJS + "pdf.min.js", function () { return !!window.pdfjsLib; }).then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      return f.arrayBuffer();
    }).then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (doc) {
      return doc.getPage(1).then(function (pg) {
        return pg.getTextContent().then(function (tc) {
          // junta os pedaços por linha (mesma altura na página)
          var linhas = [], ultY = null;
          tc.items.forEach(function (it) {
            var y = Math.round(it.transform[5]);
            if (ultY === null || Math.abs(y - ultY) > 3) linhas.push(it.str); else linhas[linhas.length - 1] += " " + it.str;
            ultY = y;
          });
          // e a tabela pela posição na página (orçamento de loja com as colunas fora de ordem no texto)
          var tabela = null;
          try { tabela = tabelaDoPdf(tc.items.map(function (it) { return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }; })); } catch (e) { tabela = null; }
          // a primeira página vira imagem para guardar como comprovante
          var vp = pg.getViewport({ scale: 1.6 }), cv = document.createElement("canvas");
          cv.width = vp.width; cv.height = vp.height;
          return pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
            return new Promise(function (ok) { cv.toBlob(function (b) { ok({ texto: linhas.join("\n"), imagem: b, tabela: tabela }); }, "image/jpeg", 0.85); });
          });
        });
      });
    });
  }
  function textoDoArquivo(f, op) {
    if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name || "")) return lerPdf(f);
    if (/^image\//.test(f.type)) return ocr(f, op).then(function (o) { return { texto: o.texto, imagem: f, giro: o.giro }; });
    return f.text().then(function (t) { return { texto: t, xml: /xml/i.test(f.type) || /\.xml$/i.test(f.name || "") || /<infNFe/i.test(t) }; });
  }

  // ---------------- conferir e salvar ----------------
  // entrada: { arquivos: [File], texto } (do Compartilhar, do botão ou colado)
  function receber(rc, ctx) {
    P = ctx;
    if (P.S.semPag) { A.avisar("Rode de novo o supabase.sql no Supabase para usar os pagamentos.", "erro"); return; }
    var itens = [], fila = (rc.arquivos || []).slice(0, 20);
    var titulo = rc.especie ? "💵 Pagamento em dinheiro" : "💰 Registrar pagamento Pix";
    var j = A.janela('<div id="pg-st" class="peq"></div><div id="pg-resumo"></div><div id="pg-itens"></div><div id="pg-erro"></div>' +
      '<div class="acoes"><button class="prim" id="pg-salvar" disabled>Salvar pagamentos</button></div>', { titulo: titulo, larga: true, fixa: true });
    var el = j.el;
    function status(t) { $("#pg-st", el).innerHTML = t; }
    var feitos = 0;
    var pLer = fila.reduce(function (pr, f, i) {
      return pr.then(function () {
        progresso = function (n) { status("📖 Lendo o comprovante " + (i + 1) + " de " + fila.length + "... " + n + "%"); };
        status("📖 Lendo o comprovante " + (i + 1) + " de " + fila.length + "... (a 1ª vez demora um pouco)");
        return textoDoArquivo(f).then(function (r) { itens.push(Object.assign(lerPix(r.texto), { imagem: r.imagem, texto: r.texto })); },
          function (e) { itens.push({ erro: A.msgErro(e), nome: f.name, imagem: /^image\//.test(f.type) ? f : null }); });
      }).then(function () { feitos++; });
    }, Promise.resolve());
    pLer.then(function () {
      // texto sem arquivo (comprovante compartilhado como texto ou colado)
      if (rc.texto && !fila.length) itens.push(Object.assign(lerPix(rc.texto), { texto: rc.texto }));
      if (rc.especie) { var ag = new Date(); itens.push({ forma: "especie", data: A.isoLocal(ag), hora: dois(ag.getHours()) + ":" + dois(ag.getMinutes()) }); }
      progresso = null;
      status(rc.especie ? "Preencha o pagamento feito em dinheiro." : itens.length ? "Confira os dados lidos e corrija o que precisar." : "Nada para ler.");
      desenhar();
    });
    function desenhar() {
      $("#pg-itens", el).innerHTML = itens.map(function (it, i) {
        // aberto pela 👷 Equipe: já vem com o funcionário e o tipo (ex.: adiantamento)
        if (it.tipo === undefined && rc.tipo) it.tipo = rc.tipo;
        if (it.funcionario_id === undefined && rc.funcionario_id) { it.funcionario_id = rc.funcionario_id; it.achadoPor = ""; }
        if (it.funcionario_id === undefined) { var ac = it.forma === "especie" ? null : acharFunc(it.favorecido, it.chave, it.cpf); it.funcionario_id = ac ? ac.f.id : ""; it.achadoPor = ac ? ac.por : ""; }
        var f = P.porId(P.S.func, it.funcionario_id);
        // pagamento de uma nota de compra (loja/fornecedor): reconhece a nota não quitada e já deixa marcado para quitar
        if (it.nota === undefined) {
          var nt = it.forma !== "especie" && window.AGE_COMPRAS && P.S.compras ? window.AGE_COMPRAS.notaDoComprovante(it, P.S) : null;
          it.nota = nt ? nt.id : ""; it.quita = !!nt && !it.achadoPor;
        }
        var nota = it.nota ? P.porId(P.S.compras, it.nota) : null;
        var dup = it.quita ? null : duplicado(it);
        return '<div class="cartao" data-it="' + i + '">' +
          (it.imagem ? '<img alt="Comprovante" src="' + URL.createObjectURL(it.imagem) + '" style="max-height:140px;max-width:100%;display:block;margin-bottom:6px;border-radius:6px">' : "") +
          (it.erro ? '<div class="aviso erro">Não consegui ler “' + esc(it.nome || "") + "”: " + esc(it.erro) + ". Preencha à mão.</div>" : "") +
          (dup ? '<div class="aviso erro">⚠️ Parece já registrado: ' + esc(P.nomeFunc(dup.funcionario_id) || dup.favorecido || "") + " · " + dinheiro(dup.valor) + " · " + esc(A.dataHora(dup.pago_em)) + ". Desmarque se for repetido.</div>" : "") +
          (nota ? '<div class="aviso" style="border-left:4px solid var(--critico)">🧾 Bate com a nota não quitada de <b>' + esc(nota.fornecedor || "loja") + "</b> · " + dinheiro(nota.valor) +
            " · compra " + esc(A.dataSimples(nota.comprado_em)) + (nota.vencimento ? " · vence " + esc(A.dataSimples(nota.vencimento)) : "") +
            '<label class="marca-linha" style="margin-top:4px"><input type="checkbox" data-k="quita"' + (it.quita ? " checked" : "") + "> ✔ Quitar esta nota (marca como paga; não lança como pagamento de funcionário)</label></div>" : "") +
          '<label class="marca-linha"><input type="checkbox" data-k="ok"' + (it.ok === false || (it.ok === undefined && dup) ? "" : " checked") + "> Salvar este</label>" +
          (it.forma !== "especie" && (it.favorecido || it.chave) ? '<div class="peq mudo">Para: <b>' + esc(it.favorecido || "") + "</b>" + (it.chave ? " · chave " + esc(it.chave) : "") +
            (f && rc.funcionario_id && it.funcionario_id === rc.funcionario_id ? "" : f && it.achadoPor ? ' · <span class="selo bom">reconhecido pelo ' + esc(it.achadoPor) + "</span>" : f || it.quita ? "" : ' · <span class="selo atencao">não achei na equipe: escolha abaixo e cadastre a chave Pix dele</span>') + "</div>" : "") +
          '<div class="duas"><div><label>Funcionário</label><select data-k="funcionario_id"><option value="">— escolha —</option>' +
          P.S.func.map(function (x) { return '<option value="' + x.id + '"' + (x.id === it.funcionario_id ? " selected" : "") + ">" + esc(x.nome) + "</option>"; }).join("") + "</select></div>" +
          '<div><label>Valor (R$)</label><input data-k="valor" inputmode="decimal" value="' + (it.valor ? Number(it.valor).toFixed(2).replace(".", ",") : "") + '"></div></div>' +
          '<div class="duas"><div><label>Data</label><input type="date" data-k="data" value="' + esc(it.data || A.isoLocal(new Date())) + '"></div>' +
          '<div><label>Horário</label><input type="time" data-k="hora" value="' + esc(it.hora || "") + '"></div></div>' +
          '<div class="duas"><div><label>Forma</label><select data-k="forma"><option value="pix"' + (it.forma !== "especie" ? " selected" : "") + '>Pix</option><option value="especie"' + (it.forma === "especie" ? " selected" : "") + ">💵 Dinheiro (espécie)</option></select></div><div></div></div>" +
          '<div class="duas"><div><label>Tipo</label><select data-k="tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + ((it.tipo || "diaria") === k ? " selected" : "") + ">" + TIPOS[k] + "</option>"; }).join("") + "</select></div>" +
          '<div><label>Observação</label><input data-k="descricao" maxlength="300" value="' + esc(it.descricao || "") + '"></div></div>' +
          (window.AGE_FAT && !P.S.semReceitas ? '<label>Obra / cliente (entra no resultado da obra)</label><input data-k="obra" list="pg-dl-obras" maxlength="200" placeholder="Ex.: DEVA IVECO (contagem) — deixe vazio se for de várias" value="' + esc(it.obra || "") + '">' : "") + "</div>";
      }).join("");
      $$("[data-it]", el).forEach(function (card) {
        var it = itens[Number(card.dataset.it)];
        $$("[data-k]", card).forEach(function (inp) {
          inp.onchange = inp.oninput = function () {
            var k = inp.dataset.k;
            if (k === "ok") it.ok = inp.checked;
            else if (k === "quita") { it.quita = inp.checked; desenhar(); return; }
            else if (k === "valor") it.valor = A.lerNumero(inp.value);
            else it[k] = inp.value;
            resumo();
          };
        });
      });
      if (window.AGE_FAT && !P.S.semReceitas && !$("#pg-dl-obras", el)) $("#pg-itens", el).insertAdjacentHTML("afterend", window.AGE_FAT.datalist(P, "pg-dl-obras"));
      $("#pg-salvar", el).disabled = !itens.length;
      resumo();
    }
    // separado por destinatário: quanto vai para cada um
    function resumo() {
      if (itens.length < 2) { $("#pg-resumo", el).innerHTML = ""; return; }
      var t = {};
      itens.forEach(function (it) { if (it.ok === false) return; var k = it.funcionario_id || "-"; t[k] = t[k] || { n: 0, v: 0 }; t[k].n++; t[k].v += Number(it.valor) || 0; });
      $("#pg-resumo", el).innerHTML = '<div class="cartao peq"><b>Por destinatário:</b> ' + Object.keys(t).map(function (k) {
        return esc(k === "-" ? "não reconhecido" : P.nomeFunc(k)) + " — " + t[k].n + " · <b>" + dinheiro(t[k].v) + "</b>";
      }).join(" · ") + "</div>";
    }
    $("#pg-salvar", el).onclick = function () {
      var b = this, sel = itens.filter(function (it) { return it.ok !== false && !(it.ok === undefined && duplicado(it)); });
      var falta = sel.filter(function (it) { return !(it.quita && it.nota) && (!it.funcionario_id || !(it.valor > 0) || !it.data); });
      var quitadas = 0;
      if (!sel.length) { $("#pg-erro", el).innerHTML = '<div class="aviso erro">Marque pelo menos um pagamento.</div>'; return; }
      if (falta.length) { $("#pg-erro", el).innerHTML = '<div class="aviso erro">Preencha funcionário, valor e data em todos os marcados.</div>'; return; }
      $("#pg-erro", el).innerHTML = ""; A.ocupado(b, true, "Salvando...");
      sel.reduce(function (pr, it) {
        return pr.then(function () {
          if (it.quita && it.nota) return window.AGE_COMPRAS.quitar(it.nota, P, new Date((it.data || A.isoLocal(new Date())) + "T" + (it.hora || "12:00") + ":00")).then(function () { quitadas++; });
          var pComp = !it.imagem ? Promise.resolve(null) : A.prepararFoto(it.imagem, [], 1600).then(function (bl) {
            var cam = "admin/pagamentos/" + it.data + "-" + A.uuid() + ".jpg";
            return P.q(P.sb.storage.from("fotos").upload(cam, bl, { contentType: "image/jpeg" })).then(function () { return cam; });
          }).catch(function () { return null; });   // sem o comprovante, o pagamento ainda é salvo
          return pComp.then(function (cam) {
            var novo = {
              funcionario_id: it.funcionario_id, valor: it.valor, pago_em: new Date(it.data + "T" + (it.hora || "12:00") + ":00").toISOString(),
              tipo: it.tipo || "diaria", forma: it.forma === "especie" ? "especie" : "pix", favorecido: it.favorecido || null, id_transacao: it.id || null, descricao: it.descricao || null, comprovante: cam
            };
            if (it.obra && window.AGE_FAT) Object.assign(novo, window.AGE_FAT.resolver(P, it.obra));   // obra/cliente do pagamento (resultado da obra)
            return P.q(P.sb.from("pagamentos").insert(novo).select().single()).then(function (n) { P.S.pag.unshift(n); });
          });
        });
      }, Promise.resolve()).then(function () {
        j.fechar();
        var np = sel.length - quitadas;
        if (rc.depois) { A.avisar("💰 " + np + " pagamento" + (np > 1 ? "s registrados" : " registrado"), "ok"); rc.depois(); return; }
        A.avisar((np ? "💰 " + np + " pagamento" + (np > 1 ? "s registrados" : " registrado") : "") + (np && quitadas ? " · " : "") +
          (quitadas ? "🧾 " + quitadas + (quitadas > 1 ? " notas quitadas (agora estão como pagas)" : " nota quitada (agora está como paga)") : ""), "ok");
        location.hash = np ? "#pagamentos" : "#compras"; P.rota();
      }).catch(function (e) { A.ocupado(b, false); $("#pg-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
  }
  // já existe: mesma transação Pix, ou mesmo funcionário, valor e horário
  function duplicado(it) {
    return P.S.pag.filter(function (p) {
      if (it.id && p.id_transacao === it.id) return true;
      if (!it.valor || !it.data) return false;
      var d = new Date(p.pago_em), mesmoDia = A.isoLocal(d) === it.data, hora = dois(d.getHours()) + ":" + dois(d.getMinutes());
      return mesmoDia && Number(p.valor) === Number(it.valor) && (!it.hora || hora === it.hora) && (!it.funcionario_id || p.funcionario_id === it.funcionario_id);
    })[0] || null;
  }

  // ---------------- relatório por semana ----------------
  function inicioSemana(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function periodo() {
    var hoje = new Date(), s = inicioSemana(hoje), de, ate;
    var dia = 864e5;
    if (filtro.periodo === "semana") { de = s; ate = new Date(s.getTime() + 7 * dia); }
    else if (filtro.periodo === "passada") { de = new Date(s.getTime() - 7 * dia); ate = s; }
    else if (filtro.periodo === "4sem") { de = new Date(s.getTime() - 21 * dia); ate = new Date(s.getTime() + 7 * dia); }
    else if (filtro.periodo === "mes") { de = new Date(hoje.getFullYear(), hoje.getMonth(), 1); ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1); }
    else if (filtro.periodo === "mespassado") { de = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); ate = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
    else if (filtro.periodo === "tudo") { de = new Date(2000, 0, 1); ate = new Date(2100, 0, 1); }
    else { de = filtro.de ? new Date(filtro.de + "T00:00:00") : new Date(2000, 0, 1); ate = filtro.ate ? new Date(new Date(filtro.ate + "T00:00:00").getTime() + dia) : new Date(2100, 0, 1); }
    return { de: de, ate: ate };
  }
  function lista() {
    var pr = periodo();
    return P.S.pag.filter(function (p) {
      var d = new Date(p.pago_em);
      return d >= pr.de && d < pr.ate && (!filtro.func || p.funcionario_id === filtro.func) &&
        (!filtro.forma || (filtro.forma === "especie") === (p.forma === "especie"));
    }).sort(function (a, b) { return new Date(a.pago_em) - new Date(b.pago_em); });
  }
  function porSemana(ps) {
    var sem = {}, ordem = [];
    ps.forEach(function (p) {
      var k = A.isoLocal(inicioSemana(new Date(p.pago_em)));
      if (!sem[k]) { sem[k] = []; ordem.push(k); }
      sem[k].push(p);
    });
    return ordem.sort().reverse().map(function (k) { return { inicio: k, pags: sem[k] }; });
  }
  function totaisPorFunc(ps) {
    var t = {};
    ps.forEach(function (p) { var k = p.funcionario_id || "-"; t[k] = (t[k] || 0) + Number(p.valor); });
    return Object.keys(t).map(function (k) { return { func: k, total: t[k] }; }).sort(function (a, b) { return b.total - a.total; });
  }
  function ehPix(p) { return p.forma !== "especie"; }
  function soma(ps) { return ps.reduce(function (t, p) { return t + Number(p.valor); }, 0); }
  function fimSemana(ini) { var d = new Date(ini + "T12:00:00"); d.setDate(d.getDate() + 6); return d; }
  function rotuloSemana(ini) { return "Semana de " + A.dataSimples(ini) + " a " + A.data(fimSemana(ini)); }

  function ver(c, ctx) {
    P = ctx;
    if (P.S.semPag) {
      c.innerHTML = '<div class="cab-secao"><h2>💰 Pagamentos</h2></div><div class="aviso">Para usar esta área, rode de novo o arquivo <b>supabase.sql</b> no Supabase ' +
        "(SQL Editor → colar tudo → Run) e depois rode também: <code>notify pgrst, 'reload schema';</code> Ele cria a tabela de pagamentos sem apagar nada. Depois toque em ↻." +
        (P.S.erroPag ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroPag) + "</div>" : "") + "</div>";
      return;
    }
    var din = filtro.forma === "especie";
    c.innerHTML = '<div class="cab-secao"><h2>💰 Pagamentos da equipe</h2><span>' +
      (din ? '<button class="prim" id="pg-especie">💵 Novo pagamento em dinheiro</button> <button id="pg-add">📥 Comprovante Pix</button>'
        : '<button class="prim" id="pg-add">📥 Comprovante Pix</button> <button id="pg-especie">💵 Em dinheiro</button>') + ' <button id="pg-colar">📝 Colar texto</button></span></div>' +
      '<div class="filtros" id="pg-formas">' + [["", "Todos"], ["pix", "Pix"], ["especie", "💵 Dinheiro (espécie)"]].map(function (x) {
        return '<button class="' + (filtro.forma === x[0] ? "prim" : "") + '" data-forma="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>" +
      '<input type="file" id="pg-arq" accept="image/*,application/pdf,.pdf,.zip,application/zip" multiple class="oculto">' +
      '<p class="mudo peq" style="margin-top:-4px">No celular: no app do banco, abra o comprovante, toque em <b>Compartilhar → AGE Painel</b>. Ou toque em 📥 e escolha a imagem/PDF.</p>' +
      '<div class="filtros"><select id="pg-per" aria-label="Período"><option value="semana">Esta semana</option><option value="passada">Semana passada</option><option value="4sem">Últimas 4 semanas</option>' +
      '<option value="mes">Este mês</option><option value="mespassado">Mês passado</option><option value="tudo">Tudo</option><option value="datas">Escolher datas</option></select>' +
      '<select id="pg-func" aria-label="Funcionário"><option value="">Todos os funcionários</option>' + P.S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<input type="date" id="pg-de" aria-label="De" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '"><input type="date" id="pg-ate" aria-label="Até" class="' + (filtro.periodo === "datas" ? "" : "oculto") + '"></div>' +
      '<div id="pg-res"></div>';
    $("#pg-per").value = filtro.periodo; $("#pg-func").value = filtro.func; $("#pg-de").value = filtro.de; $("#pg-ate").value = filtro.ate;
    ["#pg-per", "#pg-func", "#pg-de", "#pg-ate"].forEach(function (id) {
      $(id).onchange = function () { filtro.periodo = $("#pg-per").value; filtro.func = $("#pg-func").value; filtro.de = $("#pg-de").value; filtro.ate = $("#pg-ate").value; ver(c, P); };
    });
    $$("[data-forma]", c).forEach(function (b) { b.onclick = function () { filtro.forma = b.dataset.forma; ver(c, P); }; });
    $("#pg-especie").onclick = function () { receber({ arquivos: [], texto: "", especie: true }, P); };
    $("#pg-add").onclick = function () { $("#pg-arq").value = ""; $("#pg-arq").click(); };
    $("#pg-arq").onchange = function () {
      if (!this.files.length) return;
      A.abrirZips(this.files).then(function (fs) { if (fs.length) receber({ arquivos: fs, texto: "" }, P); else A.avisar("O ZIP não tem comprovantes (foto ou PDF).", "erro"); })
        .catch(function (e) { A.avisar(A.msgErro(e), "erro"); });
    };
    $("#pg-colar").onclick = function () {
      var jj = A.janela('<label for="pg-txt">Cole o texto do comprovante</label><textarea id="pg-txt" rows="8"></textarea><div class="acoes"><button class="prim" id="pg-ler">Ler</button></div>', { titulo: "📝 Colar comprovante" });
      $("#pg-ler", jj.el).onclick = function () { var t = $("#pg-txt", jj.el).value; jj.fechar(); if (t.trim()) receber({ arquivos: [], texto: t }, P); };
    };
    var ps = lista(), r = $("#pg-res");
    if (!ps.length) { r.innerHTML = '<div class="cartao vazio">Nenhum pagamento ' + (filtro.forma === "especie" ? "em dinheiro " : filtro.forma === "pix" ? "por Pix " : "") + "neste período.</div>"; return; }
    var tf = totaisPorFunc(ps);
    r.innerHTML = '<div class="cartao"><div class="linha"><h3 style="margin:0">Total do período' + (filtro.forma === "especie" ? " · 💵 dinheiro" : filtro.forma === "pix" ? " · Pix" : "") + '</h3><span class="dir" style="font-size:1.3em;font-weight:700">' + dinheiro(soma(ps)) + "</span></div>" +
      '<div class="peq mudo">' + ps.length + " pagamento" + (ps.length > 1 ? "s" : "") + " · Pix: <b>" + dinheiro(soma(ps.filter(ehPix))) + "</b> · 💵 Dinheiro: <b>" + dinheiro(soma(ps.filter(function (p) { return !ehPix(p); }))) + "</b></div>" +
      '<div class="tabela-caixa" style="margin-top:6px"><table><thead><tr><th>Funcionário</th><th class="num">Pagamentos</th><th class="num">Total</th></tr></thead><tbody>' +
      tf.map(function (x) { return "<tr><td>" + esc(P.nomeFunc(x.func) || "—") + '</td><td class="num">' + ps.filter(function (p) { return (p.funcionario_id || "-") === x.func; }).length + '</td><td class="num"><b>' + dinheiro(x.total) + "</b></td></tr>"; }).join("") +
      "</tbody></table></div>" +
      '<div class="acoes"><button id="pg-csv">⬇ Planilha (CSV)</button><button id="pg-comp">📤 Compartilhar relatório</button></div></div>' +
      porSemana(ps).map(function (s) {
        return '<div class="cab-secao" style="margin-top:14px"><h2>📅 ' + esc(rotuloSemana(s.inicio)) + '</h2><span><b>' + dinheiro(soma(s.pags)) + "</b></span></div>" +
          '<div class="peq mudo" style="margin:-6px 0 6px">' + totaisPorFunc(s.pags).map(function (x) { return esc(P.nomeFunc(x.func) || "—") + ": <b>" + dinheiro(x.total) + "</b>"; }).join(" · ") + "</div>" +
          '<div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Horário</th><th>Funcionário</th><th>Forma</th><th>Tipo</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
          s.pags.map(function (p) {
            var d = new Date(p.pago_em);
            return "<tr><td>" + esc(A.data(d)) + "</td><td>" + esc(A.hora(d)) + "</td><td>" + esc(P.nomeFunc(p.funcionario_id) || p.favorecido || "—") + "</td><td>" + (ehPix(p) ? "Pix" : "💵 Dinheiro") + "</td><td>" + esc(TIPOS[p.tipo] || p.tipo || "") +
              (p.descricao ? '<div class="mudo peq">' + esc(p.descricao) + "</div>" : "") + (window.AGE_FAT && (p.obra_id || p.destino) ? '<div class="peq">📍 ' + esc(window.AGE_FAT.rotuloDe(P, p)) + "</div>" : "") + '</td><td class="num"><b>' + dinheiro(p.valor) + "</b></td><td>" +
              (p.comprovante ? '<button class="peq" data-pg-comp="' + p.id + '">🧾</button> ' : "") + '<button class="peq" data-pg-ed="' + p.id + '">Editar</button></td></tr>';
          }).join("") + "</tbody></table></div>";
      }).join("");
    $("#pg-csv").onclick = function () { baixarCsv(ps); };
    $("#pg-comp").onclick = function () { A.compartilhar({ titulo: "Pagamentos da equipe", texto: textoRelatorio(ps) }); };
    $$("[data-pg-comp]", r).forEach(function (b) {
      b.onclick = function () {
        var p = P.porId(P.S.pag, b.dataset.pgComp);
        P.infoFoto[p.comprovante] = "Comprovante · " + esc(P.nomeFunc(p.funcionario_id) || "") + " · " + dinheiro(p.valor) + " · " + A.dataHora(p.pago_em);
        var jj = A.janela('<div class="fotos">' + P.htmlFoto(p.comprovante, "comprovante") + "</div>", { titulo: "🧾 Comprovante" });
        P.hidratarFotos(jj.el);
      };
    });
    $$("[data-pg-ed]", r).forEach(function (b) { b.onclick = function () { editar(P.porId(P.S.pag, b.dataset.pgEd), c); }; });
  }
  function editar(p, c, depois) {
    var d = new Date(p.pago_em);
    var j = A.janela('<label for="pe-func">Funcionário</label><select id="pe-func">' + P.S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<div class="duas"><div><label for="pe-valor">Valor (R$)</label><input id="pe-valor" inputmode="decimal" value="' + Number(p.valor).toFixed(2).replace(".", ",") + '"></div>' +
      '<div><label for="pe-tipo">Tipo</label><select id="pe-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + TIPOS[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="duas"><div><label for="pe-data">Data</label><input type="date" id="pe-data" value="' + A.isoLocal(d) + '"></div><div><label for="pe-hora">Horário</label><input type="time" id="pe-hora" value="' + dois(d.getHours()) + ":" + dois(d.getMinutes()) + '"></div></div>' +
      '<label for="pe-forma">Forma</label><select id="pe-forma"><option value="pix">Pix</option><option value="especie">💵 Dinheiro (espécie)</option></select>' +
      '<label for="pe-desc">Observação</label><input id="pe-desc" maxlength="300" value="' + esc(p.descricao || "") + '">' +
      (window.AGE_FAT && !P.S.semReceitas ? '<label for="pe-obra">Obra / cliente (entra no resultado da obra)</label><input id="pe-obra" list="pe-dl-obras" maxlength="200" value="' + esc(window.AGE_FAT.rotuloDe(P, p)) + '">' + window.AGE_FAT.datalist(P, "pe-dl-obras") : "") +
      '<div class="acoes"><button class="prim" id="pe-salvar">Salvar</button><button class="perigo" id="pe-apagar">Apagar</button></div>', { titulo: "Pagamento" });
    var el = j.el;
    $("#pe-func", el).value = p.funcionario_id || ""; $("#pe-tipo", el).value = p.tipo || "outro"; $("#pe-forma", el).value = p.forma === "especie" ? "especie" : "pix";
    $("#pe-salvar", el).onclick = function () {
      var v = A.lerNumero($("#pe-valor", el).value);
      if (!(v > 0)) { A.avisar("Valor inválido.", "erro"); return; }
      var up = { funcionario_id: $("#pe-func", el).value || null, valor: v, tipo: $("#pe-tipo", el).value, forma: $("#pe-forma", el).value, descricao: $("#pe-desc", el).value.trim() || null,
        pago_em: new Date($("#pe-data", el).value + "T" + ($("#pe-hora", el).value || "12:00") + ":00").toISOString() };
      if ($("#pe-obra", el) && ($("#pe-obra", el).value.trim() || p.obra_id || p.destino)) Object.assign(up, window.AGE_FAT.resolver(P, $("#pe-obra", el).value));
      P.q(P.sb.from("pagamentos").update(up).eq("id", p.id).select().single())
        .then(function (n) { P.trocar(P.S.pag, n); j.fechar(); if (depois) depois(); else ver(c, P); }).catch(P.falhou);
    };
    $("#pe-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este pagamento?")) return;
      P.q(P.sb.from("pagamentos").delete().eq("id", p.id)).then(function () { P.tirar(P.S.pag, p.id); j.fechar(); if (depois) depois(); else ver(c, P); }).catch(P.falhou);
    };
  }
  function textoRelatorio(ps) {
    var t = "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Pagamentos da equipe*\n";
    var pr = periodo();
    if (filtro.periodo !== "tudo") t += A.data(pr.de) + " a " + A.data(new Date(pr.ate.getTime() - 864e5)) + "\n";
    t += "\n*Total: " + dinheiro(soma(ps)) + "*\n" + totaisPorFunc(ps).map(function (x) { return "• " + (P.nomeFunc(x.func) || "—") + ": " + dinheiro(x.total); }).join("\n") + "\n";
    porSemana(ps).forEach(function (s) {
      t += "\n📅 " + rotuloSemana(s.inicio) + " — " + dinheiro(soma(s.pags)) + "\n";
      s.pags.forEach(function (p) { var d = new Date(p.pago_em); t += A.data(d).slice(0, 5) + " " + A.hora(d) + " · " + (P.nomeFunc(p.funcionario_id) || "—") + " · " + (ehPix(p) ? "Pix" : "Dinheiro") + " · " + (TIPOS[p.tipo] || "") + " · " + dinheiro(p.valor) + "\n"; });
    });
    return t;
  }
  function baixarCsv(ps) {
    var cel = function (x) { x = String(x === null || x === undefined ? "" : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var linhas = [["Semana", "Data", "Horário", "Funcionário", "Forma", "Tipo", "Valor", "Observação", "Nome no comprovante", "ID da transação"]];
    ps.forEach(function (p) {
      var d = new Date(p.pago_em);
      linhas.push([rotuloSemana(A.isoLocal(inicioSemana(d))), A.data(d), A.hora(d), P.nomeFunc(p.funcionario_id) || "", ehPix(p) ? "Pix" : "Dinheiro", TIPOS[p.tipo] || p.tipo || "",
        String(Number(p.valor).toFixed(2)).replace(".", ","), p.descricao || "", p.favorecido || "", p.id_transacao || ""]);
    });
    var csv = "﻿" + linhas.map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    P.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "pagamentos-" + A.isoLocal(new Date()) + ".csv");
  }

  // ---------------- 👷 extrato de um funcionário (aba Equipe) ----------------
  // comprovantes em ordem de data e o fechamento da semana, da quinzena e do mês (adiantamentos e vales entram no total;
  // reembolso de material/combustível fica à parte, porque não é pagamento do serviço)
  var modoExtrato = "mes";
  function faixa(modo, ref) {
    var d = new Date(ref); d.setHours(0, 0, 0, 0);
    if (modo === "semana") { var s = inicioSemana(d); return { de: s, ate: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7) }; }
    if (modo === "quinzena") return d.getDate() <= 15 ? { de: new Date(d.getFullYear(), d.getMonth(), 1), ate: new Date(d.getFullYear(), d.getMonth(), 16) }
      : { de: new Date(d.getFullYear(), d.getMonth(), 16), ate: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    return { de: new Date(d.getFullYear(), d.getMonth(), 1), ate: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }
  function rotuloFaixa(modo, fx) {
    var fim = new Date(fx.ate.getTime() - 864e5);
    if (modo === "mes") { var m = fx.de.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return m.charAt(0).toUpperCase() + m.slice(1); }
    return (modo === "semana" ? "Semana " : (fx.de.getDate() === 1 ? "1ª" : "2ª") + " quinzena · ") + A.data(fx.de).slice(0, 5) + " a " + A.data(fim);
  }
  function resumoPags(ps) {
    var r = { total: 0, adiant: 0, nAdiant: 0, servico: 0, reemb: 0, nReemb: 0 };
    ps.forEach(function (p) {
      var v = Number(p.valor) || 0;
      if (p.tipo === "reembolso") { r.reemb += v; r.nReemb++; return; }
      r.total += v;
      if (p.tipo === "adiantamento" || p.tipo === "vale") { r.adiant += v; r.nAdiant++; } else r.servico += v;
    });
    return r;
  }
  function extrato(f, ctx) {
    P = ctx;
    if (P.S.semPag) { A.avisar("Rode de novo o supabase.sql no Supabase para usar os pagamentos.", "erro"); return; }
    var ref = new Date();
    var j = A.janela(
      '<div class="acoes" style="margin-top:0"><button class="prim" id="ex-pix">📎 Comprovante de pagamento</button><button id="ex-adi">📎 Comprovante de adiantamento</button>' +
      '<button id="ex-din">💵 Pago em dinheiro</button></div>' +
      '<input type="file" id="ex-arq" accept="image/*,application/pdf,.pdf" multiple class="oculto">' +
      '<p class="peq mudo" style="margin:4px 0 8px">Escolha a foto/PDF do comprovante, ou copie o print e aperte <b>Ctrl+V</b> aqui. O app lê o valor e a data e guarda o comprovante junto.</p>' +
      '<div class="filtros" id="ex-modos">' + [["semana", "Semana"], ["quinzena", "Quinzena"], ["mes", "Mês"]].map(function (m) { return '<button class="peq" data-exm="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div>" +
      '<div class="linha" style="justify-content:space-between;margin:6px 0"><button class="peq" id="ex-ant" aria-label="Período anterior">◀</button><b id="ex-rot"></b><button class="peq" id="ex-prox" aria-label="Próximo período">▶</button></div>' +
      '<div id="ex-res"></div>', { titulo: "💰 Pagamentos · " + f.nome, larga: true,
        aoFechar: function () { document.removeEventListener("paste", colar); if (location.hash.slice(1) === "equipe") P.rota(); } });
    var el = j.el, tipoNovo = "diaria";
    function dele() { return P.S.pag.filter(function (p) { return p.funcionario_id === f.id; }); }
    function abrir(rc) { rc.funcionario_id = f.id; rc.depois = desenhar; receber(rc, P); }
    function desenhar() {
      if (!document.body.contains(el)) return;
      $$("[data-exm]", el).forEach(function (b) { b.classList.toggle("prim", b.dataset.exm === modoExtrato); });
      var fx = faixa(modoExtrato, ref), todos = dele();
      var ps = todos.filter(function (p) { var d = new Date(p.pago_em); return d >= fx.de && d < fx.ate; }).sort(function (a, b) { return String(a.pago_em).localeCompare(String(b.pago_em)); });
      var r = resumoPags(ps);
      $("#ex-rot", el).textContent = rotuloFaixa(modoExtrato, fx);
      // meses com pagamento (o mais novo primeiro), para comparar
      var meses = {};
      todos.forEach(function (p) { var k = String(A.isoLocal(new Date(p.pago_em))).slice(0, 7); (meses[k] = meses[k] || []).push(p); });
      var ks = Object.keys(meses).sort().reverse().slice(0, 12);
      $("#ex-res", el).innerHTML =
        '<div class="grade"><div class="ladrilho"><div class="r">Total do fechamento</div><div class="v" style="font-size:1.4em">' + dinheiro(r.total) + '</div><div class="d">' + ps.filter(function (p) { return p.tipo !== "reembolso"; }).length + " pagamento(s)</div></div>" +
        '<div class="ladrilho"><div class="r">Diárias / salário</div><div class="v" style="font-size:1.2em">' + dinheiro(r.servico) + "</div></div>" +
        '<div class="ladrilho"><div class="r">Adiantamentos e vales</div><div class="v" style="font-size:1.2em">' + dinheiro(r.adiant) + '</div><div class="d">' + r.nAdiant + " no período (já somados no total)</div></div>" +
        (r.reemb ? '<div class="ladrilho"><div class="r">Reembolsos (à parte)</div><div class="v" style="font-size:1.2em">' + dinheiro(r.reemb) + '</div><div class="d">material / combustível</div></div>' : "") + "</div>" +
        (ps.length ? '<div class="tabela-caixa" style="margin-top:10px"><table><thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Forma</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
          ps.map(function (p) {
            var d = new Date(p.pago_em);
            return "<tr><td>" + esc(A.data(d)) + "</td><td>" + esc(A.hora(d)) + "</td><td>" + esc(TIPOS[p.tipo] || p.tipo || "") + (p.descricao ? '<div class="mudo peq">' + esc(p.descricao) + "</div>" : "") +
              "</td><td>" + (ehPix(p) ? "Pix" : "💵 Dinheiro") + '</td><td class="num"><b>' + dinheiro(p.valor) + "</b></td><td>" +
              (p.comprovante ? '<button class="peq" data-exc="' + p.id + '">🧾 Ver</button> ' : '<span class="peq mudo">sem comprovante</span> ') + '<button class="peq" data-exe="' + p.id + '">Editar</button></td></tr>';
          }).join("") + '</tbody><tfoot><tr><td colspan="4"><b>Total</b></td><td class="num"><b>' + dinheiro(r.total) + "</b></td><td></td></tr></tfoot></table></div>"
          : '<div class="cartao vazio peq" style="margin-top:10px">Nenhum pagamento neste período.</div>') +
        '<div class="acoes"><button class="peq" id="ex-comp">📤 Enviar o fechamento</button></div>' +
        (ks.length ? '<h3 style="margin:14px 0 6px">📅 Fechamento por mês</h3><div class="tabela-caixa"><table><thead><tr><th>Mês</th><th class="num">Pagamentos</th><th class="num">Adiantamentos</th><th class="num">Total</th></tr></thead><tbody>' +
          ks.map(function (k) {
            var rm = resumoPags(meses[k]), nm = new Date(k + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            return '<tr class="clic" data-exmes="' + k + '" style="cursor:pointer"><td>' + esc(nm.charAt(0).toUpperCase() + nm.slice(1)) + '</td><td class="num">' + meses[k].length + '</td><td class="num">' + dinheiro(rm.adiant) + '</td><td class="num"><b>' + dinheiro(rm.total) + "</b></td></tr>";
          }).join("") + "</tbody></table></div>" : "");
      $$("[data-exc]", el).forEach(function (b) {
        b.onclick = function () {
          var p = P.porId(P.S.pag, b.dataset.exc);
          P.infoFoto[p.comprovante] = "Comprovante · " + esc(f.nome) + " · " + dinheiro(p.valor) + " · " + A.dataHora(p.pago_em);
          var jj = A.janela('<div class="fotos">' + P.htmlFoto(p.comprovante, "comprovante") + "</div>", { titulo: "🧾 Comprovante" });
          P.hidratarFotos(jj.el);
        };
      });
      $$("[data-exe]", el).forEach(function (b) { b.onclick = function () { editar(P.porId(P.S.pag, b.dataset.exe), null, desenhar); }; });
      $$("[data-exmes]", el).forEach(function (t) { t.onclick = function () { modoExtrato = "mes"; ref = new Date(t.dataset.exmes + "-15T12:00:00"); desenhar(); }; });
      $("#ex-comp", el).onclick = function () {
        var t = "*" + ((A.CFG.EMPRESA || {}).nome || "AGE") + " — Pagamentos de " + f.nome + "*\n" + rotuloFaixa(modoExtrato, fx) + "\n\n" +
          ps.map(function (p) { var d = new Date(p.pago_em); return A.data(d).slice(0, 5) + " · " + (TIPOS[p.tipo] || "") + " · " + (ehPix(p) ? "Pix" : "Dinheiro") + " · " + dinheiro(p.valor); }).join("\n") +
          "\n\nDiárias / salário: " + dinheiro(r.servico) + "\nAdiantamentos e vales: " + dinheiro(r.adiant) + "\n*Total: " + dinheiro(r.total) + "*" + (r.reemb ? "\nReembolsos (à parte): " + dinheiro(r.reemb) : "");
        A.compartilhar({ titulo: "Pagamentos de " + f.nome, texto: t });
      };
    }
    $$("[data-exm]", el).forEach(function (b) { b.onclick = function () { modoExtrato = b.dataset.exm; desenhar(); }; });
    $("#ex-ant", el).onclick = function () { var fx = faixa(modoExtrato, ref); ref = new Date(fx.de.getTime() - 864e5); desenhar(); };
    $("#ex-prox", el).onclick = function () { var fx = faixa(modoExtrato, ref); ref = new Date(fx.ate.getTime() + 3600e3); desenhar(); };
    $("#ex-pix", el).onclick = function () { tipoNovo = "diaria"; $("#ex-arq", el).value = ""; $("#ex-arq", el).click(); };
    $("#ex-adi", el).onclick = function () { tipoNovo = "adiantamento"; $("#ex-arq", el).value = ""; $("#ex-arq", el).click(); };
    $("#ex-din", el).onclick = function () { abrir({ especie: true, tipo: "diaria" }); };
    $("#ex-arq", el).onchange = function () { if (this.files.length) abrir({ arquivos: Array.prototype.slice.call(this.files), tipo: tipoNovo }); };
    // Ctrl+V com o print do comprovante (ou o texto dele)
    function colar(ev) {
      if (!document.body.contains(el)) { document.removeEventListener("paste", colar); return; }
      if ($$(".fundo-modal").pop() !== el.closest(".fundo-modal")) return;   // outra janela por cima
      var dt = ev.clipboardData; if (!dt) return;
      var fs = Array.prototype.slice.call(dt.files || []).filter(function (x) { return /^image\/|pdf/.test(x.type); });
      var tx = dt.getData("text") || "";
      if (fs.length) { ev.preventDefault(); abrir({ arquivos: fs, tipo: "diaria" }); }
      else if (/\d,\d{2}/.test(tx) && /pix|comprovante|transfer|valor/i.test(tx)) { ev.preventDefault(); abrir({ texto: tx, tipo: "diaria" }); }
    }
    document.addEventListener("paste", colar);
    desenhar();
  }

  window.AGE_PAG = { ver: ver, receber: receber, lerPix: lerPix, lerArquivo: textoDoArquivo, extrato: extrato };
})();
