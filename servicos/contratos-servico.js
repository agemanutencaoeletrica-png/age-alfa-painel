// Painel do dono — 📜 CONTRATOS DE SERVIÇO: modelos prontos de contrato (prestação de serviços com materiais, só mão de obra, elétrica,
// manutenção periódica, CFTV/redes/portão e termo aditivo), preenchidos com os dados do cliente e do orçamento. O texto pode ser editado,
// é salvo sozinho e sai em PDF/impressão com campos de assinatura. Tabela: contratos_servico. Usa as funções do admin.js (P).
// Os modelos são um apoio: para contratos de valor alto ou situações especiais, vale uma revisão com contador ou advogado.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, lista = [], semTab = false, filtro = { busca: "", status: "" };
  var STATUS = { rascunho: "Rascunho", enviado: "Enviado ao cliente", assinado: "Assinado", encerrado: "Encerrado" };
  var MODELOS = {
    servico_obra: { nome: "Prestação de serviços com materiais", desc: "Obra, pintura, sinalização, reforma: a AGE executa e fornece mão de obra e materiais." },
    maodeobra: { nome: "Prestação de serviços só com mão de obra", desc: "O cliente fornece os materiais; a AGE executa." },
    eletrico: { nome: "Serviços de instalações elétricas", desc: "Instalação, adequação e manutenção elétrica (NR-10, ART quando exigida, testes e entrega)." },
    manutencao: { nome: "Manutenção periódica (mensal)", desc: "Condomínios e empresas: visitas e atendimento por valor mensal, com vigência e reajuste." },
    tecnologia: { nome: "CFTV, redes (TI) e portão eletrônico", desc: "Fornecimento, instalação e configuração de equipamentos, com garantia do fabricante e proteção de dados." },
    aditivo: { nome: "Termo aditivo", desc: "Altera valor, prazo ou escopo de um contrato já assinado." }
  };

  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function agora() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function dataLonga(d) { return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }

  // ---------- valor por extenso ----------
  var U = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  var D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  var C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  function ate99(n) { return n < 20 ? U[n] : D[Math.floor(n / 10)] + (n % 10 ? " e " + U[n % 10] : ""); }
  function ate999(n) {
    if (n === 100) return "cem";
    var c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(C[c]);
    if (r) p.push(ate99(r));
    return p.join(" e ");
  }
  function inteiroExt(n) {
    if (n === 0) return "zero";
    var m = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000, p = [], ult;
    if (m) { p.push(ate999(m) + (m === 1 ? " milhão" : " milhões")); ult = m; }
    if (mil) { p.push(mil === 1 ? "mil" : ate999(mil) + " mil"); ult = mil; }
    if (r) { p.push(ate999(r)); ult = r; }
    if (p.length === 1) return p[0];
    var fim = p.pop(), sep = ult < 100 || ult % 100 === 0 ? " e " : ", ";
    return p.join(", ") + sep + fim;
  }
  function extenso(v) {
    v = r2(v); if (!(v > 0)) return "";
    var reais = Math.floor(v + 1e-9), cent = Math.round((v - reais) * 100), t = "";
    if (reais) t = inteiroExt(reais) + (reais % 1e6 === 0 ? " de reais" : reais === 1 ? " real" : " reais");
    if (cent) t += (t ? " e " : "") + ate99(cent) + (cent === 1 ? " centavo" : " centavos");
    return t;
  }

  // ---------- texto do contrato ----------
  function ph(v, t) { v = v === undefined || v === null ? "" : String(v).trim(); return v || "[" + (t || "preencher") + "]"; }
  function gerar(m, d) {
    var cl = [], n = 0;
    function cla(titulo, ps) { n++; cl.push("CLÁUSULA " + n + "ª – " + titulo + "\n" + ps.map(function (p, i) { return n + "." + (i + 1) + " " + p; }).join("\n")); }
    var valor = Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || 0, vtxt = valor > 0 ? din(valor) + " (" + extenso(valor) + ")" : "[valor]";
    var multa = ph(d.multa, "2") , juros = ph(d.juros, "1");
    var objeto = ph(d.objeto, "descrever os serviços"), local = ph(d.local, "local de execução");
    var anexo = d.orcamento_ref ? "a proposta/orçamento " + d.orcamento_ref : "a proposta comercial aprovada pelas partes";
    var titulo = { servico_obra: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", maodeobra: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS (MÃO DE OBRA)", eletrico: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÕES ELÉTRICAS", manutencao: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MANUTENÇÃO PERIÓDICA", tecnologia: "CONTRATO DE FORNECIMENTO E INSTALAÇÃO DE SISTEMAS DE CFTV, REDES E PORTÃO ELETRÔNICO", aditivo: "TERMO ADITIVO" }[m];
    var cab = titulo + (m === "aditivo" ? " Nº " + ph(d.numero, "nº") + " AO CONTRATO " + ph(d.contrato_ref, "nº e data do contrato original") : " Nº " + ph(d.numero, "nº")) + "\n\n" +
      "CONTRATANTE: " + ph(d.cli_nome, "nome do cliente") + ", inscrito(a) no CPF/CNPJ sob o nº " + ph(d.cli_doc, "CPF/CNPJ") + ", com endereço em " + ph(d.cli_end, "endereço") + ", neste ato representado(a) por " + ph(d.cli_rep, "representante legal ou síndico") + ".\n" +
      "CONTRATADA: " + ph(d.emp_nome, "nome da empresa") + ", inscrita no CNPJ sob o nº " + ph(d.emp_doc, "CNPJ") + ", com sede em " + ph(d.emp_end, "endereço") + ", neste ato representada por " + ph(d.emp_rep, "representante") + ".\n\n" +
      (m === "aditivo" ? "As partes acima identificadas, já qualificadas no contrato original, resolvem aditá-lo, mediante as cláusulas a seguir:" : "As partes acima identificadas têm entre si justo e contratado o presente instrumento particular, que se regerá pelas cláusulas e condições a seguir:") + "\n";
    var atraso = "O atraso no pagamento sujeitará a CONTRATANTE a multa de " + multa + "% sobre o valor em atraso, juros de " + juros + "% ao mês e correção monetária pelo IPCA, calculados pro rata die, sem prejuízo da suspensão dos serviços até a regularização.";
    var forma = "O pagamento será feito por PIX, transferência bancária ou boleto, conforme dados informados pela CONTRATADA, que emitirá a nota fiscal correspondente na forma da lei.";

    if (m === "aditivo") {
      cla("DO OBJETO DO ADITIVO", ["O presente termo altera o contrato original nas seguintes condições: " + objeto + ".", "Valor deste aditivo / novo valor do contrato: " + vtxt + ".", "Nova forma de pagamento (se houver): " + ph(d.pagamento, "forma de pagamento") + ".", "Novo prazo (se houver): " + ph(d.prazo, "prazo") + "."]);
      cla("DA RATIFICAÇÃO", ["Permanecem em vigor, sem alteração, todas as demais cláusulas e condições do contrato original que não tenham sido expressamente modificadas por este termo."]);
      cla("DO FORO", ["Fica eleito o foro da comarca de " + ph(d.foro, "cidade/UF") + " para dirimir quaisquer questões decorrentes deste termo."]);
      return cab + "\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este termo em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
    }

    var verbo = { servico_obra: "com o fornecimento de mão de obra e de materiais, os seguintes serviços", maodeobra: "somente com o fornecimento de mão de obra, os seguintes serviços", eletrico: "os seguintes serviços de instalações elétricas, com mão de obra" + " e materiais conforme a proposta", manutencao: "serviços de manutenção periódica, conforme o escopo a seguir", tecnologia: "o fornecimento, a instalação e a configuração dos seguintes sistemas e equipamentos" }[m];
    cla("DO OBJETO", ["A CONTRATADA prestará à CONTRATANTE, " + verbo + ":\n" + objeto, "Local de execução: " + local + ".", "Integram este contrato, como anexo, " + anexo + ", no que não o contrarie."]);
    if (m === "manutencao") {
      cla("DA VIGÊNCIA E DO ATENDIMENTO", ["O contrato vigorará por " + ph(d.vigencia, "prazo de vigência, ex.: 12 meses") + ", a partir de " + ph(dataBr(d.inicio), "data de início") + ", e será renovado automaticamente por períodos iguais, salvo aviso em contrário, por escrito, com 30 (trinta) dias de antecedência.", "As visitas e os atendimentos seguem a periodicidade e o escopo descritos na Cláusula 1ª. Chamados fora do escopo ou fora da periodicidade serão atendidos mediante orçamento prévio aprovado pela CONTRATANTE.", "A CONTRATADA entregará, quando solicitado, relatório simples dos serviços realizados em cada visita."]);
      cla("DO PREÇO E DA FORMA DE PAGAMENTO", ["Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor mensal de " + vtxt + ".", "Forma de pagamento: " + ph(d.pagamento, "forma e dia de pagamento") + ".", forma, atraso, "O valor será reajustado a cada 12 (doze) meses, pela variação do IPCA no período, ou outro índice acordado por escrito.", "Peças, materiais e equipamentos não incluídos no escopo serão cobrados à parte, mediante orçamento aprovado."]);
    } else {
      cla("DO PREÇO E DA FORMA DE PAGAMENTO", ["Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de " + vtxt + ".", "Forma de pagamento: " + ph(d.pagamento, "forma de pagamento") + ".", forma, atraso, m === "maodeobra" ? "O preço refere-se exclusivamente à mão de obra, não incluindo materiais." : "O preço inclui a mão de obra, os materiais, as ferramentas e os equipamentos necessários à execução do objeto, conforme a proposta."]);
      cla("DOS PRAZOS", ["Os serviços terão duração de " + ph(d.prazo, "prazo") + ", com início previsto em " + ph(dataBr(d.inicio), "data de início") + ", após a aprovação deste contrato" + (/entrada/i.test(d.pagamento || "") ? " e o pagamento da entrada" : "") + ".", "Os prazos serão prorrogados, na mesma proporção, em caso de: (a) chuva ou condições climáticas que impeçam a execução; (b) impedimento de acesso ou falta de liberação das áreas; (c) atraso de pagamentos ou de decisões da CONTRATANTE" + (m === "maodeobra" ? "; (d) atraso na entrega dos materiais pela CONTRATANTE" : "; (d) alterações de escopo solicitadas") + "; (e) caso fortuito ou força maior."]);
    }
    var obrC = ["executar os serviços com boa técnica, mão de obra qualificada e em conformidade com as normas técnicas aplicáveis", "utilizar equipamentos de proteção individual e coletiva e observar as normas de segurança do trabalho" + (m === "eletrico" ? " (em especial a NR-10 e, em trabalhos em altura, a NR-35)" : " (em trabalhos em altura, a NR-35)"), "responsabilizar-se pelos seus empregados e prepostos, e pelos encargos trabalhistas, previdenciários e fiscais deles, não havendo vínculo com a CONTRATANTE", "manter o local organizado e limpo ao final de cada etapa", "comunicar à CONTRATANTE, de imediato, qualquer imprevisto que afete o prazo ou o custo", "emitir a nota fiscal dos serviços"];
    if (m === "eletrico") obrC.push("providenciar, quando exigida pela legislação, a Anotação de Responsabilidade Técnica (ART) por profissional habilitado, cujo custo consta da proposta", "realizar os testes de funcionamento e segurança ao final dos serviços e entregar a instalação em condições de uso");
    if (m === "tecnologia") obrC.push("entregar os sistemas configurados e funcionando, com orientação básica de uso e as senhas administrativas à CONTRATANTE");
    cla("DAS OBRIGAÇÕES DA CONTRATADA", ["São obrigações da CONTRATADA: " + obrC.map(function (x, i) { return "(" + String.fromCharCode(97 + i) + ") " + x; }).join("; ") + "."]);
    var obrT = ["permitir o livre acesso da CONTRATADA ao local, nos dias e horários combinados, e liberar as áreas necessárias", "fornecer as informações e as decisões necessárias ao andamento dos serviços", "designar um responsável para acompanhar a execução e receber os serviços", "efetuar os pagamentos nas datas combinadas"];
    if (m === "maodeobra") obrT.push("fornecer os materiais em quantidade, qualidade e prazo adequados, respondendo pelo atraso ou pela falta deles");
    if (m === "eletrico") obrT.push("providenciar os desligamentos programados necessários e informar sobre instalações existentes, projetos e quadros");
    if (m === "tecnologia") obrT.push("manter energia elétrica, pontos de rede e internet em condições de uso, quando necessários ao funcionamento dos sistemas", "cumprir a Lei Geral de Proteção de Dados quanto às imagens e dados captados pelos sistemas, sendo a CONTRATANTE a responsável pelo seu uso");
    cla("DAS OBRIGAÇÕES DA CONTRATANTE", ["São obrigações da CONTRATANTE: " + obrT.map(function (x, i) { return "(" + String.fromCharCode(97 + i) + ") " + x; }).join("; ") + "."]);
    cla("DAS ALTERAÇÕES DE ESCOPO", ["Qualquer alteração, acréscimo ou serviço não previsto neste contrato só será executado após acordo por escrito (aditivo, proposta complementar ou mensagem aprovada pelas partes), com o ajuste de valor e de prazo correspondentes."]);
    if (m !== "manutencao") cla("DA ENTREGA E DO ACEITE", ["Concluídos os serviços, a CONTRATADA comunicará a CONTRATANTE, que terá 5 (cinco) dias para vistoriar e apontar, por escrito, eventuais pendências.", "A CONTRATADA corrigirá as pendências apontadas em prazo razoável. Não havendo manifestação no prazo, os serviços serão considerados aceitos."]);
    var gar = ph(d.garantia, "90 (noventa) dias");
    var garantia = ["A CONTRATADA garante os serviços executados pelo prazo de " + gar + ", contado da entrega, contra defeitos de execução.", "Os materiais e equipamentos têm a garantia do respectivo fabricante, nas condições e nos prazos do termo de garantia ou da ficha técnica, e dependem do uso e da aplicação conforme as recomendações técnicas e o laudo do fabricante, quando houver.", "A garantia não cobre danos decorrentes de mau uso, desgaste natural, intervenção de terceiros, ocorrências externas (como infiltrações, vícios ocultos do local ou condições fora do controle da CONTRATADA) ou falta de manutenção adequada."];
    if (m === "tecnologia") garantia.push("Suporte, ajustes e manutenção após o período de garantia serão cobrados à parte, mediante orçamento.");
    cla("DA GARANTIA", garantia);
    cla("DA SUBCONTRATAÇÃO", ["A CONTRATADA poderá contar com profissionais e empresas parceiras para parte dos serviços, permanecendo responsável perante a CONTRATANTE pela execução e pela qualidade do todo."]);
    cla("DA RESCISÃO", ["Qualquer das partes poderá rescindir este contrato, por escrito, com antecedência de " + (m === "manutencao" ? "30 (trinta)" : "15 (quinze)") + " dias, devendo a CONTRATANTE pagar os serviços já executados e os materiais já adquiridos ou separados para a obra.", "O descumprimento de obrigação, não sanado em 10 (dez) dias após notificação por escrito, autoriza a rescisão imediata pela parte inocente, sem prejuízo da multa de 10% (dez por cento) sobre o valor ainda não pago, a ser paga pela parte que deu causa."]);
    cla("DA PROTEÇÃO DE DADOS E DA CONFIDENCIALIDADE", ["As partes tratarão os dados pessoais e as informações a que tiverem acesso apenas para a execução deste contrato, mantendo sigilo sobre elas, nos termos da Lei nº 13.709/2018 (LGPD)."]);
    cla("DISPOSIÇÕES GERAIS", ["Este contrato representa o acordo integral entre as partes e substitui entendimentos anteriores. A tolerância de uma parte quanto a qualquer descumprimento não importa renúncia ao direito de exigir seu cumprimento.", "As comunicações entre as partes poderão ser feitas por e-mail ou por aplicativo de mensagens, nos contatos informados neste contrato, e serão válidas para todos os fins.", "Nenhuma das partes poderá ceder ou transferir este contrato sem a concordância da outra."]);
    cla("DO FORO", ["Fica eleito o foro da comarca de " + ph(d.foro, "cidade/UF") + " para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja."]);
    return cab + "\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
  }

  // ---------- dados iniciais ----------
  function dadosBase() {
    var E = A.CFG.EMPRESA || {}, ano = new Date().getFullYear();
    return { numero: ano + "/" + String(lista.length + 1).padStart(3, "0"), emp_nome: E.nome || "AGE Elétrica e Pintura", emp_doc: String(E.documento || "").replace(/^CNPJ\s*/i, ""), emp_end: [E.endereco, E.cidade].filter(Boolean).join(", "), emp_rep: "",
      multa: "2", juros: "1", garantia: "90 (noventa) dias", foro: String(E.cidade || "").replace(/,.*$/, "").replace(/\s*-\s*/, "/").trim(), cidade_ass: String(E.cidade || "").replace(/,.*$/, "").trim() };
  }
  function doOrcamento(o) {
    var t = P.calcOrc ? P.calcOrc(o) : { total: 0 }, serv = (o.itens || []).filter(function (i) { return i.tipo !== "material"; });
    return { cli_nome: o.cliente || "", cli_doc: o.documento || "", cli_end: o.endereco || "", local: o.endereco || "", valor: t.total ? A.numero(t.total, 2) : "", pagamento: o.pagamento || "", prazo: o.prazo || "",
      objeto: serv.map(function (i) { return "- " + i.descricao; }).join("\n"), orcamento_ref: "nº " + String(o.numero || "").padStart(4, "0") };
  }

  // ---------- tela ----------
  function carregar(depois) {
    run(P.sb.from("contratos_servico").select("*").order("atualizado_em", { ascending: false }).limit(500)).then(function (r) { lista = r.data || []; semTab = false; })
      .catch(function (e) { lista = []; semTab = semT(e); if (!semTab) A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); }).then(depois);
  }
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>📜 Contratos</h2></div><div class="cartao vazio">Carregando...</div>';
    carregar(function () { desenhar(c); });
  }
  function desenhar(c) {
    var b = filtro.busca.toLowerCase().trim(), L = lista.filter(function (x) { return (!filtro.status || x.status === filtro.status) && (!b || ((x.titulo || "") + " " + (x.cliente || "")).toLowerCase().indexOf(b) >= 0); });
    c.innerHTML = '<div class="cab-secao"><h2>📜 Contratos</h2><span><button class="prim" id="ct-novo"' + (semTab ? " disabled" : "") + '>+ Novo contrato</button></span></div>' +
      (semTab ? '<div class="aviso">Para salvar os contratos, rode no Supabase o <b>contratos.sql</b> (tabela <b>contratos_servico</b>) e atualize o app.</div>' : "") +
      '<p class="mudo peq" style="margin-top:-4px">Escolha um modelo, preencha (ou traga os dados de um orçamento) e o app monta o contrato com as cláusulas principais. O texto é seu: edite à vontade, ele salva sozinho e sai em PDF com campos de assinatura. São modelos de apoio: em contratos de valor alto, vale a revisão de um advogado.</p>' +
      '<div class="filtros"><input type="search" id="ct-busca" data-sem-correcao placeholder="🔍 Buscar contrato ou cliente" value="' + esc(filtro.busca) + '"><select id="ct-st" aria-label="Situação"><option value="">Todas as situações</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === filtro.status ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") + "</select></div>" +
      (L.length ? L.map(function (x) {
        return '<div class="cartao" data-ct="' + esc(x.id) + '"><div class="linha" style="gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>' + esc(x.titulo || "(sem título)") + "</b><br><span class=\"peq mudo\">" + esc(x.cliente || "sem cliente") + (x.valor ? " · " + din(x.valor) : "") + " · atualizado " + esc(dataBr(x.atualizado_em)) + '</span></div><span class="selo">' + esc(STATUS[x.status] || x.status) + "</span></div>" +
          '<div class="acoes"><button class="peq prim" data-ab="' + esc(x.id) + '">Abrir / editar</button><button class="peq" data-im="' + esc(x.id) + '">🖨 Imprimir / PDF</button><button class="peq" data-dp="' + esc(x.id) + '">📋 Duplicar</button><button class="peq perigo" data-ap="' + esc(x.id) + '">Apagar</button></div></div>';
      }).join("") : '<div class="cartao vazio">' + (lista.length ? "Nada com esse filtro." : "Nenhum contrato ainda. Toque em + Novo contrato.") + "</div>");
    function achar(id) { return lista.filter(function (x) { return x.id === id; })[0]; }
    $("#ct-novo", c).onclick = function () { novo(c); };
    $("#ct-busca", c).oninput = function () { filtro.busca = this.value; desenhar(c); var i = $("#ct-busca", c); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    $("#ct-st", c).onchange = function () { filtro.status = this.value; desenhar(c); };
    $$("[data-ab]", c).forEach(function (b2) { b2.onclick = function () { editar(achar(b2.dataset.ab), c); }; });
    $$("[data-im]", c).forEach(function (b2) { b2.onclick = function () { imprimir(achar(b2.dataset.im)); }; });
    $$("[data-dp]", c).forEach(function (b2) {
      b2.onclick = function () {
        var x = achar(b2.dataset.dp), d = Object.assign({}, x.dados || {}, { numero: dadosBase().numero });
        criar({ modelo: x.modelo, titulo: (x.titulo || "") + " (cópia)", cliente: x.cliente, valor: x.valor, dados: d, texto: x.texto, status: "rascunho" }, c, false);
      };
    });
    $$("[data-ap]", c).forEach(function (b2) {
      b2.onclick = function () {
        var x = achar(b2.dataset.ap); if (!x || !A.confirmar("Apagar o contrato “" + (x.titulo || "") + "”?")) return;
        run(P.sb.from("contratos_servico").delete().eq("id", x.id)).then(function () { lista = lista.filter(function (y) { return y.id !== x.id; }); desenhar(c); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
      };
    });
  }
  function criar(reg, c, abrir) {
    run(P.sb.from("contratos_servico").insert(reg).select()).then(function (r) {
      var x = (r.data || [])[0]; if (!x) return; lista.unshift(x); desenhar(c); if (abrir !== false) editar(x, c); else A.avisar("Contrato duplicado", "ok");
    }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
  }
  function novo(c) {
    var orcs = ((P.S.orc) || []).slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
    var j = A.janela('<p class="mudo peq" style="margin-top:0">1) Escolha o modelo. 2) Se quiser, traga os dados de um orçamento (cliente, valor, forma de pagamento, prazo e serviços).</p>' +
      Object.keys(MODELOS).map(function (k, i) { return '<label class="marca-linha" style="font-weight:400;display:block;margin:6px 0"><input type="radio" name="ct-mod" value="' + k + '"' + (i === 0 ? " checked" : "") + '> <b>' + esc(MODELOS[k].nome) + '</b><br><span class="peq mudo">' + esc(MODELOS[k].desc) + "</span></label>"; }).join("") +
      '<label>Trazer dados de um orçamento<select class="ct-orc"><option value="">— sem orçamento: eu preencho —</option>' + orcs.map(function (o) { var t = P.calcOrc ? P.calcOrc(o).total : 0; return '<option value="' + esc(o.id) + '">' + esc(String(o.numero || "").padStart(4, "0") + " · " + (o.cliente || "") + (t ? " · " + din(t) : "")) + "</option>"; }).join("") + "</select></label>" +
      '<div class="acoes"><button class="prim" id="ct-criar">Criar contrato</button><button id="ct-x">Cancelar</button></div>', { titulo: "📜 Novo contrato", semRascunho: true });
    $("#ct-x", j.el).onclick = function () { j.fechar(); };
    $("#ct-criar", j.el).onclick = function () {
      var m = $('input[name="ct-mod"]:checked', j.el).value, oid = $(".ct-orc", j.el).value, o = oid ? P.porId(P.S.orc, oid) : null;
      var d = Object.assign(dadosBase(), o ? doOrcamento(o) : {});
      if (m === "manutencao" && !d.vigencia) d.vigencia = "12 meses";
      d.inicio = d.inicio || "";
      var texto = gerar(m, d), cli = d.cli_nome || "";
      j.fechar();
      criar({ modelo: m, titulo: MODELOS[m].nome + (cli ? " – " + cli : ""), cliente: cli || null, valor: Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || null, dados: d, texto: texto, status: "rascunho", orcamento_id: o ? o.id : null }, c);
    };
  }

  // ---------- editor ----------
  function editar(x, c) {
    var d = Object.assign({}, x.dados || {}), m = x.modelo, tm = null, ultimoGerado = d._gerado || "";
    function campo(k, rot, tipo, extra) { return '<label style="flex:1;min-width:220px">' + rot + (tipo === "area" ? '<textarea class="f-' + k + '" rows="' + (extra || 3) + '" maxlength="3000"></textarea>' : '<input class="f-' + k + '"' + (tipo === "date" ? ' type="date"' : ' maxlength="300"') + (/^(cli_nome|cli_doc|cli_end|cli_rep|emp_nome|emp_doc|emp_end|emp_rep|valor|numero|foro|multa|juros)$/.test(k) ? " data-sem-correcao" : "") + ">") + "</label>"; }
    var html = '<div class="peq" id="ct-st-info" style="margin-bottom:6px;color:var(--mudo)">salva sozinho</div>' +
      '<details open class="cartao"><summary><b>👥 Partes</b></summary><div class="linha" style="gap:8px;align-items:flex-start">' + campo("cli_nome", "Contratante (cliente)") + campo("cli_doc", "CPF / CNPJ do cliente") + '</div><div class="linha" style="gap:8px">' + campo("cli_end", "Endereço do cliente") + campo("cli_rep", "Representante (síndico, sócio...)") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("emp_nome", "Contratada (sua empresa)") + campo("emp_doc", "CNPJ da contratada") + '</div><div class="linha" style="gap:8px">' + campo("emp_end", "Endereço da contratada") + campo("emp_rep", "Representante da contratada") + "</div></details>" +
      '<details open class="cartao"><summary><b>📋 Condições</b></summary>' + campo("objeto", "Objeto: o que será feito (um item por linha)", "area", 5) + '<div class="linha" style="gap:8px">' + campo("local", "Local de execução") + campo("valor", m === "manutencao" ? "Valor mensal (R$)" : "Valor total (R$)") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("pagamento", "Forma de pagamento") + campo("prazo", "Prazo / duração") + '</div><div class="linha" style="gap:8px">' + campo("inicio", "Início previsto", "date") + (m === "manutencao" ? campo("vigencia", "Vigência (ex.: 12 meses)") : "") + (m === "aditivo" ? campo("contrato_ref", "Contrato original (nº e data)") : "") + campo("numero", "Nº do contrato") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("garantia", "Garantia dos serviços") + campo("multa", "Multa por atraso (%)") + campo("juros", "Juros ao mês (%)") + campo("foro", "Foro (cidade/UF)") + "</div></details>" +
      '<div class="acoes"><button class="prim" id="ct-gerar">🔄 Gerar o texto com estes campos</button><select id="ct-status" aria-label="Situação">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k] + "</option>"; }).join("") + "</select></div>" +
      '<label>Texto do contrato (pode editar; salva sozinho)<textarea class="ct-texto" rows="22" data-sem-correcao style="font-family:inherit;line-height:1.45"></textarea></label>' +
      '<div class="acoes"><button class="prim" id="ct-imp">🖨 Imprimir / salvar PDF</button><button id="ct-fechar">Fechar</button></div>';
    var j = A.janela(html, { titulo: "📜 " + (x.titulo || "Contrato"), larga: true, semRascunho: true, aoFechar: function () { salvarJa(); desenhar(c); } });
    $$("[class^=f-]", j.el).forEach(function (e) { var k = e.className.replace(/^f-/, ""); e.value = d[k] === undefined || d[k] === null ? "" : d[k]; });
    $(".ct-texto", j.el).value = x.texto || ""; $("#ct-status", j.el).value = x.status || "rascunho";
    function ler() { $$("[class^=f-]", j.el).forEach(function (e) { d[e.className.replace(/^f-/, "")] = e.value; }); }
    function salvarJa() {
      clearTimeout(tm); ler();
      var reg = { dados: Object.assign({}, d, { _gerado: ultimoGerado }), texto: $(".ct-texto", j.el) ? $(".ct-texto", j.el).value : x.texto, status: $("#ct-status", j.el) ? $("#ct-status", j.el).value : x.status, cliente: d.cli_nome || null,
        valor: Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || null, atualizado_em: new Date().toISOString() };
      Object.assign(x, reg);
      return run(P.sb.from("contratos_servico").update(reg).eq("id", x.id)).then(function () { var s = $("#ct-st-info", j.el); if (s) { s.textContent = "💾 Salvo às " + agora(); s.style.color = ""; } })
        .catch(function (e) { var s = $("#ct-st-info", j.el); if (s) { s.textContent = "Não salvou: " + (A.msgErro ? A.msgErro(e) : e.message); s.style.color = "var(--perigo,#c0392b)"; } });
    }
    function agendar() { var s = $("#ct-st-info", j.el); if (s) s.textContent = "salvando…"; clearTimeout(tm); tm = setTimeout(salvarJa, 1000); }
    j.el.addEventListener("input", agendar); j.el.addEventListener("change", agendar);
    $("#ct-gerar", j.el).onclick = function () {
      ler();
      var atual = $(".ct-texto", j.el).value;
      if (atual.trim() && atual !== ultimoGerado && !A.confirmar("O texto foi editado à mão. Gerar de novo substitui o texto atual pelo modelo com os campos. Continuar?")) return;
      var t = gerar(m, d); $(".ct-texto", j.el).value = t; ultimoGerado = t; salvarJa();
    };
    $("#ct-imp", j.el).onclick = function () { salvarJa().then(function () { imprimir(x); }); };
    $("#ct-fechar", j.el).onclick = function () { j.fechar(); };
  }

  // ---------- impressão ----------
  function imprimir(x) {
    var E = A.CFG.EMPRESA || {}, d = x.dados || {}, w = window.open("", "_blank");
    if (!w) { A.avisar("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.", "erro"); return; }
    var corpo = String(x.texto || "").split("\n").map(function (l) {
      if (/^CLÁUSULA /.test(l)) return '<h3>' + esc(l) + "</h3>";
      if (!l.trim()) return "<br>";
      if (/^(CONTRATO|TERMO ADITIVO)/.test(l)) return '<h1>' + esc(l) + "</h1>";
      return "<p>" + esc(l) + "</p>";
    }).join("");
    var cidade = d.cidade_ass || String(E.cidade || "").replace(/,.*$/, "") || "__________";
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(x.titulo || "Contrato") + "</title><style>" +
      "body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:0 auto;padding:28px;max-width:800px}.cab{display:flex;justify-content:space-between;border-bottom:3px solid #14325c;padding-bottom:8px;margin-bottom:10px}.cab b{font-size:18px;color:#14325c}" +
      "h1{font-size:15px;text-align:center;color:#14325c;margin:14px 0 6px}h3{font-size:13px;margin:14px 0 4px;color:#14325c}p{margin:3px 0;text-align:justify;white-space:pre-wrap}" +
      ".ass{display:flex;gap:40px;margin-top:56px}.ass div{flex:1;border-top:1px solid #333;text-align:center;padding-top:4px;font-size:12px}.test{margin-top:36px}.test div{border-top:1px solid #333;padding-top:4px;font-size:12px}" +
      "@media print{body{padding:0}button{display:none}h3{break-after:avoid}.ass,.test{break-inside:avoid}}button{padding:10px 16px;font-size:15px;margin:0 0 14px;cursor:pointer}</style></head><body>" +
      '<button onclick="window.print()">🖨 Imprimir / salvar PDF</button>' +
      '<div class="cab"><div><b>' + esc(E.nome || "AGE Elétrica e Pintura") + "</b><br>" + [E.documento, E.telefone, E.email].filter(Boolean).map(esc).join(" · ") + '</div><div style="text-align:right">' + esc(E.endereco || "") + "<br>" + esc(E.cidade || "") + "</div></div>" + corpo +
      '<p style="margin-top:22px">' + esc(cidade) + ", " + dataLonga(new Date()) + '.</p>' +
      '<div class="ass"><div>' + esc(d.cli_nome || "CONTRATANTE") + "<br>CONTRATANTE" + (d.cli_rep ? "<br>" + esc(d.cli_rep) : "") + "</div><div>" + esc(d.emp_nome || E.nome || "CONTRATADA") + "<br>CONTRATADA" + (d.emp_rep ? "<br>" + esc(d.emp_rep) : "") + "</div></div>" +
      '<div class="ass test"><div>Testemunha 1<br>Nome:<br>CPF:</div><div>Testemunha 2<br>Nome:<br>CPF:</div></div>' +
      "<script>setTimeout(function(){window.print()},400)<\/script></body></html>";
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.AGE_CONTR = { ver: ver, gerar: gerar, extenso: extenso };
})();
