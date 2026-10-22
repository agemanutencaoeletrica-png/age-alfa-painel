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
  // op: { psm: "6" (bloco, padrão do tesseract.js) ou "3"/"4" (página/colunas), cinza: true (sem preto e branco), giro: 0/90/270 já conhecido }
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
        return w.setParameters({ tessedit_pageseg_mode: op.psm || "6" }).then(function () { return realcar(f, giro, op.cinza); })
          .then(function (img) { return w.recognize(img); }).then(function (r) { return { texto: r.data.text || "", giro: giro }; });
      };
      if (op.giro !== undefined) return ler(op.giro);
      return ler(0).then(function (t0) {
        if (qualidade(t0.texto) >= 12) return t0;
        return ler(90).then(function (t1) {
          return ler(270).then(function (t2) {
            return [t0, t1, t2].sort(function (a, b) { return qualidade(b.texto) - qualidade(a.texto); })[0];
          });
        });
      });
    });
  }
  // nota de leitura: valores em reais e palavras de verdade
  function qualidade(t) {
    return (String(t).match(/\d,\d{2}\b/g) || []).length * 2 + (String(t).match(/\b[A-Za-zÀ-ú]{4,}\b/g) || []).length / 4;
  }
  // foto de papel (sombra, inclinação): amplia, passa para preto e branco pela claridade de cada região. Melhora muito a leitura de notas.
  function realcar(f, giro, cinza) {
    if (!window.createImageBitmap) return Promise.resolve(f);
    return createImageBitmap(f).then(function (bmp) {
      var k = Math.min(2, 3200 / Math.max(bmp.width, bmp.height)), w0 = Math.round(bmp.width * k), h0 = Math.round(bmp.height * k);
      var deitar = giro === 90 || giro === 270, W = deitar ? h0 : w0, H = deitar ? w0 : h0;
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      var cx = cv.getContext("2d");
      if (giro) { cx.translate(W / 2, H / 2); cx.rotate(giro * Math.PI / 180); cx.drawImage(bmp, -w0 / 2, -h0 / 2, w0, h0); cx.setTransform(1, 0, 0, 1, 0, 0); }
      else cx.drawImage(bmp, 0, 0, W, H);
      if (bmp.close) bmp.close();
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
          // a primeira página vira imagem para guardar como comprovante
          var vp = pg.getViewport({ scale: 1.6 }), cv = document.createElement("canvas");
          cv.width = vp.width; cv.height = vp.height;
          return pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
            return new Promise(function (ok) { cv.toBlob(function (b) { ok({ texto: linhas.join("\n"), imagem: b }); }, "image/jpeg", 0.85); });
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
        if (it.funcionario_id === undefined) { var ac = it.forma === "especie" ? null : acharFunc(it.favorecido, it.chave, it.cpf); it.funcionario_id = ac ? ac.f.id : ""; it.achadoPor = ac ? ac.por : ""; }
        var f = P.porId(P.S.func, it.funcionario_id);
        var dup = duplicado(it);
        return '<div class="cartao" data-it="' + i + '">' +
          (it.imagem ? '<img alt="Comprovante" src="' + URL.createObjectURL(it.imagem) + '" style="max-height:140px;max-width:100%;display:block;margin-bottom:6px;border-radius:6px">' : "") +
          (it.erro ? '<div class="aviso erro">Não consegui ler “' + esc(it.nome || "") + "”: " + esc(it.erro) + ". Preencha à mão.</div>" : "") +
          (dup ? '<div class="aviso erro">⚠️ Parece já registrado: ' + esc(P.nomeFunc(dup.funcionario_id) || dup.favorecido || "") + " · " + dinheiro(dup.valor) + " · " + esc(A.dataHora(dup.pago_em)) + ". Desmarque se for repetido.</div>" : "") +
          '<label class="marca-linha"><input type="checkbox" data-k="ok"' + (it.ok === false || (it.ok === undefined && dup) ? "" : " checked") + "> Salvar este</label>" +
          (it.forma !== "especie" && (it.favorecido || it.chave) ? '<div class="peq mudo">Para: <b>' + esc(it.favorecido || "") + "</b>" + (it.chave ? " · chave " + esc(it.chave) : "") +
            (f && it.achadoPor ? ' · <span class="selo bom">reconhecido pelo ' + esc(it.achadoPor) + "</span>" : f ? "" : ' · <span class="selo atencao">não achei na equipe: escolha abaixo e cadastre a chave Pix dele</span>') + "</div>" : "") +
          '<div class="duas"><div><label>Funcionário</label><select data-k="funcionario_id"><option value="">— escolha —</option>' +
          P.S.func.map(function (x) { return '<option value="' + x.id + '"' + (x.id === it.funcionario_id ? " selected" : "") + ">" + esc(x.nome) + "</option>"; }).join("") + "</select></div>" +
          '<div><label>Valor (R$)</label><input data-k="valor" inputmode="decimal" value="' + (it.valor ? Number(it.valor).toFixed(2).replace(".", ",") : "") + '"></div></div>' +
          '<div class="duas"><div><label>Data</label><input type="date" data-k="data" value="' + esc(it.data || A.isoLocal(new Date())) + '"></div>' +
          '<div><label>Horário</label><input type="time" data-k="hora" value="' + esc(it.hora || "") + '"></div></div>' +
          '<div class="duas"><div><label>Forma</label><select data-k="forma"><option value="pix"' + (it.forma !== "especie" ? " selected" : "") + '>Pix</option><option value="especie"' + (it.forma === "especie" ? " selected" : "") + ">💵 Dinheiro (espécie)</option></select></div><div></div></div>" +
          '<div class="duas"><div><label>Tipo</label><select data-k="tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + ((it.tipo || "diaria") === k ? " selected" : "") + ">" + TIPOS[k] + "</option>"; }).join("") + "</select></div>" +
          '<div><label>Observação</label><input data-k="descricao" maxlength="300" value="' + esc(it.descricao || "") + '"></div></div></div>';
      }).join("");
      $$("[data-it]", el).forEach(function (card) {
        var it = itens[Number(card.dataset.it)];
        $$("[data-k]", card).forEach(function (inp) {
          inp.onchange = inp.oninput = function () {
            var k = inp.dataset.k;
            if (k === "ok") it.ok = inp.checked;
            else if (k === "valor") it.valor = A.lerNumero(inp.value);
            else it[k] = inp.value;
            resumo();
          };
        });
      });
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
      var falta = sel.filter(function (it) { return !it.funcionario_id || !(it.valor > 0) || !it.data; });
      if (!sel.length) { $("#pg-erro", el).innerHTML = '<div class="aviso erro">Marque pelo menos um pagamento.</div>'; return; }
      if (falta.length) { $("#pg-erro", el).innerHTML = '<div class="aviso erro">Preencha funcionário, valor e data em todos os marcados.</div>'; return; }
      $("#pg-erro", el).innerHTML = ""; A.ocupado(b, true, "Salvando...");
      sel.reduce(function (pr, it) {
        return pr.then(function () {
          var pComp = !it.imagem ? Promise.resolve(null) : A.prepararFoto(it.imagem, [], 1600).then(function (bl) {
            var cam = "admin/pagamentos/" + it.data + "-" + A.uuid() + ".jpg";
            return P.q(P.sb.storage.from("fotos").upload(cam, bl, { contentType: "image/jpeg" })).then(function () { return cam; });
          }).catch(function () { return null; });   // sem o comprovante, o pagamento ainda é salvo
          return pComp.then(function (cam) {
            return P.q(P.sb.from("pagamentos").insert({
              funcionario_id: it.funcionario_id, valor: it.valor, pago_em: new Date(it.data + "T" + (it.hora || "12:00") + ":00").toISOString(),
              tipo: it.tipo || "diaria", forma: it.forma === "especie" ? "especie" : "pix", favorecido: it.favorecido || null, id_transacao: it.id || null, descricao: it.descricao || null, comprovante: cam
            }).select().single()).then(function (n) { P.S.pag.unshift(n); });
          });
        });
      }, Promise.resolve()).then(function () {
        j.fechar();
        A.avisar("💰 " + sel.length + " pagamento" + (sel.length > 1 ? "s registrados" : " registrado"), "ok");
        location.hash = "#pagamentos"; P.rota();
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
      '<input type="file" id="pg-arq" accept="image/*,application/pdf" multiple class="oculto">' +
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
    $("#pg-arq").onchange = function () { if (this.files.length) receber({ arquivos: Array.prototype.slice.call(this.files), texto: "" }, P); };
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
              (p.descricao ? '<div class="mudo peq">' + esc(p.descricao) + "</div>" : "") + '</td><td class="num"><b>' + dinheiro(p.valor) + "</b></td><td>" +
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
  function editar(p, c) {
    var d = new Date(p.pago_em);
    var j = A.janela('<label for="pe-func">Funcionário</label><select id="pe-func">' + P.S.func.map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + "</option>"; }).join("") + "</select>" +
      '<div class="duas"><div><label for="pe-valor">Valor (R$)</label><input id="pe-valor" inputmode="decimal" value="' + Number(p.valor).toFixed(2).replace(".", ",") + '"></div>' +
      '<div><label for="pe-tipo">Tipo</label><select id="pe-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + TIPOS[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="duas"><div><label for="pe-data">Data</label><input type="date" id="pe-data" value="' + A.isoLocal(d) + '"></div><div><label for="pe-hora">Horário</label><input type="time" id="pe-hora" value="' + dois(d.getHours()) + ":" + dois(d.getMinutes()) + '"></div></div>' +
      '<label for="pe-forma">Forma</label><select id="pe-forma"><option value="pix">Pix</option><option value="especie">💵 Dinheiro (espécie)</option></select>' +
      '<label for="pe-desc">Observação</label><input id="pe-desc" maxlength="300" value="' + esc(p.descricao || "") + '">' +
      '<div class="acoes"><button class="prim" id="pe-salvar">Salvar</button><button class="perigo" id="pe-apagar">Apagar</button></div>', { titulo: "Pagamento" });
    var el = j.el;
    $("#pe-func", el).value = p.funcionario_id || ""; $("#pe-tipo", el).value = p.tipo || "outro"; $("#pe-forma", el).value = p.forma === "especie" ? "especie" : "pix";
    $("#pe-salvar", el).onclick = function () {
      var v = A.lerNumero($("#pe-valor", el).value);
      if (!(v > 0)) { A.avisar("Valor inválido.", "erro"); return; }
      P.q(P.sb.from("pagamentos").update({ funcionario_id: $("#pe-func", el).value || null, valor: v, tipo: $("#pe-tipo", el).value, forma: $("#pe-forma", el).value, descricao: $("#pe-desc", el).value.trim() || null,
        pago_em: new Date($("#pe-data", el).value + "T" + ($("#pe-hora", el).value || "12:00") + ":00").toISOString() }).eq("id", p.id).select().single())
        .then(function (n) { P.trocar(P.S.pag, n); j.fechar(); ver(c, P); }).catch(P.falhou);
    };
    $("#pe-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar este pagamento?")) return;
      P.q(P.sb.from("pagamentos").delete().eq("id", p.id)).then(function () { P.tirar(P.S.pag, p.id); j.fechar(); ver(c, P); }).catch(P.falhou);
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

  window.AGE_PAG = { ver: ver, receber: receber, lerPix: lerPix, lerArquivo: textoDoArquivo };
})();
