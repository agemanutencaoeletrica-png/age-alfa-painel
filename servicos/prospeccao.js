// Painel do dono — 🎯 PROSPECÇÃO: empresas que podem virar clientes (achadas no Google Maps, na lista de CNPJ, por indicação...).
// Cada uma com a situação (a contatar → contatado → orçamento → fechou / não quer), a data para retornar e o histórico.
// O WhatsApp abre com a mensagem pronta, UMA empresa por vez (nada de envio em massa: o número da AGE não corre risco de bloqueio).
// Quem pediu para não receber fica em "Não quer" e o app não oferece mais contato.
// Usa as funções do admin.js (P).
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var filtro = { sit: "abertos", tipo: "", busca: "" };

  var SIT = {
    a_contatar: { nome: "A contatar", cor: "", ic: "🆕" },
    contatado: { nome: "Contatado", cor: "atencao", ic: "💬" },
    orcamento: { nome: "Orçamento enviado", cor: "atencao", ic: "📄" },
    fechou: { nome: "Fechou", cor: "bom", ic: "🤝" },
    nao_quer: { nome: "Não quer", cor: "critico", ic: "🚫" }
  };
  var TIPOS = { galpao: "Galpão / logística", industria: "Indústria", transportadora: "Transportadora", supermercado: "Supermercado / atacado",
    condominio: "Condomínio / administradora", comercio: "Comércio / loja", escola: "Escola / hospital / órgão", outro: "Outro" };
  var ORIGENS = { maps: "Google Maps", cnpj: "Lista de CNPJ", indicacao: "Indicação", visita: "Visita / passou na frente", site: "Site / Instagram", outro: "Outro" };
  var DIAS_RETORNO = 7;
  var CHAVE_MSG = "age_msg_prospeccao";

  function dig(x) { return String(x || "").replace(/\D/g, ""); }
  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function hoje() { return A.isoLocal(new Date()); }
  function maisDias(n) { var d = new Date(); d.setDate(d.getDate() + n); return A.isoLocal(d); }
  function aberto(x) { return x.situacao !== "fechou" && x.situacao !== "nao_quer"; }
  function retornarHoje(S) { return (S.prosp || []).filter(function (x) { return aberto(x) && x.retorno_em && x.retorno_em <= hoje(); }); }
  function linkSite() { try { return new URL("../site/", location.href).href; } catch (e) { return ""; } }

  // mensagem do 1º contato (você pode mudar e ela fica guardada neste aparelho)
  function msgPadrao() {
    var E = A.CFG.EMPRESA || {};
    return "Olá, tudo bem? Aqui é da {empresa}. Fazemos pintura industrial, demarcação de piso (faixas, vagas, zebrados, PARE) e manutenção elétrica para empresas de BH e região — muitas vezes à noite, para não parar a operação.\n\n" +
      "Posso enviar fotos de obras e fazer um orçamento sem compromisso para a {nome}? Nossos trabalhos: {site}\n\n" +
      (E.telefone ? "Contato: " + E.telefone + "\n" : "") + "Se preferir não receber mensagens, é só avisar que não mandamos mais.";
  }
  function msgGuardada() { try { return localStorage.getItem(CHAVE_MSG) || msgPadrao(); } catch (e) { return msgPadrao(); } }
  function montarMsg(x) {
    return msgGuardada().replace(/\{empresa\}/g, (A.CFG.EMPRESA || {}).nome || "AGE").replace(/\{nome\}/g, x.nome || "sua empresa")
      .replace(/\{contato\}/g, x.contato || "").replace(/\{site\}/g, linkSite());
  }

  // ---------------- tela ----------------
  function ver(c, ctx) {
    P = ctx;
    if (P.S.semProsp) {
      c.innerHTML = '<div class="cab-secao"><h2>🎯 Prospecção</h2></div><div class="aviso">Para usar esta parte, rode no Supabase o bloco <b>“Prospecção”</b> do <b>supabase.sql</b> e depois <code>notify pgrst, \'reload schema\';</code>' +
        (P.S.erroProsp ? '<div class="peq mudo" style="margin-top:6px">Erro do banco: ' + esc(P.S.erroProsp) + "</div>" : "") + "</div>";
      return;
    }
    var ls = P.S.prosp, cont = function (f) { return ls.filter(f).length; };
    var contatados = cont(function (x) { return x.situacao !== "a_contatar"; }), fechou = cont(function (x) { return x.situacao === "fechou"; });
    var orc = cont(function (x) { return x.situacao === "orcamento" || x.situacao === "fechou"; }), ret = retornarHoje(P.S).length;
    c.innerHTML = '<div class="cab-secao"><h2>🎯 Prospecção</h2><span><button class="prim" id="pr-novo">➕ Nova empresa</button> <button id="pr-maps">📍 Colar do Maps</button> <button id="pr-colar">📋 Colar lista</button> <button id="pr-msg">✏️ Mensagem</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">Anote as empresas que você achar (Google Maps, lista de CNPJ, indicação). O WhatsApp abre com a mensagem pronta, <b>uma empresa por vez</b> — o app marca como contatado e lembra de retornar em ' + DIAS_RETORNO + " dias.</p>" +
      '<div class="grade">' +
      '<div class="ladrilho" style="border-left:4px solid var(--prim)"><div class="r">🆕 A contatar</div><div class="v">' + cont(function (x) { return x.situacao === "a_contatar"; }) + "</div></div>" +
      '<div class="ladrilho" id="pr-lad-ret" role="button" style="cursor:pointer;border-left:4px solid var(--' + (ret ? "critico" : "borda") + ')"><div class="r">⏰ Retornar hoje</div><div class="v">' + ret + "</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--atencao)"><div class="r">📄 Orçamentos</div><div class="v">' + orc + '</div><div class="d">' + (contatados ? Math.round(orc / contatados * 100) : 0) + "% dos contatados</div></div>" +
      '<div class="ladrilho" style="border-left:4px solid var(--bom)"><div class="r">🤝 Fecharam</div><div class="v">' + fechou + '</div><div class="d">' + (contatados ? Math.round(fechou / contatados * 100) : 0) + "% dos contatados</div></div></div>" +
      '<div class="filtros">' + [["abertos", "Em aberto"], ["retornar", "⏰ Retornar"], ["a_contatar", "🆕 A contatar"], ["contatado", "💬 Contatados"], ["orcamento", "📄 Orçamento"], ["fechou", "🤝 Fecharam"], ["nao_quer", "🚫 Não quer"], ["", "Todos"]].map(function (x) {
        return '<button class="' + (filtro.sit === x[0] ? "prim" : "") + '" data-prsit="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="filtros"><select id="pr-tipo" aria-label="Tipo"><option value="">Todos os tipos</option>' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + TIPOS[k] + "</option>"; }).join("") + "</select>" +
      '<input type="search" id="pr-busca" placeholder="Buscar empresa, cidade, contato, telefone..."></div><div id="pr-res"></div>';
    $("#pr-tipo").value = filtro.tipo; $("#pr-busca").value = filtro.busca;
    $$("[data-prsit]", c).forEach(function (b) { b.onclick = function () { filtro.sit = b.dataset.prsit; ver(c, P); }; });
    $("#pr-lad-ret").onclick = function () { filtro.sit = "retornar"; ver(c, P); };
    $("#pr-tipo").onchange = function () { filtro.tipo = this.value; listar(); };
    $("#pr-busca").oninput = function () { filtro.busca = this.value; listar(); };
    var mudou = function () { if (P.atualizarAbas) P.atualizarAbas(); ver(c, P); };
    $("#pr-novo").onclick = function () { editar(null, mudou); };
    $("#pr-colar").onclick = function () { colar(mudou); };
    $("#pr-maps").onclick = function () { editar(null, mudou, true); };
    $("#pr-msg").onclick = function () { editarMsg(); };
    listar();
    function listar() {
      var b = semAcento(filtro.busca), h = hoje();
      var vs = ls.filter(function (x) {
        if (filtro.sit === "abertos" && !aberto(x)) return false;
        if (filtro.sit === "retornar" && !(aberto(x) && x.retorno_em && x.retorno_em <= h)) return false;
        if (filtro.sit && filtro.sit !== "abertos" && filtro.sit !== "retornar" && x.situacao !== filtro.sit) return false;
        if (filtro.tipo && x.tipo !== filtro.tipo) return false;
        return !b || semAcento([x.nome, x.cidade, x.bairro, x.contato, x.telefone, x.whatsapp, x.obs].join(" ")).indexOf(b) >= 0 || (dig(b).length >= 4 && dig(x.telefone + " " + x.whatsapp).indexOf(dig(b)) >= 0);
      }).sort(function (a, c2) {
        // primeiro quem está na hora de retornar, depois os novos, depois os outros pela data de retorno
        var ra = aberto(a) && a.retorno_em && a.retorno_em <= h ? 0 : a.situacao === "a_contatar" ? 1 : 2, rb = aberto(c2) && c2.retorno_em && c2.retorno_em <= h ? 0 : c2.situacao === "a_contatar" ? 1 : 2;
        return ra - rb || String(a.retorno_em || "9").localeCompare(String(c2.retorno_em || "9")) || String(c2.criado_em).localeCompare(String(a.criado_em));
      });
      var r = $("#pr-res");
      r.innerHTML = vs.length ? vs.map(function (x) {
        var s = SIT[x.situacao] || SIT.a_contatar, atras = aberto(x) && x.retorno_em && x.retorno_em <= h, zap = x.whatsapp || x.telefone, ult = (x.historico || []).slice(-1)[0];
        return '<div class="cartao"' + (atras ? ' style="border-left:4px solid var(--critico)"' : "") + '><div class="linha"><h3 style="margin:0">' + esc(x.nome) + "</h3>" +
          '<span class="selo ' + s.cor + '">' + s.ic + " " + s.nome + "</span>" + (x.tipo ? '<span class="selo">' + esc(TIPOS[x.tipo] || x.tipo) + "</span>" : "") +
          (aberto(x) && x.retorno_em ? '<span class="selo ' + (atras ? "critico" : "") + '">⏰ ' + (atras ? (x.retorno_em < h ? "retornar (atrasado " + A.dataSimples(x.retorno_em) + ")" : "retornar HOJE") : "retornar " + A.dataSimples(x.retorno_em)) + "</span>" : "") + "</div>" +
          '<div class="peq mudo">' + esc([x.contato, [x.bairro, x.cidade].filter(Boolean).join(" - "), ORIGENS[x.origem] ? "via " + ORIGENS[x.origem] : ""].filter(Boolean).join(" · ")) + "</div>" +
          (ult ? '<div class="peq">🕑 ' + esc(A.dataSimples(String(ult.em).slice(0, 10))) + ": " + esc(ult.txt) + "</div>" : "") +
          (x.obs ? '<div class="peq mudo">' + esc(x.obs) + "</div>" : "") +
          '<div class="acoes" style="margin-top:6px">' +
          (x.situacao !== "nao_quer" && dig(zap).length >= 10 ? '<button class="zap peq" data-pr-zap="' + x.id + '">💬 WhatsApp</button>' : "") +
          (x.situacao !== "nao_quer" && dig(x.telefone).length >= 10 ? '<a class="botao peq" href="tel:' + dig(x.telefone) + '" data-pr-tel="' + x.id + '">📞 ' + esc(x.telefone) + "</a>" : "") +
          '<select class="peq" data-pr-sit="' + x.id + '" aria-label="Situação">' + Object.keys(SIT).map(function (k) { return '<option value="' + k + '"' + (k === x.situacao ? " selected" : "") + ">" + SIT[k].ic + " " + SIT[k].nome + "</option>"; }).join("") + "</select>" +
          '<button class="peq" data-pr-nota="' + x.id + '">📝 Anotar</button><button class="peq" data-pr-ed="' + x.id + '">Editar</button></div></div>';
      }).join("") : '<div class="cartao vazio">' + (ls.length ? "Nenhuma empresa neste filtro." : "Nenhuma empresa ainda. Procure no Google Maps (ex.: “galpão logístico Contagem”) e toque em ➕ Nova empresa, ou cole uma lista em 📋 Colar lista.") + "</div>";
      $$("[data-pr-zap]", r).forEach(function (b2) { b2.onclick = function () { contatar(P.porId(ls, b2.dataset.prZap), "zap", mudou); }; });
      $$("[data-pr-tel]", r).forEach(function (a) { a.addEventListener("click", function () { contatar(P.porId(ls, a.dataset.prTel), "tel", mudou); }); });
      $$("[data-pr-sit]", r).forEach(function (s2) { s2.onchange = function () { mudarSit(P.porId(ls, s2.dataset.prSit), s2.value, mudou); }; });
      $$("[data-pr-nota]", r).forEach(function (b2) { b2.onclick = function () { anotar(P.porId(ls, b2.dataset.prNota), mudou); }; });
      $$("[data-pr-ed]", r).forEach(function (b2) { b2.onclick = function () { editar(P.porId(ls, b2.dataset.prEd), mudou); }; });
    }
  }

  // ---------------- ações ----------------
  function gravar(x, up) {
    up.atualizado_em = new Date().toISOString();
    return P.q(P.sb.from("prospects").update(up).eq("id", x.id).select().single()).then(function (n) { P.trocar(P.S.prosp, n); return n; });
  }
  function hist(x, txt) { return (x.historico || []).concat([{ em: new Date().toISOString(), txt: txt }]).slice(-50); }
  // WhatsApp / ligação: registra o contato e já marca o retorno
  function contatar(x, como, mudou) {
    if (como === "zap") A.abrirZap(A.linkZap(x.whatsapp || x.telefone, montarMsg(x)));
    var up = { historico: hist(x, como === "zap" ? "💬 mensagem pelo WhatsApp" : "📞 ligação"), contatado_em: new Date().toISOString(), retorno_em: maisDias(DIAS_RETORNO) };
    if (x.situacao === "a_contatar") up.situacao = "contatado";
    gravar(x, up).then(function () { A.avisar((como === "zap" ? "💬 " : "📞 ") + x.nome + ": contato anotado, retornar em " + DIAS_RETORNO + " dias", "ok"); mudou(); }).catch(P.falhou);
  }
  function mudarSit(x, sit, mudou) {
    var up = { situacao: sit, historico: hist(x, (SIT[sit] || {}).ic + " " + (SIT[sit] || {}).nome) };
    if (sit === "fechou" || sit === "nao_quer") up.retorno_em = null;
    else if (sit === "orcamento") up.retorno_em = maisDias(5);   // cobrar a resposta do orçamento
    gravar(x, up).then(function () { mudou(); }).catch(P.falhou);
  }
  function anotar(x, mudou) {
    var j = A.janela('<label for="pr-an">O que aconteceu?</label><input id="pr-an" maxlength="300" placeholder="Ex.: falei com o Sr. Paulo, pediu orçamento das faixas do pátio">' +
      '<label for="pr-ret">Retornar em</label><input type="date" id="pr-ret" value="' + esc(x.retorno_em || maisDias(DIAS_RETORNO)) + '">' +
      '<div class="acoes"><button class="prim" id="pr-an-ok">Salvar</button></div><div class="tabela-caixa" style="margin-top:8px"><table><tbody>' +
      (x.historico || []).slice().reverse().map(function (h) { return "<tr><td class=\"peq\">" + esc(A.dataHora(h.em)) + "</td><td class=\"peq\">" + esc(h.txt) + "</td></tr>"; }).join("") + "</tbody></table></div>",
      { titulo: "📝 " + x.nome });
    $("#pr-an-ok", j.el).onclick = function () {
      var t = $("#pr-an", j.el).value.trim(), up = { retorno_em: $("#pr-ret", j.el).value || null };
      if (t) up.historico = hist(x, t);
      gravar(x, up).then(function () { j.fechar(); mudou(); }).catch(P.falhou);
    };
  }
  function editarMsg() {
    var j = A.janela('<p class="peq mudo">Use <b>{nome}</b> (empresa), <b>{contato}</b> (pessoa), <b>{empresa}</b> (AGE) e <b>{site}</b> (link do site com as fotos das obras). Mensagem curta, educada e com a opção de não receber mais.</p>' +
      '<textarea id="pr-msg-t" rows="9" style="width:100%">' + esc(msgGuardada()) + "</textarea>" +
      '<div class="acoes"><button class="prim" id="pr-msg-ok">Salvar</button><button id="pr-msg-pad">Voltar ao padrão</button></div>', { titulo: "✏️ Mensagem do 1º contato", larga: true });
    $("#pr-msg-ok", j.el).onclick = function () { try { localStorage.setItem(CHAVE_MSG, $("#pr-msg-t", j.el).value); } catch (e) { /* sem armazenamento: usa a padrão */ } j.fechar(); A.avisar("✏️ Mensagem salva", "ok"); };
    $("#pr-msg-pad", j.el).onclick = function () { $("#pr-msg-t", j.el).value = msgPadrao(); };
  }

  // ---------------- cadastro ----------------
  function repetido(nome, tel, id) {
    var t = dig(tel).slice(-8), n = semAcento(nome).replace(/[^a-z0-9]+/g, " ").trim();
    return P.S.prosp.filter(function (x) { return x.id !== id && ((t.length === 8 && dig(x.telefone + " " + x.whatsapp).indexOf(t) >= 0) || (n && semAcento(x.nome).replace(/[^a-z0-9]+/g, " ").trim() === n)); })[0] || null;
  }
  // texto copiado do painel da empresa no Google Maps (nome, nota, categoria, endereço, site, telefone, plus code...)
  var LIXO_MAPS = /^(claim this business|reivindicar|your maps history|seu hist[oó]rico|add a label|adicionar (um )?marcador|rotas?|directions|salvar|save|perto|nearby|enviar para|send to|compartilhar|share|ligar|call|website|site|aberto|open|fechado|closed|fecha|abre|opens|closes|hor[aá]rio|sugerir|suggest|vis[aã]o geral|overview|avalia|reviews?|sobre|about|fotos?|photos?|identifica|menu|pedidos?|\(?\d+\)?$|\d[,.]\d$|[\d,.]+\s*[★⭐]|[★⭐])/i;
  function lerMaps(t) {
    var ls = String(t || "").split(/\r?\n/).map(function (l) { return l.replace(/^[\s•·]+|[\s•·]+$/g, ""); }).filter(Boolean), r = {}, resto = [];
    ls.forEach(function (l) {
      var mE = l.match(/^(.*?)\s+-\s+(.*?),\s*([^,]+?)\s*-\s*([A-Z]{2})(?:,\s*(\d{5}-?\d{3}))?\s*$/);
      if (!r.endereco && mE) { r.endereco = mE[1]; r.bairro = mE[2]; r.cidade = mE[3]; return; }
      var mC = l.match(/^(.*?),\s*([^,]+?)\s*-\s*([A-Z]{2})(?:,\s*(\d{5}-?\d{3}))?\s*$/);
      if (!r.endereco && mC && /\d/.test(mC[1])) { r.endereco = mC[1]; r.cidade = mC[2]; return; }
      if (!r.telefone && /^\+?(55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s.-]?\d{4}$/.test(l)) { r.telefone = l.replace(/^\+?55\s?/, ""); return; }
      if (!r.site && /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(l) && !/@/.test(l)) { r.site = l.replace(/^https?:\/\//, "").replace(/\/$/, ""); return; }
      if (/^[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3}\b/i.test(l)) return;   // plus code ("2R49+V5 Betim")
      if (LIXO_MAPS.test(l)) return;
      resto.push(l);
    });
    // 1ª linha que sobra = nome; a seguinte (curta) costuma ser a categoria ("Fabricante de autopeças")
    if (resto[0]) r.nome = resto[0].slice(0, 160);
    var cat = semAcento(resto.slice(0, 3).join(" "));
    if (!r.nome && r.site) r.nome = r.site.replace(/^www\./, "").split(".")[0].replace(/^./, function (c) { return c.toUpperCase(); });
    r.tipo = /fabric|industri|metal|usina|siderur|autopec|fabrica|plastic|quimic/.test(cat + " " + (r.bairro ? semAcento(r.bairro) : "")) ? "industria" : /transport|logistic|armaz|galpao|distribui|cd /.test(cat) ? "transportadora" :
      /supermerc|atacad|mercado|hipermerc/.test(cat) ? "supermercado" : /condomin|administradora/.test(cat) ? "condominio" : /escola|hospital|clinica|prefeitura|secretaria/.test(cat) ? "escola" : "";
    if (!r.tipo && /industrial/i.test(r.bairro || "")) r.tipo = "industria";   // "Distrito Industrial"
    return r;
  }
  function editar(x0, mudou, abrirMaps) {
    var x = x0 || {};
    var sel = function (id, op, v) { return '<select id="' + id + '">' + Object.keys(op).map(function (k) { return '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + op[k] + "</option>"; }).join("") + "</select>"; };
    var j = A.janela((x0 ? "" : '<details id="pf-maps" class="cartao" style="margin:0 0 8px;padding:8px 10px"' + (abrirMaps ? " open" : "") + '><summary><b>📍 Colar do Google Maps</b> <span class="peq mudo">copie o painel da empresa no Maps e cole aqui: o app separa endereço, cidade, telefone e site</span></summary>' +
      '<textarea id="pf-maps-t" rows="5" style="width:100%;margin-top:6px" placeholder="Av. Fausto Ribeiro da Silva, 1280 - Distrito Industrial Bandeirinhas, Betim - MG, 32657-000&#10;plascar.com.br&#10;(31) 3211-6300"></textarea><div id="pf-maps-st" class="peq"></div></details>') +
      '<label for="pf-nome">Empresa</label><input id="pf-nome" maxlength="160" value="' + esc(x.nome || "") + '" placeholder="Ex.: Transportadora Exemplo">' +
      '<div class="duas"><div><label for="pf-tipo">Tipo</label>' + sel("pf-tipo", TIPOS, x.tipo || "galpao") + '</div><div><label for="pf-origem">Onde achou</label>' + sel("pf-origem", ORIGENS, x.origem || "maps") + "</div></div>" +
      '<div class="duas"><div><label for="pf-contato">Pessoa de contato</label><input id="pf-contato" maxlength="120" value="' + esc(x.contato || "") + '" placeholder="Ex.: gerente de manutenção"></div>' +
      '<div><label for="pf-tel">Telefone</label><input id="pf-tel" inputmode="tel" maxlength="40" value="' + esc(x.telefone || "") + '"></div></div>' +
      '<div class="duas"><div><label for="pf-zap">WhatsApp (se for outro)</label><input id="pf-zap" inputmode="tel" maxlength="40" value="' + esc(x.whatsapp || "") + '"></div>' +
      '<div><label for="pf-email">E-mail</label><input id="pf-email" type="email" maxlength="160" value="' + esc(x.email || "") + '"></div></div>' +
      '<div class="duas"><div><label for="pf-bairro">Bairro</label><input id="pf-bairro" maxlength="80" value="' + esc(x.bairro || "") + '"></div><div><label for="pf-cidade">Cidade</label><input id="pf-cidade" maxlength="80" value="' + esc(x.cidade || "") + '" placeholder="Ex.: Contagem"></div></div>' +
      '<label for="pf-end">Endereço</label><input id="pf-end" maxlength="200" value="' + esc(x.endereco || "") + '">' +
      '<label for="pf-obs">Observação</label><input id="pf-obs" maxlength="300" value="' + esc(x.obs || "") + '" placeholder="Ex.: pátio grande com faixas apagadas">' +
      '<div id="pf-erro"></div><div class="acoes"><button class="prim" id="pf-salvar">Salvar</button>' + (x0 ? '<button class="perigo" id="pf-apagar">Apagar</button>' : "") + "</div>",
      { titulo: x0 ? "🎯 " + x.nome : "🎯 Nova empresa", larga: true });
    var el = j.el;
    if ($("#pf-maps-t", el)) {
      if (abrirMaps) setTimeout(function () { $("#pf-maps-t", el).focus(); }, 50);
      $("#pf-maps-t", el).oninput = function () {
        var m = lerMaps(this.value), ok = [];
        [["#pf-nome", "nome", "nome"], ["#pf-tel", "telefone", "telefone"], ["#pf-end", "endereco", "endereço"], ["#pf-bairro", "bairro", "bairro"], ["#pf-cidade", "cidade", "cidade"]].forEach(function (c) {
          if (m[c[1]] && !$(c[0], el).value.trim()) { $(c[0], el).value = m[c[1]]; ok.push(c[2]); }
        });
        if (m.site && $("#pf-obs", el).value.indexOf(m.site) < 0) { $("#pf-obs", el).value = ("🌐 " + m.site + " " + $("#pf-obs", el).value).trim(); ok.push("site"); }
        if (m.tipo) $("#pf-tipo", el).value = m.tipo;
        $("#pf-origem", el).value = "maps";
        $("#pf-maps-st", el).innerHTML = ok.length ? "✔ Preenchi: <b>" + ok.join(", ") + "</b>." + (!$("#pf-nome", el).value.trim() ? " Falta o <b>nome da empresa</b> (copie também o título do Maps ou digite)." : " Confira e salve.") : "Não reconheci os dados: confira o texto colado.";
      };
    }
    $("#pf-salvar", el).onclick = function () {
      var b = this, v = function (id) { return $(id, el).value.trim() || null; };
      var dados = { nome: v("#pf-nome"), tipo: $("#pf-tipo", el).value, origem: $("#pf-origem", el).value, contato: v("#pf-contato"), telefone: v("#pf-tel"), whatsapp: v("#pf-zap"),
        email: v("#pf-email"), bairro: v("#pf-bairro"), cidade: v("#pf-cidade"), endereco: v("#pf-end"), obs: v("#pf-obs"), atualizado_em: new Date().toISOString() };
      if (!dados.nome) { $("#pf-erro", el).innerHTML = '<div class="aviso erro">Informe o nome da empresa.</div>'; return; }
      var rp = repetido(dados.nome, dados.telefone || dados.whatsapp, x.id);
      if (rp && b.dataset.confirmou !== "1") { $("#pf-erro", el).innerHTML = '<div class="aviso erro">⚠️ Já está na lista: <b>' + esc(rp.nome) + "</b> (" + esc((SIT[rp.situacao] || {}).nome || "") + ").</div>"; b.dataset.confirmou = "1"; b.textContent = "Salvar mesmo assim"; return; }
      A.ocupado(b, true, "Salvando...");
      if (!x0) { dados.situacao = "a_contatar"; dados.historico = [{ em: new Date().toISOString(), txt: "🆕 cadastrada" + (ORIGENS[dados.origem] ? " (" + ORIGENS[dados.origem] + ")" : "") }]; }
      P.q(x0 ? P.sb.from("prospects").update(dados).eq("id", x.id).select().single() : P.sb.from("prospects").insert(dados).select().single())
        .then(function (n) { P.trocar(P.S.prosp, n); j.fechar(); A.avisar("🎯 " + n.nome + " salva", "ok"); mudou(); })
        .catch(function (e) { A.ocupado(b, false); $("#pf-erro", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
    if ($("#pf-apagar", el)) $("#pf-apagar", el).onclick = function () {
      if (!A.confirmar("Apagar " + x.nome + " da prospecção?")) return;
      P.q(P.sb.from("prospects").delete().eq("id", x.id)).then(function () { P.tirar(P.S.prosp, x.id); j.fechar(); mudou(); }).catch(P.falhou);
    };
  }
  // lista colada (planilha, lista de CNPJ, anotações): uma empresa por linha — "Nome; telefone; cidade" (ou separado por tab/vírgula)
  function lerLista(t) {
    return String(t || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var partes = l.split(/\t|;|\s\|\s/).map(function (p) { return p.trim(); }).filter(Boolean);
      if (partes.length === 1) partes = l.split(/\s*,\s*/);
      var tel = "", resto = [];
      partes.forEach(function (p) { if (!tel && /(\(?\d{2}\)?\s?)?\d{4,5}[\s.-]?\d{4}/.test(p) && dig(p).length >= 10 && dig(p).length <= 13) tel = p; else resto.push(p); });
      if (!tel) { var mt = l.match(/(\(?\d{2}\)?\s?)?9?\d{4}[\s.-]?\d{4}/); if (mt && dig(mt[0]).length >= 10) { tel = mt[0]; resto = [l.replace(mt[0], "").replace(/[;,|\s-]+$/, "").trim()]; } }
      return { nome: (resto[0] || "").replace(/^[\d.\s-]*(?=[A-Za-zÀ-ú])/, "").slice(0, 160), telefone: tel || null, cidade: resto[1] || null };
    }).filter(function (x) { return x.nome && /[A-Za-zÀ-ú]{2,}/.test(x.nome); });
  }
  function colar(mudou) {
    var j = A.janela('<p class="peq mudo">Uma empresa por linha: <b>Nome; telefone; cidade</b> (também aceita colado de planilha). As que já estão na lista ficam de fora.</p>' +
      '<textarea id="pc-txt" rows="8" style="width:100%" placeholder="Transportadora Exemplo; (31) 3333-4444; Contagem&#10;Galpão Logístico XYZ; 31 98888-7777; Betim"></textarea>' +
      '<div class="duas"><div><label for="pc-tipo">Tipo</label><select id="pc-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + TIPOS[k] + "</option>"; }).join("") + "</select></div>" +
      '<div><label for="pc-origem">Onde achou</label><select id="pc-origem">' + Object.keys(ORIGENS).map(function (k) { return '<option value="' + k + '">' + ORIGENS[k] + "</option>"; }).join("") + "</select></div></div>" +
      '<div id="pc-prev" class="peq"></div><div class="acoes"><button class="prim" id="pc-ok" disabled>Adicionar</button></div>', { titulo: "📋 Colar lista de empresas", larga: true });
    var el = j.el, novos = [];
    $("#pc-origem", el).value = "cnpj";
    $("#pc-txt", el).oninput = function () {
      var vistos = {};
      novos = lerLista(this.value).filter(function (x) { var k = semAcento(x.nome) + dig(x.telefone); if (vistos[k] || repetido(x.nome, x.telefone, null)) return false; vistos[k] = 1; return true; });
      $("#pc-prev", el).innerHTML = novos.length ? "<b>" + novos.length + "</b> nova" + (novos.length > 1 ? "s" : "") + ": " + novos.slice(0, 8).map(function (x) { return esc(x.nome) + (x.telefone ? " (" + esc(x.telefone) + ")" : ""); }).join(" · ") + (novos.length > 8 ? " …" : "") : "Nenhuma empresa nova.";
      $("#pc-ok", el).disabled = !novos.length;
    };
    $("#pc-ok", el).onclick = function () {
      var b = this, agora = new Date().toISOString(), tipo = $("#pc-tipo", el).value, origem = $("#pc-origem", el).value;
      A.ocupado(b, true, "Adicionando...");
      P.q(P.sb.from("prospects").insert(novos.map(function (x) {
        return Object.assign(x, { tipo: tipo, origem: origem, situacao: "a_contatar", historico: [{ em: agora, txt: "🆕 cadastrada (" + ORIGENS[origem] + ")" }], atualizado_em: agora });
      })).select()).then(function (ns) { (ns || []).forEach(function (n) { P.S.prosp.unshift(n); }); j.fechar(); A.avisar("🎯 " + (ns || []).length + " empresas adicionadas", "ok"); mudou(); })
        .catch(function (e) { A.ocupado(b, false); $("#pc-prev", el).innerHTML = '<div class="aviso erro">' + esc(A.msgErro(e)) + "</div>"; });
    };
  }

  // aviso na tela Hoje
  function avisoHoje(S) {
    var n = retornarHoje(S).length;
    return n ? '<div class="aviso" style="margin-bottom:12px">🎯 <b>' + n + (n === 1 ? " empresa" : " empresas") + "</b> para retornar hoje na prospecção. Veja em <a href=\"#prospeccao\" data-pr-hoje>🎯 Prospecção</a>.</div>" : "";
  }

  window.AGE_PROSP = { ver: ver, retornarHoje: retornarHoje, avisoHoje: avisoHoje, lerLista: lerLista, lerMaps: lerMaps, montarMsg: montarMsg,
    irRetornar: function () { filtro.sit = "retornar"; } };
})();
