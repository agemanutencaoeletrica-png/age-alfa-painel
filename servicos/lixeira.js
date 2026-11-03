// Painel do dono — 🗑 LIXEIRA: o que você apaga não some de vez. Fica 30 dias nesta área e dá para restaurar.
// Funciona assim: no momento em que o app manda apagar um registro das tabelas abaixo, uma cópia vai para a tabela "lixeira"
// (só depois disso o registro é apagado; se a cópia falhar, nada é apagado). Aqui você restaura ou apaga de vez.
// Fora da lixeira (por segurança, porque apagar leva fotos/filhos junto): serviços, obras, lojas, rotas, equipe, prefeitura, preços, propostas e orçamentos das lojas.
(function () {
  "use strict";
  var A = window.AGE, esc = A.esc, $ = A.$, $$ = A.$$;
  var P = null;
  var DIAS = 30;
  var TABELAS = { orcamentos: "Orçamento", parceiros: "Parceiro", prospects: "Prospecção", fornecedores: "Fornecedor", pagamentos: "Pagamento", compras: "Compra", receitas: "Nota / receita", modelos_laudo: "Modelo de laudo" };
  var estado = { semLixeira: false, avisou: false };
  var filtro = { tipo: "", busca: "" };

  function titulo(l) {
    var nome = l.cliente || l.nome || l.razao_social || l.titulo || l.descricao || l.loja || l.favorecido || l.fornecedor || l.empresa || "";
    var num = l.numero != null && l.numero !== "" ? String(l.numero).padStart(4, "0") : "";
    var t = [num, nome].filter(Boolean).join(" · ");
    return String(t || ("registro " + String(l.id || "").slice(0, 8))).slice(0, 200);
  }
  function tabelaFaltando(e) { return /does not exist|schema cache|relation .*lixeira|PGRST205|42P01/i.test(String((e && (e.message || e.code)) || e)); }

  // troca o apagar das tabelas acima: copia para a lixeira e só então apaga
  function ligar(sb) {
    if (!sb || sb.__lixeira) return;
    sb.__lixeira = true;
    var orig = sb.from.bind(sb);
    sb.from = function (t) {
      var b = orig(t);
      if (!TABELAS[t]) return b;
      b.delete = function () {
        var filtros = [];
        var cadeia = {
          eq: function (c, v) { filtros.push(["eq", c, v]); return cadeia; },
          in: function (c, v) { filtros.push(["in", c, v]); return cadeia; },
          then: function (ok, erro) { return exec().then(ok, erro); },
          catch: function (f) { return exec().catch(f); }
        };
        function aplicar(qb) { filtros.forEach(function (f) { qb = qb[f[0]](f[1], f[2]); }); return qb; }
        function apagar() { return aplicar(orig(t).delete()); }
        function exec() {
          if (estado.semLixeira || !filtros.length) return Promise.resolve(apagar());
          return Promise.resolve(aplicar(orig(t).select("*"))).then(function (r) {
            var linhas = (r && r.data) || [];
            if (!r || r.error || !linhas.length) return apagar();
            var regs = linhas.map(function (l) { return { tabela: t, registro_id: String(l.id), titulo: titulo(l), dados: l }; });
            return Promise.resolve(orig("lixeira").insert(regs)).then(function (ri) {
              if (ri && ri.error) {
                if (!tabelaFaltando(ri.error)) return { data: null, error: ri.error };   // não conseguiu guardar a cópia: NÃO apaga
                estado.semLixeira = true;
                if (!estado.avisou) { estado.avisou = true; A.avisar("Lixeira desligada: rode o supabase.sql atualizado no Supabase. Por enquanto, apagar é definitivo.", "erro"); }
              }
              return apagar();
            });
          });
        }
        return cadeia;
      };
      return b;
    };
  }

  function dataBr(iso) { var d = new Date(iso); return isNaN(d) ? "" : A.dataHora ? A.dataHora(iso) : d.toLocaleString("pt-BR"); }

  function ver(c, ctx) {
    P = ctx;
    c.innerHTML = '<div class="cab-secao"><h2>🗑 Lixeira</h2><span><button class="perigo peq" id="lx-vazia">Esvaziar a lixeira</button></span></div>' +
      '<p class="mudo peq" style="margin-top:-4px">O que você apaga (orçamentos, parceiros, prospecção, fornecedores, pagamentos, compras, notas e modelos de laudo) fica aqui por <b>' + DIAS + ' dias</b>. Toque em <b>↩ Restaurar</b> para voltar ao lugar de origem.</p>' +
      '<div class="filtros"><input type="search" id="lx-busca" placeholder="🔍 Buscar na lixeira" value="' + esc(filtro.busca) + '"><select id="lx-tipo" aria-label="Tipo"><option value="">Todos os tipos</option>' +
      Object.keys(TABELAS).map(function (k) { return '<option value="' + k + '">' + esc(TABELAS[k]) + "</option>"; }).join("") + '</select></div><div id="lx-res"><div class="cartao vazio">Carregando...</div></div>';
    $("#lx-tipo", c).value = filtro.tipo;
    var itens = [];
    function desenhar() {
      var b = String(filtro.busca || "").toLowerCase().trim();
      var ls = itens.filter(function (x) { return (!filtro.tipo || x.tabela === filtro.tipo) && (!b || (x.titulo + " " + (TABELAS[x.tabela] || "")).toLowerCase().indexOf(b) >= 0); });
      $("#lx-vazia", c).disabled = !itens.length;
      if (!itens.length) { $("#lx-res", c).innerHTML = '<div class="cartao vazio">A lixeira está vazia. 🎉</div>'; return; }
      if (!ls.length) { $("#lx-res", c).innerHTML = '<div class="cartao vazio">Nada com essa busca.</div>'; return; }
      $("#lx-res", c).innerHTML = ls.map(function (x) {
        var resta = Math.max(0, DIAS - Math.floor((Date.now() - new Date(x.apagado_em)) / 864e5));
        return '<div class="cartao" data-lx="' + esc(x.id) + '"><div class="linha" style="gap:8px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>' + esc(x.titulo || "(sem título)") + '</b><br><span class="selo">' + esc(TABELAS[x.tabela] || x.tabela) + '</span> <span class="mudo peq">apagado em ' + esc(dataBr(x.apagado_em)) + " · some em " + resta + ' dia(s)</span></div>' +
          '<button class="prim peq" data-lx-volta>↩ Restaurar</button><button class="perigo peq" data-lx-tchau>🗑 Apagar de vez</button></div></div>';
      }).join("");
      $$("[data-lx]", c).forEach(function (el) {
        var x = itens.filter(function (i) { return i.id === el.dataset.lx; })[0];
        $("[data-lx-volta]", el).onclick = function () { restaurar(x, this); };
        $("[data-lx-tchau]", el).onclick = function () {
          if (!A.confirmar("Apagar de vez “" + x.titulo + "”? Depois disso não dá mais para recuperar.")) return;
          var b2 = this; A.ocupado(b2, true, "Apagando...");
          P.q(P.sb.from("lixeira").delete().eq("id", x.id)).then(function () { itens = itens.filter(function (i) { return i.id !== x.id; }); desenhar(); A.avisar("Apagado de vez", "ok"); }).catch(function (e) { A.ocupado(b2, false); P.falhou(e); });
        };
      });
    }
    function restaurar(x, b2) {
      A.ocupado(b2, true, "Restaurando...");
      P.q(P.sb.rpc("lixeira_restaurar", { p_id: x.id })).then(function () {
        itens = itens.filter(function (i) { return i.id !== x.id; }); desenhar();
        A.avisar("↩ Restaurado: " + x.titulo, "ok");
        if (P.recarregar) P.recarregar();
      }).catch(function (e) {
        A.ocupado(b2, false);
        if (/duplicate|unique|já existe|23505/i.test(String((e && (e.message || e.code)) || e))) A.avisar("Não deu para restaurar: já existe um registro igual (mesmo número ou documento).", "erro");
        else P.falhou(e);
      });
    }
    $("#lx-busca", c).oninput = function () { filtro.busca = this.value; desenhar(); };
    $("#lx-tipo", c).onchange = function () { filtro.tipo = this.value; desenhar(); };
    $("#lx-vazia", c).onclick = function () {
      if (!itens.length || !A.confirmar("Esvaziar a lixeira? Os " + itens.length + " itens somem de vez e não dá para recuperar.")) return;
      var b2 = this; A.ocupado(b2, true, "Esvaziando...");
      P.q(P.sb.from("lixeira").delete().in("id", itens.map(function (i) { return i.id; }))).then(function () { itens = []; A.ocupado(b2, false); desenhar(); A.avisar("Lixeira esvaziada", "ok"); }).catch(function (e) { A.ocupado(b2, false); P.falhou(e); });
    };
    // some o que passou de 30 dias e mostra o resto
    var corte = new Date(Date.now() - DIAS * 864e5).toISOString();
    P.q(P.sb.from("lixeira").delete().lt("apagado_em", corte)).catch(function () { /* sem a tabela: o aviso abaixo cuida */ })
      .then(function () { return P.q(P.sb.from("lixeira").select("*").order("apagado_em", { ascending: false }).limit(500)); })
      .then(function (r) { itens = r || []; desenhar(); })
      .catch(function (e) {
        if (tabelaFaltando(e)) { $("#lx-res", c).innerHTML = '<div class="aviso">Para usar a lixeira, rode no Supabase o <b>supabase.sql</b> atualizado (tabela <b>lixeira</b>).</div>'; $("#lx-vazia", c).disabled = true; }
        else P.falhou(e);
      });
  }

  window.AGE_LIXO = { ligar: ligar, ver: ver };
})();
