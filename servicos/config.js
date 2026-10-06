// =====================================================================
// CONFIGURAÇÃO DO APP — preencha uma vez (veja LEIA-ME.md, passo 3).
// A "anon public key" do Supabase pode ficar aqui: ela é pública por
// natureza. Quem protege os dados são as regras do arquivo supabase.sql.
// NUNCA coloque aqui a chave "service_role".
// =====================================================================
window.AGE_CONFIG = {
  SUPABASE_URL: "",       // ex.: "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "",  // ex.: "eyJhbGciOi..."

  // Ponto de partida padrão das rotas (opcional). Ex.: { nome: "Oficina AGE", lat: -19.93, lng: -44.05 }
  // Dica: no Google Maps, toque e segure no local e copie os números que aparecem.
  BASE: null,

  // Dados que saem no cabeçalho do orçamento impresso / PDF
  EMPRESA: {
    nome: "AGE Elétrica e Pintura",
    documento: "",   // CNPJ ou CPF
    telefone: "",
    email: "",
    endereco: "",
    cidade: ""
  }
};
