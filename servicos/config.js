// =====================================================================
// CONFIGURAÇÃO DO APP — preencha uma vez (veja LEIA-ME.md, passo 3).
// A "anon public key" do Supabase pode ficar aqui: ela é pública por
// natureza. Quem protege os dados são as regras do arquivo supabase.sql.
// NUNCA coloque aqui a chave "service_role".
// =====================================================================
window.AGE_CONFIG = {
  SUPABASE_URL: "https://upghiadxztkojeolkmhd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_A48O8Jdg0fih1oTD8XK-wg_1ChzO1t8",  // chave pública (publishable)

  // Ponto de partida padrão das rotas (opcional). Ex.: { nome: "Oficina AGE", lat: -19.93, lng: -44.05 }
  // Dica: no Google Maps, toque e segure no local e copie os números que aparecem.
  BASE: null,

  // Chamados do portal (Supermercados BH): só entram no app os abertos a partir desta data (aaaa-mm-dd).
  // Os mais antigos que já estão no app continuam recebendo as atualizações (finalizado, valor, reprovação).
  CHAMADOS_DESDE: "2026-10-22",

  // Dados que saem no cabeçalho do orçamento impresso / PDF
  EMPRESA: {
    nome: "AGE Elétrica e Pintura",
    documento: "CNPJ 17.134.491/0001-66",   // CNPJ ou CPF
    telefone: "(31) 98858-9772",
    email: "agemanutencaoeletrica@gmail.com",
    endereco: "R. das Canárias, 249 - Palmeiras",
    cidade: "Ibirité - MG, 32421-250",
    // link para o cliente avaliar a AGE no Google (Perfil da Empresa → Pedir avaliações)
    avaliacao: "https://g.page/r/CXdHVPjUS_tXEBM/review"
  }
};
