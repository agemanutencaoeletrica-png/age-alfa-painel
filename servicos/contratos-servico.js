// Painel do dono — 📜 CONTRATOS DE SERVIÇO: modelos prontos de contrato (prestação de serviços com materiais, só mão de obra, elétrica,
// manutenção periódica, CFTV/redes/portão e termo aditivo), preenchidos com os dados do cliente e do orçamento. O texto pode ser editado,
// é salvo sozinho e sai em PDF/impressão com campos de assinatura. Tabela: contratos_servico. Usa as funções do admin.js (P).
// Os modelos são um apoio: para contratos de valor alto ou situações especiais, vale uma revisão com contador ou advogado.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null, lista = [], semTab = false, filtro = { busca: "", status: "" }, EMP = {}, pendente = null, pendenteLJ = null;
  var STATUS = { rascunho: "Rascunho", pre_aprovado: "⏳ Pré-aprovado (falta finalizar)", enviado: "Enviado ao cliente", assinado: "Assinado", encerrado: "Encerrado" };
  // campos importantes: o que ainda faltar aparece no contrato (em amarelo) e na lista
  var IMPORTANTES = { cli_nome: "cliente", cli_doc: "CPF/CNPJ do cliente", cli_end: "endereço do cliente", cli_rep: "representante do cliente", emp_rep: "representante da AGE", valor: "valor", pagamento: "forma de pagamento", prazo: "prazo", inicio: "início", foro: "foro" };
  function faltas(d, m) { d = d || {}; var I = importantes(m); return Object.keys(I).filter(function (k) { return !String(d[k] === undefined || d[k] === null ? "" : d[k]).trim() && !(k === "inicio" && m === "aditivo"); }).map(function (k) { return I[k]; }); }
  // ---- fim do contrato: avisa 10 dias antes (amarelo) e 3 dias antes (vermelho) na tela e no Telegram (compromissos da Agenda) ----
  function diasAte(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; var a = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((a - h) / 86400000); }
  function somarIso(iso, dias) { var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias); return A.isoLocal(d); }
  // "3 (três) meses", "45 dias", "12 meses", "2 anos" + data de início -> data de término
  function calcFim(inicio, txt) {
    var m = String(txt || "").match(/(\d+)\s*(?:\([^)]*\)\s*)?(dias?|mes(?:es)?|anos?)/i), i = String(inicio || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m || !i) return "";
    var n = Number(m[1]), u = m[2].toLowerCase(), y = Number(i[1]), mo = Number(i[2]) - 1, dd = Number(i[3]), d;
    if (/^dia/.test(u)) d = new Date(y, mo, dd + n - 1); else if (/^mes/.test(u)) d = new Date(y, mo + n, dd - 1); else d = new Date(y + n, mo, dd - 1);
    return A.isoLocal(d);
  }
  function alertaFim(x) {
    if (!x || x.status === "encerrado") return null; var n = diasAte((x.dados || {}).fim); if (n === null || n > 10) return null;
    return { n: n, urgente: n <= 3, txt: n < 0 ? "venceu há " + (-n) + " dia(s)" : n === 0 ? "termina HOJE" : "termina em " + n + " dia" + (n > 1 ? "s" : "") };
  }
  function seloFim(x) { var a = alertaFim(x); return a ? ' <span class="peq" style="padding:1px 8px;border-radius:9px;color:#fff;background:' + (a.urgente ? "#c0392b" : "#c58a00") + '">' + (a.urgente ? "⚠ " : "⏰ ") + esc(a.txt) + "</span>" : ""; }
  // cria/atualiza/apaga os dois compromissos da Agenda (10 e 3 dias antes), que avisam no Telegram
  function sincAgenda(d, titulo, status) {
    d._ag = d._ag || {};
    var fim = /^\d{4}-\d{2}-\d{2}$/.test(d.fim || "") ? d.fim : "", ativo = fim && status !== "encerrado", hojeI = A.isoLocal(new Date()), ops = [];
    [10, 3].forEach(function (n) {
      var k = "d" + n, cur = d._ag[k] || null, alvo = ativo ? somarIso(fim, -n) : "", ok = alvo && alvo >= hojeI;
      var tit = ("📜 Contrato termina em " + n + " dias: " + (titulo || "contrato")).slice(0, 200);
      if (!ok) { if (cur) { ops.push(run(P.sb.from("agenda_eventos").delete().eq("id", cur.id)).catch(function () { /* sem agenda */ })); delete d._ag[k]; } return; }
      if (cur && cur.data === alvo && cur.tit === tit) return;
      var v = { titulo: tit, tipo: "prazo", data: alvo, hora_ini: "08:00", avisar_min: 0, lembrete_enviado: null, feito: false, obs: "Fim do contrato em " + dataBr(fim) + ". Combine a renovação ou o encerramento." };
      if (cur) ops.push(run(P.sb.from("agenda_eventos").update(v).eq("id", cur.id)).then(function () { d._ag[k] = { id: cur.id, data: alvo, tit: tit }; }).catch(function () { /* sem agenda */ }));
      else ops.push(run(P.sb.from("agenda_eventos").insert(v).select()).then(function (r) { var e = (r.data || [])[0]; if (e) d._ag[k] = { id: e.id, data: alvo, tit: tit }; }).catch(function () { /* sem agenda */ }));
    });
    return Promise.all(ops);
  }
  // modelos com a EQUIPE (a AGE é a contratante/empregadora e a outra parte é uma pessoa): parceiro autônomo por temporada e contratos CLT
  var PESSOAS = { parceiro: 1, clt_exp: 1, clt_det: 1, clt_ind: 1 };
  var IMPORTANTES_P = { pessoa_nome: "nome", pessoa_doc: "CPF", pessoa_rg: "RG", pessoa_end: "endereço", pessoa_funcao: "função", emp_rep: "representante da AGE", valor: "valor", pagamento: "forma de pagamento", prazo: "prazo", inicio: "início", foro: "foro" };
  function ehPessoa(m) { return !!PESSOAS[m]; }
  // modelos do 🚛 lava-jato: contrato com a empresa contratante (frota) e contrato de sócio (sociedade em conta de participação)
  var LAVAJATO = { lj_frota: 1, lj_socio: 1 };
  var IMPORTANTES_F = { cli_nome: "empresa contratante", cli_doc: "CNPJ da empresa", cli_end: "endereço da empresa", cli_rep: "responsável da empresa", emp_rep: "quem assina pelo lava-jato", objeto: "serviços e preços", frota: "caminhões da frota", pagamento: "forma de pagamento", vigencia: "vigência", inicio: "início", foro: "foro" };
  var IMPORTANTES_S = { cli_nome: "sócio participante", cli_doc: "CPF/CNPJ do sócio", cli_end: "endereço do sócio", emp_rep: "quem assina pelo lava-jato", valor: "valor do aporte", pagamento: "forma do aporte", perc_part: "% do lucro do sócio", prazo: "prazo", inicio: "início", foro: "foro" };
  function ehLJ(m) { return !!LAVAJATO[m]; }
  function importantes(m) { return ehPessoa(m) ? IMPORTANTES_P : m === "lj_frota" ? IMPORTANTES_F : m === "lj_socio" ? IMPORTANTES_S : IMPORTANTES; }
  var MODELOS = {
    servico_obra: { nome: "Prestação de serviços com materiais", desc: "Obra, pintura, sinalização, reforma: a AGE executa e fornece mão de obra e materiais." },
    maodeobra: { nome: "Prestação de serviços só com mão de obra", desc: "O cliente fornece os materiais; a AGE executa." },
    eletrico: { nome: "Serviços de instalações elétricas", desc: "Instalação, adequação e manutenção elétrica (NR-10, ART quando exigida, testes e entrega)." },
    manutencao: { nome: "Manutenção periódica (mensal)", desc: "Condomínios e empresas: visitas e atendimento por valor mensal, com vigência e reajuste." },
    tecnologia: { nome: "CFTV, redes (TI) e portão eletrônico", desc: "Fornecimento, instalação e configuração de equipamentos, com garantia do fabricante e proteção de dados." },
    aditivo: { nome: "Termo aditivo", desc: "Altera valor, prazo ou escopo de um contrato já assinado." },
    parceiro: { nome: "Parceiro autônomo – mão de obra por temporada", desc: "Pintor, eletricista, ajudante... contratados como parceiros (autônomos), por diária, metro ou etapa, durante uma temporada de obra. Sem vínculo de emprego." },
    clt_exp: { nome: "Funcionário CLT – contrato de experiência", desc: "Contratação com carteira assinada, com período de experiência (45 + 45 dias, no máximo 90)." },
    clt_det: { nome: "Funcionário CLT – prazo determinado (obra / serviço transitório)", desc: "Carteira assinada com data de término, para um serviço de natureza transitória (máximo 2 anos)." },
    clt_ind: { nome: "Funcionário CLT – prazo indeterminado", desc: "Carteira assinada sem data de término, para quem vai fazer parte da equipe fixa." },
    lj_frota: { nome: "Lava-jato – lavagem e lubrificação da frota (empresa contratante)", desc: "Contrato com empresa de transporte: relação de caminhões (marca e placa), serviços e preços, fechamento mensal, cuidados com o veículo e responsabilidades." },
    lj_socio: { nome: "Lava-jato – contrato de sócio (sociedade em conta de participação)", desc: "Sócio que aporta dinheiro ou equipamentos e divide o lucro, sem criar outra empresa: aporte, % do lucro, prestação de contas mensal, saída e prazo." }
  };
  var GRUPO_CLIENTE = ["servico_obra", "maodeobra", "eletrico", "manutencao", "tecnologia", "aditivo"], GRUPO_EQUIPE = ["parceiro", "clt_exp", "clt_det", "clt_ind"], GRUPO_LAVAJATO = ["lj_frota", "lj_socio"];

  function semT(e) { return /does not exist|schema cache|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }
  function run(b) { return Promise.resolve(b).then(function (r) { if (r && r.error) throw r.error; return r; }); }
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function din(v) { return A.dinheiro(Number(v) || 0); }
  function agora() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function dataBr(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function dataLonga(d) { return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }

  // logo da AGE (a mesma marca do ícone do app), embutida para sair sempre no PDF
  var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="58" height="58" style="flex:none"><rect width="512" height="512" rx="96" fill="#14325c"/><path d="M286 70 170 280h78l-28 162 126-226h-82z" fill="#f2b632"/><text x="256" y="490" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="64" fill="#ffffff" letter-spacing="6">AGE</text></svg>';
  // dados da AGE: o que está em 🏢 Dados da empresa (se houver) e, no que faltar, a configuração do app
  function dadoEmp(L, re) { var x = (L || []).filter(function (d) { return re.test(String(d.rotulo || "")); })[0]; return x ? String(x.valor || "").trim() : ""; }
  function lerEmpresa(L) {
    var E = A.CFG.EMPRESA || {}, cnpj = dadoEmp(L, /^cnpj$/i) || String(E.documento || "").replace(/^CNPJ\s*/i, ""), razao = dadoEmp(L, /raz[aã]o social/i), fant = dadoEmp(L, /nome fantasia/i) || E.nome || "AGE Elétrica e Pintura";
    var en = dadoEmp(L, /^endere[cç]o$/i), ci = dadoEmp(L, /cidade/i);
    EMP = { nome: razao ? razao + " (" + fant + ")" : fant, cnpj: cnpj, end: en && ci ? en + ", " + ci : [E.endereco, E.cidade].filter(Boolean).join(", "),
      tel: dadoEmp(L, /telefone|whats/i) || E.telefone || "", email: dadoEmp(L, /e-?mail/i) || E.email || "", banco: dadoEmp(L, /^banco/i), rt: dadoEmp(L, /respons[aá]vel t[eé]cnic/i) };
  }

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
    if (ehPessoa(m)) return gerarPessoa(m, d);
    if (ehLJ(m)) return gerarLJ(m, d);
    var cl = [], n = 0;
    function cla(titulo, ps) { n++; cl.push("CLÁUSULA " + n + "ª – " + titulo + "\n" + ps.map(function (p, i) { return n + "." + (i + 1) + " " + p; }).join("\n")); }
    var valor = Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || 0, vtxt = valor > 0 ? din(valor) + " (" + extenso(valor) + ")" : "[valor]";
    var multa = ph(d.multa, "2") , juros = ph(d.juros, "1");
    var objeto = ph(d.objeto, "descrever os serviços"), local = ph(d.local, "local de execução");
    var anexo = d.orcamento_ref ? "a proposta/orçamento " + d.orcamento_ref : "a proposta comercial aprovada pelas partes";
    var titulo = { servico_obra: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", maodeobra: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS (MÃO DE OBRA)", eletrico: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÕES ELÉTRICAS", manutencao: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MANUTENÇÃO PERIÓDICA", tecnologia: "CONTRATO DE FORNECIMENTO E INSTALAÇÃO DE SISTEMAS DE CFTV, REDES E PORTÃO ELETRÔNICO", aditivo: "TERMO ADITIVO" }[m];
    var cab = titulo + (m === "aditivo" ? " Nº " + ph(d.numero, "nº") + " AO CONTRATO " + ph(d.contrato_ref, "nº e data do contrato original") : " Nº " + ph(d.numero, "nº")) + "\n\n" +
      "CONTRATANTE: " + ph(d.cli_nome, "nome do cliente") + ", inscrito(a) no CPF/CNPJ sob o nº " + ph(d.cli_doc, "CPF/CNPJ") + ", com endereço em " + ph(d.cli_end, "endereço") + ", neste ato representado(a) por " + ph(d.cli_rep, "representante legal ou síndico") + (d.cli_tel || d.cli_email ? " (contato: " + [d.cli_tel, d.cli_email].filter(Boolean).join(" · ") + ")" : "") + ".\n" +
      "CONTRATADA: " + ph(d.emp_nome, "nome da empresa") + ", inscrita no CNPJ sob o nº " + ph(d.emp_doc, "CNPJ") + ", com sede em " + ph(d.emp_end, "endereço") + ", neste ato representada por " + ph(d.emp_rep, "representante") + (d.emp_tel || d.emp_email ? " (contato: " + [d.emp_tel, d.emp_email].filter(Boolean).join(" · ") + ")" : "") + ".\n\n" +
      (m === "aditivo" ? "As partes acima identificadas, já qualificadas no contrato original, resolvem aditá-lo, mediante as cláusulas a seguir:" : "As partes acima identificadas têm entre si justo e contratado o presente instrumento particular, que se regerá pelas cláusulas e condições a seguir:") + "\n";
    var atraso = "O atraso no pagamento sujeitará a CONTRATANTE a multa de " + multa + "% sobre o valor em atraso, juros de " + juros + "% ao mês e correção monetária pelo IPCA, calculados pro rata die, sem prejuízo da suspensão dos serviços até a regularização.";
    var forma = "O pagamento será feito por PIX, transferência bancária ou boleto, conforme dados informados pela CONTRATADA" + (d.banco ? " (" + d.banco + ")" : "") + ", que emitirá a nota fiscal correspondente na forma da lei.";
    var cond = d.condicoes && String(d.condicoes).trim() ? "Condições comerciais da proposta: " + String(d.condicoes).trim() : "";

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
    if (d.rt) obrC.push("indicar como responsável técnico da CONTRATADA: " + d.rt);
    if (m === "eletrico") obrC.push("providenciar, quando exigida pela legislação, a Anotação de Responsabilidade Técnica (ART) por profissional habilitado, cujo custo consta da proposta", "realizar os testes de funcionamento e segurança ao final dos serviços e entregar a instalação em condições de uso");
    if (m === "tecnologia") obrC.push("entregar os sistemas configurados e funcionando, com orientação básica de uso e as senhas administrativas à CONTRATANTE");
    if (cond && m !== "aditivo") { var ip = m === "manutencao" ? cl.length - 1 : cl.length - 2, ult = cl[ip], np = ult.split("\n").length; cl[ip] = ult + "\n" + (m === "manutencao" ? 3 : 2) + "." + np + " " + cond; }   // as condições da proposta entram na cláusula do preço
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
    cla("DISPOSIÇÕES GERAIS", ["Este contrato representa o acordo integral entre as partes e substitui entendimentos anteriores. A tolerância de uma parte quanto a qualquer descumprimento não importa renúncia ao direito de exigir seu cumprimento.", "As comunicações entre as partes poderão ser feitas por e-mail ou por aplicativo de mensagens, nos contatos informados neste contrato" + (d.cli_email || d.cli_tel || d.emp_email || d.emp_tel ? " (CONTRATANTE: " + ph([d.cli_email, d.cli_tel].filter(Boolean).join(" / "), "contato") + "; CONTRATADA: " + ph([d.emp_email, d.emp_tel].filter(Boolean).join(" / "), "contato") + ")" : "") + ", e serão válidas para todos os fins.", "Nenhuma das partes poderá ceder ou transferir este contrato sem a concordância da outra."]);
    cla("DO FORO", ["Fica eleito o foro da comarca de " + ph(d.foro, "cidade/UF") + " para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja."]);
    return cab + "\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
  }


  // ---------- contratos do lava-jato ----------
  function gerarLJ(m, d) {
    var cl = [], n = 0, so = m === "lj_socio";
    function cla(titulo, ps) { n++; cl.push("CLÁUSULA " + n + "ª – " + titulo + "\n" + ps.map(function (p, i) { return n + "." + (i + 1) + " " + p; }).join("\n")); }
    var valor = Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || 0, vtxt = valor > 0 ? din(valor) + " (" + extenso(valor) + ")" : "[valor]";
    var multa = ph(d.multa, "2"), juros = ph(d.juros, "1"), foro = ph(d.foro, "cidade/UF");
    var titulo = so ? "CONTRATO DE SOCIEDADE EM CONTA DE PARTICIPAÇÃO (LAVA-JATO DE CAMINHÕES)" : "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE LAVAGEM E LUBRIFICAÇÃO DE VEÍCULOS DE CARGA";
    var contato = function (a, b) { return a || b ? " (contato: " + [a, b].filter(Boolean).join(" · ") + ")" : ""; };
    var cab = titulo + " Nº " + ph(d.numero, "nº") + "\n\n" +
      (so ? "SÓCIO OSTENSIVO: " : "CONTRATADA: ") + ph(d.emp_nome, "nome do lava-jato") + ", inscrita no CNPJ sob o nº " + ph(d.emp_doc, "CNPJ") + ", com sede em " + ph(d.emp_end, "endereço") + ", neste ato representada por " + ph(d.emp_rep, "representante") + contato(d.emp_tel, d.emp_email) + ".\n" +
      (so ? "SÓCIO PARTICIPANTE: " : "CONTRATANTE: ") + ph(d.cli_nome, so ? "nome do sócio" : "empresa contratante") + ", inscrito(a) no CPF/CNPJ sob o nº " + ph(d.cli_doc, "CPF/CNPJ") + ", com endereço em " + ph(d.cli_end, "endereço") + (so ? (d.cli_rep ? ", representado(a) por " + d.cli_rep : "") : ", neste ato representada por " + ph(d.cli_rep, "responsável")) + contato(d.cli_tel, d.cli_email) + ".\n\n" +
      "As partes acima identificadas têm entre si justo e contratado o presente instrumento particular, que se regerá pelas cláusulas e condições a seguir.";
    var inicio = ph(dataBr(d.inicio), "data de início");
    if (!so) {
      var atraso = "O atraso no pagamento sujeitará a CONTRATANTE a multa de " + multa + "% sobre o valor em atraso, juros de " + juros + "% ao mês e correção monetária pelo IPCA, calculados pro rata die, sem prejuízo da suspensão dos atendimentos até a regularização.";
      cla("DO OBJETO", ["A CONTRATADA prestará à CONTRATANTE serviços de lavagem e de lubrificação dos veículos de carga da frota da CONTRATANTE, conforme a tabela de serviços e preços abaixo:\n" + ph(d.objeto, "serviços e preços, um por linha"), "Local de execução: " + ph(d.local, "endereço do lava-jato ou do pátio da CONTRATANTE") + "."]);
      cla("DA FROTA ATENDIDA", ["Integram este contrato os veículos relacionados a seguir (marca e placa):\n" + ph(d.frota, "relação de caminhões: placa – marca/modelo"), "Veículos novos poderão ser incluídos, ou retirados, mediante comunicação da CONTRATANTE por escrito (inclusive por mensagem eletrônica), com os mesmos preços da tabela, salvo acordo diferente.", "Cada atendimento será registrado pela CONTRATADA com a data, a placa do veículo, os serviços realizados e o valor, e poderá ser conferido pelo motorista ou preposto da CONTRATANTE no ato."]);
      cla("DOS PREÇOS E DA FORMA DE PAGAMENTO", ["Os serviços serão cobrados pelos preços da tabela da cláusula 1ª, por atendimento realizado" + (valor > 0 ? ". Estimativa de movimento mensal: " + vtxt + ", sem compromisso de volume mínimo, salvo se expressamente ajustado" : "") + ".", "Ao final de cada mês (ou no fechamento combinado), a CONTRATADA enviará um extrato com os atendimentos (data, placa, serviços e valores) e emitirá a nota fiscal correspondente.", "Forma e prazo de pagamento: " + ph(d.pagamento, "forma e prazo, ex.: PIX ou boleto até o dia 10 do mês seguinte") + ".", "Divergências no extrato deverão ser apontadas por escrito em até 5 (cinco) dias do recebimento, pagando-se desde logo a parte não contestada.", atraso, "Os preços serão reajustados a cada 12 (doze) meses, pela variação do IPCA no período, ou por outro índice que as partes acordarem."]);
      cla("DO ATENDIMENTO", ["Os atendimentos ocorrerão em dias e horários de funcionamento da CONTRATADA, preferencialmente com agendamento prévio, para evitar filas e esperas.", "A CONTRATADA poderá recusar ou adiar o atendimento de veículo em condições que ofereçam risco à equipe ou às instalações (por exemplo, vazamento de combustível, carga perigosa não informada ou carga solta).", "Os veículos serão manobrados pelo motorista da CONTRATANTE ou por pessoa por ela autorizada, salvo ajuste diferente por escrito."]);
      cla("DAS OBRIGAÇÕES DA CONTRATADA", ["São obrigações da CONTRATADA: (a) executar os serviços com boa técnica, produtos adequados e equipe treinada, uniformizada e com os equipamentos de proteção individual; (b) conferir o estado aparente do veículo na chegada e registrar avarias visíveis, quando houver; (c) utilizar lubrificantes e graxas conforme a especificação do fabricante do veículo ou a indicação da CONTRATANTE; (d) destinar de forma correta os efluentes, óleos, graxas e resíduos, nos termos da legislação ambiental e das licenças aplicáveis; (e) responder pelos danos que causar ao veículo por culpa de seus prepostos, após apuração conjunta."]);
      cla("DAS OBRIGAÇÕES DA CONTRATANTE", ["São obrigações da CONTRATANTE: (a) apresentar os veículos para atendimento, informando previamente defeitos, vazamentos, peças soltas e cargas especiais; (b) retirar do veículo objetos de valor, documentos e cargas que não devam ser molhados; (c) informar os pontos de lubrificação e o tipo de óleo ou graxa, quando exigir um específico; (d) conferir o veículo na saída; (e) pagar os serviços nos prazos combinados."]);
      cla("DA RECLAMAÇÃO E DA GARANTIA DO SERVIÇO", ["Qualquer reclamação sobre um serviço deverá ser feita antes da saída do veículo ou em até " + ph(d.garantia, "24 (vinte e quatro) horas") + ", para que a CONTRATADA refaça o serviço sem custo.", "A CONTRATADA não responde por objetos ou cargas deixados no veículo, por defeitos preexistentes, desgaste natural, vícios ocultos ou danos de causa diversa do serviço. A lavagem e a lubrificação não substituem a revisão mecânica do veículo."]);
      cla("DA VIGÊNCIA E DA RESCISÃO", ["O contrato vigorará por " + ph(d.vigencia, "prazo, ex.: 12 meses") + ", a partir de " + inicio + ", e será renovado automaticamente por períodos iguais, salvo aviso em contrário, por escrito, com 30 (trinta) dias de antecedência.", "Qualquer das partes poderá rescindi-lo, por escrito, com antecedência de 30 (trinta) dias, devendo a CONTRATANTE pagar os serviços já prestados.", "O descumprimento de obrigação essencial, não sanado em 10 (dez) dias após notificação, autoriza a rescisão imediata."]);
      if (d.condicoes && String(d.condicoes).trim()) cla("DE OUTRAS CONDIÇÕES", [String(d.condicoes).trim()]);
      cla("DA PROTEÇÃO DE DADOS E DA CONFIDENCIALIDADE", ["As partes tratarão os dados pessoais e as informações a que tiverem acesso (motoristas, placas, rotas e cargas) apenas para a execução deste contrato, mantendo sigilo, nos termos da Lei nº 13.709/2018 (LGPD)."]);
      cla("DO FORO", ["Fica eleito o foro da comarca de " + foro + " para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja."]);
      return cab + "\n\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
    }
    // sócio: sociedade em conta de participação (Código Civil, arts. 991 a 996)
    var pp = Number(String(d.perc_part || "").replace(",", ".")), ppOk = pp > 0 && pp <= 100, ppt = ppOk ? String(pp).replace(".", ",") + "%" : "[% do sócio]", pot = ppOk ? String(Math.round((100 - pp) * 100) / 100).replace(".", ",") + "%" : "[% restante]";
    var lim = Number(String(d.limite || "").replace(/\./g, "").replace(",", ".")) || 0;
    cla("DO OBJETO", ["As partes constituem entre si uma sociedade em conta de participação, nos termos dos arts. 991 a 996 do Código Civil, para a exploração de: " + ph(d.objeto, "atividade, ex.: lava-jato de caminhões, com lavagem, lubrificação e serviços correlatos") + (d.local ? ", em " + d.local : "") + ".", "A atividade constitutiva do objeto social é exercida exclusivamente pelo SÓCIO OSTENSIVO, em seu nome e sob sua única e exclusiva responsabilidade perante terceiros. O SÓCIO PARTICIPANTE não aparece perante terceiros, e esta sociedade não possui personalidade jurídica nem CNPJ próprio."]);
    cla("DO APORTE", ["O SÓCIO PARTICIPANTE contribuirá com " + vtxt + ", na seguinte forma: " + ph(d.pagamento, "forma e datas do aporte, em dinheiro ou bens") + ".", "O aporte será destinado às instalações, equipamentos e capital de giro do negócio. A contribuição dos sócios constitui patrimônio especial, afetado à atividade, e os bens a ela destinados serão relacionados em inventário assinado pelas partes.", "O aporte não rende juros nem correção, salvo se as partes ajustarem por escrito."]);
    cla("DA DIVISÃO DOS RESULTADOS", ["O resultado será apurado mensalmente, e o lucro será a diferença entre as receitas recebidas e os custos e despesas do período (produtos, comissões e salários, água, energia, aluguel, manutenção, tributos e demais despesas necessárias à atividade).", "O lucro apurado será dividido assim: SÓCIO PARTICIPANTE, " + ppt + "; SÓCIO OSTENSIVO, " + pot + ". Eventuais prejuízos serão suportados na mesma proporção, ficando a responsabilidade do SÓCIO PARTICIPANTE limitada ao valor do seu aporte, salvo se participar das relações do SÓCIO OSTENSIVO com terceiros (art. 993, parágrafo único, do Código Civil).", "O pagamento da parte do SÓCIO PARTICIPANTE ocorrerá até o " + ph(d.dia_contas, "dia do mês seguinte, ex.: 10º dia útil") + ", depois da prestação de contas, e poderá ser retido, no todo ou em parte, para recompor prejuízos de meses anteriores, ou capital de giro, se as partes assim acordarem por escrito."]);
    cla("DA ADMINISTRAÇÃO", ["O SÓCIO OSTENSIVO administrará o negócio, contratará equipe, fornecedores e clientes e responderá pelas obrigações trabalhistas, fiscais e ambientais da atividade.", lim > 0 ? "Despesas ou investimentos extraordinários acima de " + din(lim) + " dependem de concordância prévia, por escrito, do SÓCIO PARTICIPANTE." : "Despesas ou investimentos extraordinários, fora da rotina do negócio, dependem de concordância prévia, por escrito, do SÓCIO PARTICIPANTE.", "Todas as receitas e despesas do negócio passarão por conta bancária própria do SÓCIO OSTENSIVO, destinada à atividade, e não serão misturadas com gastos pessoais."]);
    cla("DA PRESTAÇÃO DE CONTAS E DA FISCALIZAÇÃO", ["Até o dia indicado na cláusula 3ª, o SÓCIO OSTENSIVO entregará ao SÓCIO PARTICIPANTE relatório do mês com faturamento, valores recebidos e a receber, comissões, despesas, lucro e a divisão feita, acompanhado dos comprovantes.", "O SÓCIO PARTICIPANTE poderá fiscalizar a gestão, examinar os livros, extratos e documentos do negócio e visitar as instalações, mediante aviso prévio razoável."]);
    cla("DOS TRIBUTOS", ["O SÓCIO OSTENSIVO emitirá as notas fiscais e recolherá os tributos da atividade. Cada sócio responde pelos tributos incidentes sobre a sua parte nos resultados, na forma da legislação, devendo as partes consultar o contador sobre o enquadramento e a tributação da sociedade."]);
    cla("DO PRAZO E DA SAÍDA", ["Este contrato vigorará por " + ph(d.prazo, "prazo, ex.: 24 meses") + ", a partir de " + inicio + ", renovável por acordo escrito.", "Qualquer das partes poderá encerrá-lo antes do prazo, mediante aviso por escrito com 90 (noventa) dias de antecedência, ou imediatamente em caso de descumprimento grave não sanado em 15 (quinze) dias após notificação.", "Encerrada a sociedade, será feito o balanço final e o SÓCIO PARTICIPANTE receberá o seu aporte (ou os bens que o compuseram), acrescido da sua parte nos resultados e deduzidos os prejuízos que lhe cabam, em até 60 (sessenta) dias."]);
    cla("DA CONFIDENCIALIDADE E DA NÃO CONCORRÊNCIA", ["As partes manterão sigilo sobre clientes, preços e informações do negócio. Durante a vigência e por 12 (doze) meses depois dela, nenhuma delas explorará, diretamente, atividade concorrente na mesma cidade com uso de informações obtidas desta sociedade, sem concordância da outra."]);
    if (d.condicoes && String(d.condicoes).trim()) cla("DE OUTRAS CONDIÇÕES", [String(d.condicoes).trim()]);
    cla("DAS DISPOSIÇÕES GERAIS", ["Este contrato representa o acordo integral entre as partes. Alterações só valem por escrito e assinadas por ambas. A tolerância quanto a qualquer descumprimento não importa renúncia ao direito de exigir seu cumprimento."]);
    cla("DO FORO", ["Fica eleito o foro da comarca de " + foro + " para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja."]);
    return cab + "\n\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
  }

  // ---------- contratos com a equipe: parceiro autônomo e CLT ----------
  function gerarPessoa(m, d) {
    var cl = [], n = 0, clt = m !== "parceiro";
    function cla(titulo, ps) { n++; cl.push("CLÁUSULA " + n + "ª – " + titulo + "\n" + ps.map(function (p, i) { return n + "." + (i + 1) + " " + p; }).join("\n")); }
    var valor = Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || 0, un = String(d.unidade_valor || "").trim();
    var vtxt = valor > 0 ? din(valor) + " (" + extenso(valor) + ")" + (un ? " " + un : "") : "[valor]";
    var funcao = ph(d.pessoa_funcao, "função, ex.: pintor, eletricista, ajudante"), local = ph(d.local, "local ou obra"), foro = ph(d.foro, "cidade/UF");
    var titulo = { parceiro: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS (MÃO DE OBRA POR TEMPORADA)", clt_exp: "CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO DETERMINADO (CONTRATO DE EXPERIÊNCIA)", clt_det: "CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO DETERMINADO (SERVIÇO TRANSITÓRIO)", clt_ind: "CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO INDETERMINADO" }[m];
    var contatoE = d.emp_tel || d.emp_email ? " (contato: " + [d.emp_tel, d.emp_email].filter(Boolean).join(" · ") + ")" : "";
    var emp = ph(d.emp_nome, "nome da empresa") + ", inscrita no CNPJ sob o nº " + ph(d.emp_doc, "CNPJ") + ", com sede em " + ph(d.emp_end, "endereço") + ", neste ato representada por " + ph(d.emp_rep, "representante") + contatoE + ".";
    var ctt = [d.pessoa_tel, d.pessoa_email].filter(Boolean).join(" · ");
    var pessoa = ph(d.pessoa_nome, "nome completo") + ", inscrito(a) no CPF sob o nº " + ph(d.pessoa_doc, "CPF") + ", portador(a) do RG nº " + ph(d.pessoa_rg, "RG") +
      (clt ? ", CTPS nº " + ph(d.pessoa_ctps, "CTPS: nº e série, ou CPF se digital") + ", PIS/NIT nº " + ph(d.pessoa_pis, "PIS/NIT") : (d.pessoa_cnpj ? ", MEI/CNPJ nº " + d.pessoa_cnpj : "")) +
      ", residente e domiciliado(a) em " + ph(d.pessoa_end, "endereço") + (ctt ? " (contato: " + ctt + ")" : "") + ".";
    var cab = titulo + " Nº " + ph(d.numero, "nº") + "\n\n" + (clt ? "EMPREGADOR: " : "CONTRATANTE: ") + emp + "\n" + (clt ? "EMPREGADO(A): " : "CONTRATADO(A) (PARCEIRO): ") + pessoa + "\n\n" +
      "As partes acima identificadas têm entre si justo e contratado o presente instrumento, que se regerá pelas cláusulas e condições a seguir:\n";
    var inicio = ph(dataBr(d.inicio), "data de início");
    var atraso = "O atraso no pagamento sujeitará " + (clt ? "o EMPREGADOR" : "a CONTRATANTE") + " à correção monetária pelo IPCA, multa de " + ph(d.multa, "2") + "% e juros de " + ph(d.juros, "1") + "% ao mês sobre o valor em atraso.";
    if (!clt) {
      cla("DO OBJETO", ["O(A) PARCEIRO(A) prestará à CONTRATANTE, de forma autônoma e com mão de obra, serviços de " + funcao + " nos serviços e obras a seguir:\n" + ph(d.objeto, "descrever a obra ou os serviços"), "Local de execução: " + local + ".", "O(A) PARCEIRO(A) executará os serviços com boa técnica, de acordo com as especificações da obra e com as normas de segurança, escolhendo a forma e os meios de execução."]);
      cla("DA NATUREZA DA RELAÇÃO (AUTONOMIA)", ["Este contrato é de prestação de serviços autônomos, de natureza civil. Não gera vínculo empregatício, societário ou de representação entre as partes, nem subordinação jurídica.", "O(A) PARCEIRO(A) não tem exclusividade e pode prestar serviços a terceiros, desde que não prejudique os prazos e a segurança da obra contratada e não use informações da CONTRATANTE.", "Não há controle de jornada nem de ponto. O(A) PARCEIRO(A) organiza o próprio trabalho e responde pelo resultado e pelos prazos de cada etapa. A coordenação do cronograma da obra com os demais serviços não configura subordinação.", "O(A) PARCEIRO(A) poderá fazer-se auxiliar ou substituir por profissional de sua confiança, por sua conta e responsabilidade, mediante aviso prévio à CONTRATANTE.", "O(A) PARCEIRO(A) é responsável pelos seus tributos e contribuições, inclusive previdenciárias (como contribuinte individual ou microempreendedor individual), e pelos encargos de quem o auxiliar. Não faz jus a férias, 13º salário, FGTS, aviso prévio ou outras verbas de natureza trabalhista.", "Quando a lei impuser à CONTRATANTE a retenção de tributos ou contribuições sobre o pagamento, ela será feita e recolhida, e será pago o valor líquido."]);
      cla("DA TEMPORADA (PRAZO)", ["A temporada tem início em " + inicio + " e duração de " + ph(d.prazo, "prazo, ex.: 3 meses ou até o fim da obra") + ".", "O prazo poderá ser prorrogado por escrito. A temporada se encerra antes do prazo se a obra terminar ou for suspensa, ou nos casos da cláusula de rescisão.", "Dias sem trabalho por chuva, falta de acesso, falta de material ou outro impedimento não causado pelo(a) PARCEIRO(A) não são considerados falta dele(a)" + (/di[aá]ria/i.test(un) ? ", mas só são pagos os dias efetivamente trabalhados, salvo ajuste diferente por escrito" : "") + "."]);
      cla("DA REMUNERAÇÃO", ["Pelos serviços, a CONTRATANTE pagará ao(à) PARCEIRO(A) o valor de " + vtxt + ".", "Forma e prazo de pagamento: " + ph(d.pagamento, "ex.: quinzenal, até o 5º dia útil após o fechamento do período") + ".", "O pagamento será feito por Pix" + (d.pessoa_pix ? " para a chave " + d.pessoa_pix : "") + " ou transferência bancária, contra recibo" + (d.pessoa_cnpj ? " ou nota fiscal do MEI" : "") + ", com base no fechamento do período ou da etapa, que será conferido pelas duas partes.", atraso]);
      cla("DAS OBRIGAÇÕES DO(A) PARCEIRO(A)", ["Executar os serviços com qualidade e dentro dos prazos combinados, comunicando de imediato qualquer imprevisto.", "Usar os equipamentos de proteção individual (EPIs) exigidos para a atividade, como capacete, luvas, óculos e calçado de segurança, e, em trabalho em altura, cinto com talabarte e treinamento da NR-35; em serviços elétricos, treinamento da NR-10, apresentando os certificados quando solicitado.", "Zelar pelos materiais, ferramentas e equipamentos recebidos e devolvê-los ao final.", "Refazer, por sua conta, defeitos de execução apontados no prazo de " + ph(d.garantia_p, "30 (trinta) dias") + " após a entrega de cada etapa.", "Manter sigilo sobre as informações e os clientes da CONTRATANTE e não aliciar clientes dela durante a vigência deste contrato.", "Tratar com respeito moradores, clientes e demais profissionais e não trabalhar sob efeito de álcool ou drogas.", "Apresentar os documentos pessoais e os certificados necessários ao serviço."]);
      cla("DAS OBRIGAÇÕES DA CONTRATANTE", ["Pagar a remuneração nos prazos combinados.", "Fornecer " + ph(d.ferramentas, "ex.: os materiais da obra e os EPIs necessários; as ferramentas manuais pessoais são do parceiro") + ".", "Dar acesso ao local, informar as especificações do serviço e os riscos da obra e indicar um responsável para acompanhar a execução."]);
      cla("DA SEGURANÇA E DE ACIDENTES", ["O(A) PARCEIRO(A) declara estar apto(a) à atividade e se compromete a seguir as orientações de segurança da obra.", "Seguro de acidentes pessoais em favor do(a) PARCEIRO(A): ( ) sim, contratado por ______________________   ( ) não.", "Em caso de acidente, a CONTRATANTE prestará o socorro imediato e as partes registrarão a ocorrência por escrito."]);
      cla("DA RESPONSABILIDADE POR DANOS", ["O(A) PARCEIRO(A) responde pelos danos que causar à CONTRATANTE, a clientes ou a terceiros por dolo ou culpa na execução dos serviços."]);
      cla("DA RESCISÃO", ["Qualquer das partes poderá encerrar este contrato, por escrito, com aviso de " + ph(d.aviso_dias, "3") + " dia(s), pagando-se os serviços já executados.", "O descumprimento grave, como abandono do serviço, desrespeito às normas de segurança, dano doloso ou conduta incompatível com a obra, autoriza o encerramento imediato, sem prejuízo do pagamento do que já foi executado e aceito."]);
    } else {
      var motivo = ph(d.motivo, "serviço de natureza transitória: descrever, ex.: obra X, temporada de pintura");
      cla("DA FUNÇÃO E DO LOCAL DE TRABALHO", ["O(A) EMPREGADO(A) é contratado(a) para exercer a função de " + funcao + (d.objeto && String(d.objeto).trim() ? ", com as seguintes atividades:\n" + String(d.objeto).trim() : "") + ", além de outras atividades compatíveis com a sua condição pessoal.", "O trabalho será prestado " + (d.local && String(d.local).trim() ? "em " + d.local : "nas obras e nos serviços indicados pelo EMPREGADOR, em diferentes endereços de clientes, o que é próprio da atividade") + ".", "Poderá haver prestação de serviços em outros locais da cidade e da região, conforme a necessidade das obras."]);
      var prazoTxt = m === "clt_exp" ? ["Este contrato é celebrado a título de EXPERIÊNCIA (art. 443, §2º, alínea “c”, da CLT), com início em " + inicio + " e prazo de " + ph(d.prazo, "45 dias, prorrogável por mais 45") + ". O prazo total não pode ultrapassar 90 (noventa) dias, e o contrato só pode ser prorrogado uma vez, dentro desse limite.", "Terminado o prazo e continuando o empregado a prestar serviços sem rescisão, o contrato passa a vigorar por prazo indeterminado."]
        : m === "clt_det" ? ["Este contrato é celebrado por PRAZO DETERMINADO (art. 443, §§ 1º e 2º, da CLT), em razão do caráter transitório do serviço: " + motivo + ".", "Início em " + inicio + " e prazo de " + ph(d.prazo, "duração ou data de término") + ", que não poderá exceder 2 (dois) anos (art. 445 da CLT).", "Terminado o prazo, o contrato se extingue sem aviso prévio, pagas as verbas rescisórias devidas. A prorrogação, quando admitida, será por escrito e uma única vez."]
        : ["Este contrato é celebrado por PRAZO INDETERMINADO, com início em " + inicio + ".", "Os primeiros 90 (noventa) dias só serão considerados período de experiência se houver contrato próprio de experiência assinado."];
      cla("DO PRAZO", prazoTxt);
      cla("DA JORNADA DE TRABALHO", ["A jornada será de " + ph(d.jornada, "dias e horários, ex.: segunda a sexta, 7h às 16h48, com 1h de intervalo (44 horas semanais)") + ".", "As horas trabalhadas além da jornada serão pagas com o adicional legal ou compensadas conforme a lei e o acordo entre as partes. O controle da jornada será feito pelos meios adotados pelo EMPREGADOR."]);
      cla("DA REMUNERAÇÃO", ["O(A) EMPREGADO(A) receberá o salário de " + vtxt + ", pago " + ph(d.pagamento, "ex.: mensalmente, até o 5º dia útil do mês seguinte") + ".", "Adicionais e benefícios: " + ph(d.adicionais, "ex.: nenhum; adicional de periculosidade, se devido") + "; " + ph(d.beneficios, "ex.: vale-transporte e alimentação") + ".", "Serão descontados os valores previstos em lei (INSS e imposto de renda, quando devidos), o vale-transporte (até 6% do salário-base) e os adiantamentos recebidos.", "Em caso de dano causado pelo(a) EMPREGADO(A), o desconto será feito na forma do art. 462, §1º, da CLT: havendo culpa, mediante esta autorização, e havendo dolo, independentemente dela."]);
      cla("DAS OBRIGAÇÕES DO(A) EMPREGADO(A)", ["Cumprir as normas da empresa e as ordens de serviço, inclusive as de segurança e saúde do trabalho.", "Usar os EPIs fornecidos, pois a recusa injustificada constitui falta (art. 158 da CLT), e participar dos treinamentos exigidos.", "Zelar pelas ferramentas e equipamentos, e comunicar defeitos e acidentes de imediato.", "Ser pontual, comunicar faltas e apresentar atestados no prazo.", "Manter sigilo sobre as informações e os clientes do EMPREGADOR."]);
      cla("DAS OBRIGAÇÕES DO EMPREGADOR", ["Registrar o(a) EMPREGADO(A), anotar a CTPS (digital) e prestar as informações no eSocial antes do início das atividades.", "Recolher o FGTS e as contribuições previdenciárias, e conceder férias com adicional de um terço, 13º salário e descanso semanal remunerado, na forma da lei.", "Fornecer gratuitamente os EPIs e os treinamentos necessários, como NR-35 e NR-10, quando for o caso, e manter ambiente de trabalho seguro.", "Realizar os exames médicos admissional, periódico e demissional."]);
      cla("DA RESCISÃO", [m === "clt_ind" ? "A rescisão por qualquer das partes seguirá a lei, com aviso prévio e pagamento das verbas rescisórias devidas." : "Terminado o prazo, o contrato se extingue sem aviso prévio, pagas as verbas devidas.", m === "clt_ind" ? "O descumprimento grave das obrigações poderá levar à rescisão por justa causa, nos casos do art. 482 da CLT." : "Se qualquer das partes rescindir o contrato antes do prazo, sem justa causa, aplicam-se os arts. 479 e 480 da CLT (indenização, devida pelo empregador, de metade da remuneração a que teria direito até o término, e indenização por prejuízos, devida pelo empregado). Havendo justa causa, aplica-se o art. 482 da CLT."]);
    }
    cla("DA PROTEÇÃO DE DADOS", ["As partes tratarão os dados pessoais apenas para a execução deste contrato e o cumprimento de obrigações legais, nos termos da Lei nº 13.709/2018 (LGPD)."]);
    cla("DISPOSIÇÕES GERAIS", ["Este contrato representa o acordo integral entre as partes. A tolerância de uma delas quanto a um descumprimento não importa renúncia ao direito de exigir o cumprimento.", "As comunicações poderão ser feitas por e-mail ou por aplicativo de mensagens, nos contatos informados neste contrato.", "As partes declaram ter lido o contrato, entendido todas as cláusulas e concordado livremente com elas."]);
    cla("DO FORO", [clt ? "Fica eleito o foro da Justiça do Trabalho da comarca de " + foro + " para dirimir quaisquer questões decorrentes deste contrato." : "Fica eleito o foro da comarca de " + foro + " para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro."]);
    return cab + "\n" + cl.join("\n\n") + "\n\nE, por estarem de pleno acordo, as partes assinam este contrato em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.";
  }

  // ---------- dados iniciais ----------
  function dadosBase() {
    var E = A.CFG.EMPRESA || {}, ano = new Date().getFullYear();
    return { numero: ano + "/" + String(lista.length + 1).padStart(3, "0"), emp_nome: EMP.nome || E.nome || "AGE Elétrica e Pintura", emp_doc: EMP.cnpj || String(E.documento || "").replace(/^CNPJ\s*/i, ""), emp_end: EMP.end || [E.endereco, E.cidade].filter(Boolean).join(", "), emp_rep: "",
      emp_tel: EMP.tel || E.telefone || "", emp_email: EMP.email || E.email || "", banco: EMP.banco || "", rt: EMP.rt || "",
      multa: "2", juros: "1", garantia: "90 (noventa) dias", garantia_p: "30 (trinta) dias", aviso_dias: "3",
      ferramentas: "os materiais da obra e os EPIs necessários; as ferramentas manuais pessoais são do(a) parceiro(a)",
      jornada: "segunda a sexta-feira, das 7h00 às 16h48, com 1 hora de intervalo para refeição e descanso (44 horas semanais)",
      beneficios: "vale-transporte e vale-alimentação, quando devidos", foro: String(E.cidade || "").replace(/,.*$/, "").replace(/\s*-\s*/, "/").trim(), cidade_ass: String(E.cidade || "").replace(/,.*$/, "").trim() };
  }
  function doOrcamento(o) {
    var t = P.calcOrc ? P.calcOrc(o) : { total: 0 }, serv = (o.itens || []).filter(function (i) { return i.tipo !== "material"; });
    return { cli_nome: o.cliente || "", cli_doc: o.documento || "", cli_end: o.endereco || "", local: o.endereco || "", valor: t.total ? A.numero(t.total, 2) : "", pagamento: o.pagamento || "", prazo: o.prazo || "",
      objeto: serv.map(function (i) { return "- " + i.descricao; }).join("\n"), orcamento_ref: "nº " + String(o.numero || "").padStart(4, "0") };
  }

  function daPropostaDados(o) {
    var itens = (o.itens || []).filter(function (i) { return i && i.descricao; }), total = Number(o.total) || itens.reduce(function (s, i) { return s + (Number(i.qtd) || 0) * (Number(i.valor) || 0); }, 0), tit = String(o.titulo || "").replace(/^SERVI[ÇC]O:\s*/i, "");
    return { cli_nome: o.cliente || "", cli_doc: o.documento || "", cli_end: o.endereco || "", cli_tel: o.telefone || "", cli_email: o.email || "", local: o.endereco || "", valor: total ? A.numero(total, 2) : "",
      objeto: (tit ? tit + ":\n" : "") + itens.map(function (i) { return "- " + i.descricao; }).join("\n"), condicoes: o.condicoes || "",
      orcamento_ref: "da proposta" + (tit ? " “" + tit.slice(0, 80) + "”" : "") + (o.data ? " de " + dataBr(o.data) : ""), proposta_id: o.id };
  }
  function modeloDe(cat) { return cat === "eletrica" ? "eletrico" : "servico_obra"; }

  // ---------- tela ----------
  function carregar(depois) {
    run(P.sb.from("contratos_servico").select("*").order("atualizado_em", { ascending: false }).limit(500)).then(function (r) { lista = r.data || []; semTab = false; })
      .catch(function (e) { lista = []; semTab = semT(e); if (!semTab) A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); }).then(depois);
  }
  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>📜 Contratos</h2></div><div class="cartao vazio">Carregando...</div>';
    var emp = window.AGE_EMPRESA && window.AGE_EMPRESA.lista ? window.AGE_EMPRESA.lista(ctx).then(lerEmpresa, function () { lerEmpresa([]); }) : (lerEmpresa([]), Promise.resolve());
    emp.then(function () {
      carregar(function () {
        desenhar(c);
        if (pendenteLJ) { var pl = pendenteLJ; pendenteLJ = null; criarDe(c, pl.m, Object.assign(dadosBase(), pl.d), null); return; }
        if (pendente) { var pd = pendente; pendente = null; var o = P.porId(P.S.propostas || [], pd); if (o) criarDe(c, modeloDe(o.categoria), Object.assign(dadosBase(), daPropostaDados(o)), null); }
      });
    });
  }
  // botão "📜 Criar contrato" da aba Propostas prontas: abre esta aba e já cria o contrato com os dados da proposta
  // botão "📜 Contrato" da aba 🚛 Lava-jato: abre esta aba e já cria o contrato com os dados do cadastro
  function daLavaJato(m, d) { pendenteLJ = { m: m, d: d || {} }; if (location.hash === "#contratos") { var cc = $("#conteudo"); if (cc && P) ver(cc, P); } else location.hash = "#contratos"; }
  function daProposta(id) { pendente = id; if (location.hash === "#contratos") { var cc = $("#conteudo"); if (cc && P) ver(cc, P); } else location.hash = "#contratos"; }
  function desenhar(c) {
    var b = filtro.busca.toLowerCase().trim(), L = lista.filter(function (x) { return (!filtro.status || x.status === filtro.status) && (!b || ((x.titulo || "") + " " + (x.cliente || "")).toLowerCase().indexOf(b) >= 0); });
    c.innerHTML = '<div class="cab-secao"><h2>📜 Contratos</h2><span><button class="prim" id="ct-novo"' + (semTab ? " disabled" : "") + '>+ Novo contrato</button></span></div>' +
      (semTab ? '<div class="aviso">Para salvar os contratos, rode no Supabase o <b>contratos.sql</b> (tabela <b>contratos_servico</b>) e atualize o app.</div>' : "") +
      '<p class="mudo peq" style="margin-top:-4px">Escolha um modelo, preencha (ou traga os dados de um orçamento) e o app monta o contrato com as cláusulas principais. O texto é seu: edite à vontade, ele salva sozinho e sai em PDF com campos de assinatura. São modelos de apoio: em contratos de valor alto, vale a revisão de um advogado.</p>' +
      (function () {
        var A2 = lista.map(function (x) { return { x: x, a: alertaFim(x) }; }).filter(function (o) { return o.a; }).sort(function (p1, p2) { return p1.a.n - p2.a.n; });
        return A2.length ? '<div class="aviso" style="margin:6px 0;border-left:4px solid ' + (A2[0].a.urgente ? "#c0392b" : "#c58a00") + '"><b>' + (A2[0].a.urgente ? "⚠ Contrato(s) perto do fim" : "⏰ Contrato(s) chegando ao fim") + '</b>' + A2.map(function (o) { return '<div class="peq" style="margin-top:3px">' + (o.a.urgente ? "⚠ " : "⏰ ") + esc(o.x.titulo || "") + " — <b>" + esc(o.a.txt) + "</b> (" + esc(dataBr(o.x.dados.fim)) + ")</div>"; }).join("") + '<div class="peq mudo" style="margin-top:4px">Você também recebe o aviso no Telegram 10 dias e 3 dias antes.</div></div>' : "";
      })() +
      '<div class="filtros"><input type="search" id="ct-busca" data-sem-correcao placeholder="🔍 Buscar contrato ou cliente" value="' + esc(filtro.busca) + '"><select id="ct-st" aria-label="Situação"><option value="">Todas as situações</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === filtro.status ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") + "</select></div>" +
      (L.length ? L.map(function (x) {
        return '<div class="cartao" data-ct="' + esc(x.id) + '"><div class="linha" style="gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>' + esc(x.titulo || "(sem título)") + "</b>" + seloFim(x) + "<br><span class=\"peq mudo\">" + esc(x.cliente || "sem cliente") + (x.valor ? " · " + din(x.valor) : "") + " · atualizado " + esc(dataBr(x.atualizado_em)) + '</span>' + (function () { var f2 = /^(assinado|encerrado)$/.test(x.status) ? [] : faltas(x.dados, x.modelo); return f2.length ? '<br><span class="peq" style="color:var(--atencao,#b7791f)">⚠ Falta preencher: ' + esc(f2.join(", ")) + "</span>" : ""; })() + '</div><span class="selo">' + esc(STATUS[x.status] || x.status) + "</span></div>" +
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
        var x = achar(b2.dataset.dp), d = Object.assign({}, x.dados || {}, { numero: dadosBase().numero }); delete d._ag; delete d.fim; delete d._fimAuto;
        criar({ modelo: x.modelo, titulo: (x.titulo || "") + " (cópia)", cliente: x.cliente, valor: x.valor, dados: d, texto: x.texto, status: "rascunho" }, c, false);
      };
    });
    $$("[data-ap]", c).forEach(function (b2) {
      b2.onclick = function () {
        var x = achar(b2.dataset.ap); if (!x || !A.confirmar("Apagar o contrato “" + (x.titulo || "") + "”?")) return;
        var ag = (x.dados || {})._ag || {}; Object.keys(ag).forEach(function (k) { if (ag[k] && ag[k].id) run(P.sb.from("agenda_eventos").delete().eq("id", ag[k].id)).catch(function () { /* sem agenda */ }); });
        run(P.sb.from("contratos_servico").delete().eq("id", x.id)).then(function () { lista = lista.filter(function (y) { return y.id !== x.id; }); desenhar(c); }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
      };
    });
  }
  function criar(reg, c, abrir) {
    run(P.sb.from("contratos_servico").insert(reg).select()).then(function (r) {
      var x = (r.data || [])[0]; if (!x) return; lista.unshift(x); desenhar(c); if (abrir !== false) editar(x, c); else A.avisar("Contrato duplicado", "ok");
    }).catch(function (e) { A.avisar(A.msgErro ? A.msgErro(e) : e.message, "erro"); });
  }
  // padrões de cada modelo da equipe (só entram se o campo estiver vazio)
  function padroesPessoa(m, d) {
    var P0 = { parceiro: { unidade_valor: "por diária", prazo: "3 (três) meses, ou até o fim da obra, o que ocorrer primeiro", pagamento: "quinzenal, até o 5º dia útil após cada fechamento" },
      clt_exp: { unidade_valor: "por mês", prazo: "45 (quarenta e cinco) dias, prorrogável por mais 45 (quarenta e cinco) dias", pagamento: "mensalmente, até o 5º dia útil do mês seguinte" },
      clt_det: { unidade_valor: "por mês", prazo: "", pagamento: "mensalmente, até o 5º dia útil do mês seguinte" },
      clt_ind: { unidade_valor: "por mês", prazo: "", pagamento: "mensalmente, até o 5º dia útil do mês seguinte" } }[m] || {};
    Object.keys(P0).forEach(function (k) { if (!String(d[k] || "").trim()) d[k] = P0[k]; });
    return d;
  }
  function criarDe(c, m, d, o) {
    if (m === "manutencao" && !d.vigencia) d.vigencia = "12 meses";
    if (m === "lj_frota") { d.vigencia = d.vigencia || "12 meses"; d.garantia = "24 (vinte e quatro) horas"; d.pagamento = d.pagamento || "mensal, mediante extrato dos atendimentos do mês, por PIX ou boleto, com vencimento até o dia 10 do mês seguinte"; }
    if (m === "lj_socio") { d.prazo = d.prazo || "24 (vinte e quatro) meses"; d.dia_contas = d.dia_contas || "10º (décimo) dia do mês seguinte"; }
    if (ehPessoa(m)) padroesPessoa(m, d);
    d.inicio = d.inicio || "";
    var texto = gerar(m, d), cli = d.cli_nome || d.pessoa_nome || "";
    d._gerado = texto;   // marca o texto como "não editado à mão": ele acompanha os campos
    criar({ modelo: m, titulo: MODELOS[m].nome + (cli ? " – " + cli : ""), cliente: cli || null, valor: Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || null, dados: d, texto: texto, status: "rascunho", orcamento_id: o ? o.id : null }, c);
  }
  function novo(c) {
    var orcs = ((P.S.orc) || []).slice().sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }),
      props = ((P.S.propostas) || []).slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var primeiro = true;
    function radioModelo(k) { var ch = primeiro ? " checked" : ""; primeiro = false; return '<label class="marca-linha" style="font-weight:400;display:block;margin:6px 0"><input type="radio" name="ct-mod" value="' + k + '"' + ch + '> <b>' + esc(MODELOS[k].nome) + '</b><br><span class="peq mudo">' + esc(MODELOS[k].desc) + "</span></label>"; }
    var pars = ((P.S.parceiros) || []).filter(function (x) { return x.ativo !== false; }), funcs = ((P.S.func) || []).filter(function (x) { return x.ativo !== false; });
    var j = A.janela('<p class="mudo peq" style="margin-top:0">1) Escolha o modelo. 2) Para contratos com clientes, traga os dados de uma <b>proposta pronta</b> ou de um orçamento; para contratos com a equipe, escolha o <b>parceiro ou funcionário cadastrado</b>. O que faltar você edita no contrato.</p>' +
      '<h4 style="margin:10px 0 2px">👥 Contratos com clientes</h4>' + GRUPO_CLIENTE.map(radioModelo).join("") +
      '<h4 style="margin:12px 0 2px">🤝 Contratos com a equipe (parceiros e funcionários)</h4>' + GRUPO_EQUIPE.map(radioModelo).join("") + '<h4 style="margin:12px 0 2px">🚛 Lava-jato de caminhões</h4>' + GRUPO_LAVAJATO.map(radioModelo).join("") +
      '<div class="ct-bloco-pes oculto"><label>Preencher com um <b>parceiro ou funcionário cadastrado</b><select class="ct-pes"><option value="">— nenhum: eu preencho —</option>' + (pars.length ? '<optgroup label="🤝 Parceiros">' + pars.map(function (x) { return '<option value="p:' + esc(x.id) + '">' + esc(x.nome) + (x.tipo ? " · " + esc(x.tipo) : "") + "</option>"; }).join("") + "</optgroup>" : "") + (funcs.length ? '<optgroup label="👷 Funcionários">' + funcs.map(function (x) { return '<option value="f:' + esc(x.id) + '">' + esc(x.nome) + "</option>"; }).join("") + "</optgroup>" : "") + '</select></label><p class="peq mudo" style="margin:4px 0 0">Vêm só os dados que já estão cadastrados (nome, telefone, e-mail, endereço, Pix). CPF, RG e endereço você completa no contrato.</p></div>' +
      '<div class="ct-bloco-cli"><label>Trazer dados de uma <b>proposta pronta</b><select class="ct-prop"><option value="">— nenhuma —</option>' + props.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc((o.cliente || "Cliente") + " · " + String(o.titulo || "").replace(/^SERVI[ÇC]O:\s*/i, "").slice(0, 60) + (Number(o.total) ? " · " + din(o.total) : "")) + "</option>"; }).join("") + "</select></label>" +
      '<label>ou de um <b>orçamento</b><select class="ct-orc"><option value="">— nenhum: eu preencho —</option>' + orcs.map(function (o) { var t = P.calcOrc ? P.calcOrc(o).total : 0; return '<option value="' + esc(o.id) + '">' + esc(String(o.numero || "").padStart(4, "0") + " · " + (o.cliente || "") + (t ? " · " + din(t) : "")) + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="acoes"><button class="prim" id="ct-criar">Criar contrato</button><button id="ct-x">Cancelar</button></div>', { titulo: "📜 Novo contrato", semRascunho: true });
    $(".ct-prop", j.el).onchange = function () { var pr = this.value ? P.porId(P.S.propostas || [], this.value) : null; if (pr) { var r = $('input[name="ct-mod"][value="' + modeloDe(pr.categoria) + '"]', j.el); if (r) r.checked = true; } };
    function mostrarBlocos() { var m0 = $('input[name="ct-mod"]:checked', j.el).value, eq = ehPessoa(m0); $(".ct-bloco-pes", j.el).classList.toggle("oculto", !eq); $(".ct-bloco-cli", j.el).classList.toggle("oculto", eq); }
    $$('input[name="ct-mod"]', j.el).forEach(function (r) { r.addEventListener("change", mostrarBlocos); });
    mostrarBlocos();
    $("#ct-x", j.el).onclick = function () { j.fechar(); };
    $("#ct-criar", j.el).onclick = function () {
      var mSel = $('input[name="ct-mod"]:checked', j.el).value;
      if (ehPessoa(mSel)) {
        var dp = dadosBase(), sel = $(".ct-pes", j.el).value, ref = sel ? P.porId(sel.charAt(0) === "p" ? (P.S.parceiros || []) : (P.S.func || []), sel.slice(2)) : null;
        if (ref) { dp.pessoa_nome = ref.nome || ""; dp.pessoa_tel = ref.whatsapp || ref.telefone || ""; dp.pessoa_email = ref.email || ""; dp.pessoa_end = [ref.endereco, ref.cidade].filter(Boolean).join(", "); if (sel.charAt(0) === "f" && ref.pix) dp.pessoa_pix = ref.pix; if (sel.charAt(0) === "f" && Number(ref.diaria) > 0 && mSel === "parceiro") dp.valor = A.numero(Number(ref.diaria), 2); if (sel.charAt(0) === "p" && ref.tipo) dp.pessoa_funcao = ref.tipo; }
        j.fechar(); criarDe(c, mSel, dp, null); return;
      }
      var m = $('input[name="ct-mod"]:checked', j.el).value, oid = $(".ct-orc", j.el).value, o = oid ? P.porId(P.S.orc, oid) : null, pid = $(".ct-prop", j.el).value, pr = pid ? P.porId(P.S.propostas || [], pid) : null;
      var d = Object.assign(dadosBase(), pr ? daPropostaDados(pr) : {}, o ? doOrcamento(o) : {});
      j.fechar(); criarDe(c, m, d, o);
    };
  }

  // ---------- editor ----------
  function editar(x, c) {
    var d = Object.assign({}, x.dados || {}), m = x.modelo, tm = null, ultimoGerado = d._gerado || "";
    function campo(k, rot, tipo, extra) { return '<label style="flex:1;min-width:220px">' + rot + (tipo === "area" ? '<textarea class="f-' + k + '" rows="' + (extra || 3) + '" maxlength="3000"></textarea>' : '<input class="f-' + k + '"' + (tipo === "date" ? ' type="date"' : ' maxlength="300"') + (/^(cli_nome|cli_doc|cli_end|cli_rep|cli_tel|cli_email|emp_nome|emp_doc|emp_end|emp_rep|emp_tel|emp_email|valor|numero|foro|multa|juros|pessoa_nome|pessoa_doc|pessoa_rg|pessoa_ctps|pessoa_pis|pessoa_cnpj|pessoa_pix|pessoa_end|pessoa_tel|pessoa_email|unidade_valor|aviso_dias)$/.test(k) ? " data-sem-correcao" : "") + ">") + "</label>"; }
    function htmlPessoa() {
      var clt = m !== "parceiro", RT = clt ? "Empregado(a)" : "Parceiro(a)";
      var aviso = clt ? '<div class="aviso" style="margin:6px 0"><b>⚠ Antes de começar (CLT):</b> exame médico admissional (ASO) e registro na CTPS digital e no eSocial <b>antes do primeiro dia de trabalho</b>; EPIs e treinamentos (NR-35, NR-10 quando for o caso). O salário não pode ser menor que o <b>piso da categoria</b> (convenção coletiva) nem que o salário mínimo. Eletricista: avalie o <b>adicional de periculosidade</b>. Contrato de trabalho <b>não precisa de cartório</b>. Confirme valores e encargos com o contador.</div>'
        : '<div class="aviso" style="margin:6px 0"><b>⚠ Para manter a relação autônoma:</b> não controle horário nem exija presença diária fixa; pague por <b>diária, metro ou etapa</b> (não salário fixo); deixe o parceiro usar seus próprios meios e se fazer auxiliar ou substituir; não imponha exclusividade; peça <b>recibo</b> (ou nota do MEI). Se na prática o parceiro trabalhar todos os dias, só para a AGE, com valor fixo e sob ordens, a Justiça do Trabalho pode reconhecer <b>vínculo de emprego</b>, mesmo com este contrato. Confirme com o contador ou advogado.<br><b>Cartório:</b> vale com as assinaturas e 2 testemunhas; <b>reconhecimento de firma</b> e <b>registro em Cartório de Títulos e Documentos</b> são opcionais e dão mais segurança sobre a assinatura e a data. Leve 2 vias e documento com foto de todos.</div>';
      return aviso + '<details open class="cartao"><summary><b>👤 ' + RT + '</b></summary><div class="linha" style="gap:8px;align-items:flex-start">' + campo("pessoa_nome", "Nome completo") + campo("pessoa_funcao", clt ? "Função / cargo" : "Função (pintor, eletricista, ajudante...)") + '</div>' +
        '<div class="linha" style="gap:8px">' + campo("pessoa_doc", "CPF") + campo("pessoa_rg", "RG") + (clt ? campo("pessoa_ctps", "CTPS (nº e série, ou CPF se digital)") + campo("pessoa_pis", "PIS / NIT") : campo("pessoa_cnpj", "CNPJ do MEI (se tiver)") + campo("pessoa_pix", "Chave Pix para pagamento")) + '</div>' +
        '<div class="linha" style="gap:8px">' + campo("pessoa_end", "Endereço completo") + campo("pessoa_tel", "Telefone / WhatsApp") + campo("pessoa_email", "E-mail") + '</div></details>' +
        '<details open class="cartao"><summary><b>🏢 AGE (' + (clt ? "empregador" : "contratante") + ')</b></summary><div class="linha" style="gap:8px">' + campo("emp_nome", "Nome da empresa") + campo("emp_doc", "CNPJ") + '</div><div class="linha" style="gap:8px">' + campo("emp_end", "Endereço") + campo("emp_rep", "Representante que assina pela AGE") + '</div><div class="linha" style="gap:8px">' + campo("emp_tel", "Telefone / WhatsApp") + campo("emp_email", "E-mail") + '</div></details>' +
        '<details open class="cartao"><summary><b>📋 Condições</b></summary>' + campo("objeto", clt ? "Atividades da função (opcional, uma por linha)" : "Obra / serviços que o parceiro vai fazer (um por linha)", "area", 4) + '<div class="linha" style="gap:8px">' + campo("local", clt ? "Local de trabalho (vazio = obras indicadas pela empresa)" : "Local de execução (obra)") + campo("valor", clt ? "Salário (R$)" : "Valor (R$)") + campo("unidade_valor", clt ? "Por (mês, hora...)" : "Por (diária, m², etapa...)") + '</div>' +
        '<div class="linha" style="gap:8px">' + campo("pagamento", "Forma e prazo de pagamento") + campo("prazo", m === "clt_ind" ? "Prazo (não se aplica)" : (m === "parceiro" ? "Duração da temporada" : "Prazo do contrato")) + '</div>' +
        '<div class="linha" style="gap:8px">' + campo("inicio", "Início", "date") + (m === "clt_ind" ? "" : campo("fim", "Término do contrato (o app avisa 10 e 3 dias antes)", "date")) + campo("numero", "Nº do contrato") + campo("foro", "Foro (cidade/UF)") + '</div>' +
        (m === "clt_det" ? campo("motivo", "Motivo do prazo determinado (serviço transitório)", "area", 2) : "") +
        (clt ? '<div class="linha" style="gap:8px">' + campo("jornada", "Jornada de trabalho") + '</div><div class="linha" style="gap:8px">' + campo("adicionais", "Adicionais (periculosidade, insalubridade...)") + campo("beneficios", "Benefícios (VT, alimentação...)") + '</div>'
          : '<div class="linha" style="gap:8px">' + campo("ferramentas", "A AGE fornece (materiais, EPIs, ferramentas)") + campo("garantia_p", "Retrabalho de defeitos (prazo)") + '</div><div class="linha" style="gap:8px">' + campo("aviso_dias", "Aviso para encerrar (dias)") + campo("multa", "Multa por atraso (%)") + campo("juros", "Juros ao mês (%)") + '</div>') + '</details>';
    }
    function htmlLJ() {
      var so = m === "lj_socio", L = function (a, b) { return '<div class="linha" style="gap:8px;align-items:flex-start">' + a + (b || "") + "</div>"; };
      var aviso = so ? '<div class="aviso" style="margin:6px 0"><b>⚠ Sociedade em conta de participação:</b> o sócio ostensivo (lava-jato) responde sozinho perante clientes, fornecedores e funcionários; o sócio participante só tem direito ao aporte e à parte combinada do lucro. Se o sócio vai aparecer, assinar contratos ou responder pelo negócio, o caminho é abrir uma empresa (LTDA) com contrato social. Converse com o contador antes de assinar.</div>'
        : '<div class="aviso" style="margin:6px 0"><b>Dica:</b> o contrato já traz a lista de caminhões e a tabela de preços do cadastro da aba 🚛 Lava-jato. Atualize os campos abaixo se algo mudou.</div>';
      return aviso + '<details open class="cartao"><summary><b>👥 Partes</b></summary>' +
        L(campo("cli_nome", so ? "Sócio participante (quem aporta)" : "Empresa contratante (transportadora / frota)"), campo("cli_doc", so ? "CPF / CNPJ do sócio" : "CNPJ da empresa")) +
        L(campo("cli_end", "Endereço"), campo("cli_rep", so ? "Representante (se for empresa)" : "Responsável da empresa")) + L(campo("cli_tel", "Telefone / WhatsApp"), campo("cli_email", "E-mail")) +
        L(campo("emp_nome", so ? "Sócio ostensivo (o lava-jato)" : "Contratada (o lava-jato)"), campo("emp_doc", "CNPJ do lava-jato")) + L(campo("emp_end", "Endereço do lava-jato"), campo("emp_rep", "Quem assina pelo lava-jato")) + L(campo("emp_tel", "Telefone"), campo("emp_email", "E-mail")) + "</details>" +
        '<details open class="cartao"><summary><b>📋 Condições</b></summary>' +
        (so ? campo("objeto", "Atividade da sociedade", "area", 2) + L(campo("valor", "Valor do aporte (R$)"), campo("pagamento", "Forma e datas do aporte")) + L(campo("perc_part", "% do lucro do sócio participante"), campo("dia_contas", "Prestação de contas / pagamento até")) + L(campo("limite", "Despesa extra que exige concordância (R$, opcional)"), campo("prazo", "Prazo do contrato")) + L(campo("inicio", "Início", "date"), campo("fim", "Término do contrato (o app avisa 10 e 3 dias antes)", "date")) + campo("local", "Local do negócio")
          : campo("objeto", "Serviços e preços (um por linha)", "area", 4) + campo("frota", "Caminhões da frota (placa – marca)", "area", 4) + L(campo("local", "Local de execução"), campo("valor", "Estimativa de movimento mensal (R$, opcional)")) + L(campo("pagamento", "Forma e prazo de pagamento"), campo("vigencia", "Vigência (ex.: 12 meses)")) + L(campo("inicio", "Início", "date"), campo("fim", "Término do contrato (o app avisa 10 e 3 dias antes)", "date")) + campo("garantia", "Prazo para reclamar de um serviço") + L(campo("multa", "Multa por atraso (%)"), campo("juros", "Juros ao mês (%)"))) +
        L(campo("numero", "Nº do contrato"), campo("foro", "Foro (cidade/UF)")) + campo("condicoes", "Outras condições (opcional)", "area", 3) + "</details>";
    }
    var html = '<div class="peq" id="ct-st-info" style="margin-bottom:2px;color:var(--mudo)">salva sozinho</div><div class="peq" id="ct-falta" style="margin-bottom:6px"></div>' +
      (ehPessoa(m) ? htmlPessoa() : ehLJ(m) ? htmlLJ() : '<details open class="cartao"><summary><b>👥 Partes</b></summary><div class="linha" style="gap:8px;align-items:flex-start">' + campo("cli_nome", "Contratante (cliente)") + campo("cli_doc", "CPF / CNPJ do cliente") + '</div><div class="linha" style="gap:8px">' + campo("cli_end", "Endereço do cliente") + campo("cli_rep", "Representante (síndico, sócio...)") + '</div><div class="linha" style="gap:8px">' + campo("cli_tel", "Telefone / WhatsApp do cliente") + campo("cli_email", "E-mail do cliente") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("emp_nome", "Contratada (sua empresa)") + campo("emp_doc", "CNPJ da contratada") + '</div><div class="linha" style="gap:8px">' + campo("emp_end", "Endereço da contratada") + campo("emp_rep", "Representante da contratada") + '</div><div class="linha" style="gap:8px">' + campo("emp_tel", "Telefone / WhatsApp da AGE") + campo("emp_email", "E-mail da AGE") + '</div><div class="linha" style="gap:8px">' + campo("banco", "Dados para pagamento (banco, agência, conta, Pix)") + campo("rt", "Responsável técnico (nome e CREA)") + "</div></details>" +
      '<details open class="cartao"><summary><b>📋 Condições</b></summary>' + campo("objeto", "Objeto: o que será feito (um item por linha)", "area", 5) + '<div class="linha" style="gap:8px">' + campo("local", "Local de execução") + campo("valor", m === "manutencao" ? "Valor mensal (R$)" : "Valor total (R$)") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("pagamento", "Forma de pagamento") + campo("prazo", "Prazo / duração") + '</div><div class="linha" style="gap:8px">' + campo("inicio", "Início previsto", "date") + (m === "aditivo" ? "" : campo("fim", "Término do contrato (o app avisa 10 e 3 dias antes)", "date")) + (m === "manutencao" ? campo("vigencia", "Vigência (ex.: 12 meses)") : "") + (m === "aditivo" ? campo("contrato_ref", "Contrato original (nº e data)") : "") + campo("numero", "Nº do contrato") + '</div>' +
      '<div class="linha" style="gap:8px">' + campo("garantia", "Garantia dos serviços") + campo("multa", "Multa por atraso (%)") + campo("juros", "Juros ao mês (%)") + campo("foro", "Foro (cidade/UF)") + '</div>' + campo("condicoes", "Condições comerciais da proposta (opcional)", "area", 3) + "</details>") +
      '<div class="acoes"><button class="prim" id="ct-gerar">🔄 Gerar o texto com estes campos</button><span class="peq mudo">Situação:</span><select id="ct-status" aria-label="Situação">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k] + "</option>"; }).join("") + "</select></div>" +
      '<p class="peq mudo" style="margin:2px 0 0">⏳ <b>Pré-aprovado</b> deixa o contrato guardado para você finalizar em outro dia: ele aparece na lista com o que ainda falta preencher.</p><label>Texto do contrato <span class="peq mudo">— muda sozinho quando você edita os campos acima; se você editar o texto à mão, ele deixa de mudar sozinho (use 🔄 para refazer)</span><textarea class="ct-texto" rows="22" data-sem-correcao style="font-family:inherit;line-height:1.45"></textarea></label>' +
      '<div class="acoes"><button class="prim" id="ct-imp">🖨 Imprimir / salvar PDF</button><button id="ct-mail">✉️ Enviar por e-mail</button><button id="ct-fechar">Fechar</button></div>';
    var j = A.janela(html, { titulo: "📜 " + (x.titulo || "Contrato"), larga: true, semRascunho: true, aoFechar: function () { salvarJa(); desenhar(c); } });
    $$("[class^=f-]", j.el).forEach(function (e) { var k = String(e.className).split(" ")[0].replace(/^f-/, ""); e.value = d[k] === undefined || d[k] === null ? "" : d[k]; });
    $(".ct-texto", j.el).value = x.texto || ""; $("#ct-status", j.el).value = x.status || "rascunho";
    function ler() { $$("[class^=f-]", j.el).forEach(function (e) { d[String(e.className).split(" ")[0].replace(/^f-/, "")] = e.value; }); }
    // campos importantes que ainda faltam ficam destacados em amarelo
    function marcarFaltas() {
      var f2 = [], IMP = importantes(m);
      Object.keys(IMP).forEach(function (k) {
        var e = $(".f-" + k, j.el); if (!e) return;
        var vazio = !String(e.value || "").trim(); e.classList.toggle("ct-falta", vazio); if (vazio && !(k === "inicio" && m === "aditivo") && !(k === "prazo" && m === "clt_ind")) f2.push(IMP[k]);
      });
      $("#ct-falta", j.el).innerHTML = f2.length ? '<span style="color:var(--atencao,#b7791f)">⚠ Faltam ' + f2.length + " campo(s) importante(s): " + esc(f2.join(", ")) + ".</span>" : '<span style="color:var(--bom,#1b7f3b)">✓ Campos importantes preenchidos.</span>';
    }
    function autoFim(t) {
      var k = t && String(t.className || "").split(" ")[0].replace(/^f-/, "");
      if (k === "fim") { d._fimAuto = ""; return; }
      if (k !== "inicio" && k !== "prazo" && k !== "vigencia") return;
      var fe = $(".f-fim", j.el); if (!fe) return; ler();
      if (fe.value && fe.value !== d._fimAuto) return;
      var f = calcFim(d.inicio, m === "manutencao" || m === "lj_frota" ? d.vigencia : d.prazo);
      if (f) { fe.value = f; d._fimAuto = f; d.fim = f; }
    }
    function regerarAuto() {
      var ta = $(".ct-texto", j.el); if (!ta) return;
      ler();
      if (ta.value === ultimoGerado || !ta.value.trim()) { var t = gerar(m, d); ta.value = t; ultimoGerado = t; }
    }
    var cadeia = Promise.resolve();
    function salvarJa() { clearTimeout(tm); ler(); var st0 = $("#ct-status", j.el) ? $("#ct-status", j.el).value : x.status; cadeia = cadeia.then(function () { return sincAgenda(d, x.titulo, st0); }).then(gravarJa); return cadeia; }
    function gravarJa() {
      var reg = { dados: Object.assign({}, d, { _gerado: ultimoGerado }), texto: $(".ct-texto", j.el) ? $(".ct-texto", j.el).value : x.texto, status: $("#ct-status", j.el) ? $("#ct-status", j.el).value : x.status, cliente: d.cli_nome || d.pessoa_nome || null,
        valor: Number(String(d.valor || "").replace(/\./g, "").replace(",", ".")) || null, atualizado_em: new Date().toISOString() };
      Object.assign(x, reg);
      return run(P.sb.from("contratos_servico").update(reg).eq("id", x.id)).then(function () { var s = $("#ct-st-info", j.el); if (s) { s.textContent = "💾 Salvo às " + agora(); s.style.color = ""; } })
        .catch(function (e) {
          var s = $("#ct-st-info", j.el), semSql = /contratos_servico_status_check/.test(String(e && (e.message || e.details) || ""));
          if (semSql) { x.status = "rascunho"; if ($("#ct-status", j.el)) $("#ct-status", j.el).value = "rascunho"; }
          if (s) { s.textContent = semSql ? "Para usar “Pré-aprovado”, rode no Supabase o contratos.sql atualizado (a situação voltou para Rascunho)." : "Não salvou: " + (A.msgErro ? A.msgErro(e) : e.message); s.style.color = "var(--perigo,#c0392b)"; }
        });
    }
    function agendar() { var s = $("#ct-st-info", j.el); if (s) s.textContent = "salvando…"; clearTimeout(tm); tm = setTimeout(salvarJa, 1000); }
    marcarFaltas();
    var tr = null;
    j.el.addEventListener("input", function (ev) {
      if (ev.target && /^f-/.test(ev.target.className || "")) { autoFim(ev.target); marcarFaltas(); clearTimeout(tr); tr = setTimeout(function () { regerarAuto(); agendar(); }, 350); }
      else agendar();
    });
    j.el.addEventListener("change", agendar);
    $("#ct-gerar", j.el).onclick = function () {
      ler();
      var atual = $(".ct-texto", j.el).value;
      if (atual.trim() && atual !== ultimoGerado && !A.confirmar("O texto foi editado à mão. Gerar de novo substitui o texto atual pelo modelo com os campos. Continuar?")) return;
      var t = gerar(m, d); $(".ct-texto", j.el).value = t; ultimoGerado = t; salvarJa();
    };
    $("#ct-imp", j.el).onclick = function () { salvarJa().then(function () { imprimir(x); }); };
    // e-mail: abre o programa de e-mail com destinatário, assunto e mensagem prontos; o PDF você anexa (o navegador não anexa sozinho)
    $("#ct-mail", j.el).onclick = function () {
      salvarJa(); ler();
      var E = A.CFG.EMPRESA || {}, para = String(d.cli_email || d.pessoa_email || "").trim(), nome = d.cli_nome || d.pessoa_nome || "", de = d.emp_nome || E.nome || "AGE";
      var assunto = (MODELOS[m] ? MODELOS[m].nome : "Contrato") + (d.numero ? " nº " + d.numero : "") + " – " + de;
      var corpo = "Olá" + (nome ? ", " + nome : "") + ",\n\nSegue em anexo o contrato" + (d.numero ? " nº " + d.numero : "") + " (" + (MODELOS[m] ? MODELOS[m].nome : "contrato") + ") para sua leitura e assinatura.\nPor favor, confira os dados, assine e devolva uma via por e-mail ou entregue em mãos.\n\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\n" + de + (d.emp_rep ? "\n" + d.emp_rep : "") + (d.emp_tel || E.telefone ? "\n" + (d.emp_tel || E.telefone) : "");
      var a = document.createElement("a"); a.href = "mailto:" + encodeURIComponent(para).replace(/%40/g, "@") + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpo); document.body.appendChild(a); a.click(); a.remove();
      A.avisar(para ? "E-mail aberto. Anexe o PDF: use 🖨 Imprimir / salvar PDF, salve o arquivo e anexe." : "E-mail aberto, mas falta o e-mail do cliente (preencha no contrato). Anexe o PDF salvo em 🖨 Imprimir / salvar PDF.", "ok");
      if (x.status === "rascunho" || x.status === "pre_aprovado") { var st = $("#ct-status", j.el); if (st && A.confirmar("Marcar este contrato como “Enviado ao cliente”?")) { st.value = "enviado"; salvarJa(); } }
    };
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
    var m0 = x.modelo, clt0 = ehPessoa(m0) && m0 !== "parceiro", ehP = ehPessoa(m0);
    var assinaturas = m0 === "lj_socio"
      ? "<div>" + esc(d.cli_nome || "SÓCIO PARTICIPANTE") + "<br>SÓCIO PARTICIPANTE" + (d.cli_doc ? "<br>" + esc(d.cli_doc) : "") + "</div><div>" + esc(d.emp_nome || "SÓCIO OSTENSIVO") + "<br>SÓCIO OSTENSIVO" + (d.emp_rep ? "<br>" + esc(d.emp_rep) : "") + "</div>"
      : ehP
      ? "<div>" + esc(d.pessoa_nome || (clt0 ? "EMPREGADO(A)" : "PARCEIRO(A)")) + "<br>" + (clt0 ? "EMPREGADO(A)" : "CONTRATADO(A) / PARCEIRO(A)") + (d.pessoa_doc ? "<br>CPF " + esc(d.pessoa_doc) : "") + "</div><div>" + esc(d.emp_nome || E.nome || "AGE") + "<br>" + (clt0 ? "EMPREGADOR" : "CONTRATANTE") + (d.emp_rep ? "<br>" + esc(d.emp_rep) : "") + "</div>"
      : "<div>" + esc(d.cli_nome || "CONTRATANTE") + "<br>CONTRATANTE" + (d.cli_rep ? "<br>" + esc(d.cli_rep) : "") + "</div><div>" + esc(d.emp_nome || E.nome || "CONTRATADA") + "<br>CONTRATADA" + (d.emp_rep ? "<br>" + esc(d.emp_rep) : "") + "</div>";
    var info = [E.documento || (d.emp_doc ? "CNPJ " + d.emp_doc : ""), E.inscricoes].filter(Boolean).map(esc).join(" · "), cont = [d.emp_tel || E.telefone, d.emp_email || E.email, E.sitePintura && E.sitePintura.replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean).map(esc).join(" · ");
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(x.titulo || "Contrato") + "</title><style>" +
      "body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:0 auto;padding:28px 28px 70px;max-width:800px}.cab{display:flex;gap:14px;align-items:center;border-bottom:3px solid #14325c;padding-bottom:10px;margin-bottom:12px}.cab .t{flex:1}.cab b{font-size:19px;color:#14325c}.cab .s{font-size:11px;color:#444;line-height:1.35}.cab .d{text-align:right;font-size:11px;color:#444;line-height:1.35}" +
      "h1{font-size:15px;text-align:center;color:#14325c;margin:14px 0 6px}h3{font-size:13px;margin:14px 0 4px;color:#14325c}p{margin:3px 0;text-align:justify;white-space:pre-wrap}" +
      ".ass{display:flex;gap:40px;margin-top:56px}.ass div{flex:1;border-top:1px solid #333;text-align:center;padding-top:4px;font-size:12px}.test{margin-top:36px}.test div{border-top:1px solid #333;padding-top:4px;font-size:12px}.rod{position:fixed;left:0;right:0;bottom:0;text-align:center;font-size:10px;color:#555;border-top:1px solid #ccc;padding:5px 12px;background:#fff}" +
      "@media print{body{padding:0 0 40px}button{display:none}h3{break-after:avoid}.ass,.test{break-inside:avoid}}button{padding:10px 16px;font-size:15px;margin:0 0 14px;cursor:pointer}</style></head><body>" +
      '<button onclick="window.print()">🖨 Imprimir / salvar PDF</button>' +
      '<div class="cab">' + LOGO + '<div class="t"><b>' + esc(E.nome || "AGE Elétrica e Pintura") + '</b><div class="s">' + info + '</div></div><div class="d">' + esc(E.endereco || "") + "<br>" + esc(E.cidade || "") + "<br>" + cont + "</div></div>" + corpo +
      '<p style="margin-top:22px">' + esc(cidade) + ", " + dataLonga(new Date()) + '.</p>' +
      '<div class="ass">' + assinaturas + "</div>" +
      '<div class="ass test"><div>Testemunha 1<br>Nome:<br>CPF:</div><div>Testemunha 2<br>Nome:<br>CPF:</div></div>' +
      '<div class="rod">' + esc(E.nome || "AGE Elétrica e Pintura") + " · " + cont + " · Contrato " + esc(d.numero || "") + ' · Rubricas: ________ ________</div>' +
      "<script>setTimeout(function(){window.print()},400)<\/script></body></html>";
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.AGE_CONTR = { ver: ver, gerar: gerar, extenso: extenso, daProposta: daProposta, daLavaJato: daLavaJato };
})();
