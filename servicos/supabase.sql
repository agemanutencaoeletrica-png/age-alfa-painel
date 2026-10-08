-- =====================================================================
-- AGE Elétrica e Pintura — banco de dados do app de serviços (Supabase)
--
-- Como usar: no Supabase abra "SQL Editor" > "New query", cole este
-- arquivo inteiro e clique em "Run". Pode rodar de novo quando o app
-- for atualizado: nada é apagado.
--
-- Segurança:
--   * Só os e-mails da tabela "admins" (você) leem e alteram os dados,
--     incluindo ORÇAMENTOS e valores.
--   * O funcionário NÃO tem login nem acesso às tabelas. Ele só usa o
--     link pessoal (token) e as funções func_dados, registrar_ponto e
--     enviar_relatorio, que nunca devolvem preços nem dados dos outros.
--   * A hora de cada registro de ponto é a do servidor (o celular não
--     consegue adiantar ou atrasar o ponto).
-- =====================================================================

-- ---------- Tabelas ----------

create table if not exists public.admins (
  email text primary key
);

create table if not exists public.funcionarios (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  telefone   text,
  area       text not null default 'ambos' check (area in ('eletrica', 'pintura', 'ambos')),
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.obras (
  id          uuid primary key default gen_random_uuid(),
  cliente     text not null,
  telefone    text,
  email       text,
  endereco    text,
  observacoes text,
  criado_em   timestamptz not null default now()
);

create table if not exists public.lojas (
  id           uuid primary key default gen_random_uuid(),
  codigo       text,
  tipo         text not null default 'loja' check (tipo in ('loja', 'cd', 'posto', 'outro')),
  nome         text not null,
  empresa      text,
  endereco     text,
  numero       text,
  complemento  text,
  bairro       text,
  cidade       text,
  uf           text default 'MG',
  cep          text,
  cnpj         text,
  regiao       text,
  telefone     text,
  lat          double precision,
  lng          double precision,
  geo_precisao text check (geo_precisao in ('endereco', 'cep', 'bairro', 'cidade', 'gps', 'manual')),
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create table if not exists public.servicos (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  categoria      text not null check (categoria in ('eletrica', 'pintura')),
  funcionario_id uuid references public.funcionarios (id) on delete set null,
  descricao      text,
  data_prevista  date,
  status         text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'concluido', 'cancelado')),
  criado_em      timestamptz not null default now(),
  concluido_em   timestamptz
);

create table if not exists public.pontos (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios (id) on delete restrict,
  servico_id     uuid references public.servicos (id) on delete set null,
  tipo           text not null check (tipo in ('chegada', 'servico', 'saida')),
  foto           text not null unique,
  lat            double precision,
  lng            double precision,
  precisao       double precision,
  capturado_em   timestamptz,
  observacao     text,
  criado_em      timestamptz not null default now()
);

create table if not exists public.relatorios (
  id             uuid primary key default gen_random_uuid(),
  servico_id     uuid references public.servicos (id) on delete set null,
  funcionario_id uuid not null references public.funcionarios (id) on delete restrict,
  tipo_servico   text,
  descricao      text,
  materiais      jsonb not null default '[]'::jsonb,
  fotos          text[] not null default '{}',
  concluido      boolean not null default false,
  lido           boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table if not exists public.orcamentos (
  id            uuid primary key default gen_random_uuid(),
  numero        bigint generated always as identity unique,
  obra_id       uuid references public.obras (id) on delete set null,
  relatorio_id  uuid references public.relatorios (id) on delete set null,
  cliente       text not null,
  telefone      text,
  email         text,
  endereco      text,
  categoria     text,
  itens         jsonb not null default '[]'::jsonb,
  desconto      numeric(12, 2) not null default 0,
  total         numeric(12, 2) not null default 0,
  pagamento     text,
  prazo         text,
  validade_dias integer not null default 15,
  observacoes   text,
  status        text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- colunas novas (para quem já tinha rodado uma versão anterior deste arquivo)
alter table public.obras      add column if not exists email text;
alter table public.orcamentos add column if not exists email text;
alter table public.obras      add column if not exists loja_id uuid references public.lojas (id) on delete set null;
alter table public.servicos   add column if not exists criado_pelo_funcionario boolean not null default false;
-- assinatura do responsável no local (gerente da loja / cliente) ao concluir
alter table public.relatorios add column if not exists assinatura   text;
alter table public.relatorios add column if not exists assinado_por text;
alter table public.relatorios add column if not exists assinado_em  timestamptz;
-- o dono liga por serviço quando precisa da assinatura do responsável
alter table public.servicos   add column if not exists pede_assinatura boolean not null default false;

-- ---------- Serviços para prefeituras (órgãos públicos) ----------
-- Várias prefeituras; cada uma com seus contratos (planilha de preços) e as
-- ordens de serviço (OS) com nº de protocolo, fotos antes/depois, assinatura
-- do fiscal e a planilha de medição.
create table if not exists public.prefeituras (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cnpj       text,
  cidade     text,
  uf         text default 'MG',
  contato    text,
  telefone   text,
  email      text,
  endereco   text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.contratos (
  id            uuid primary key default gen_random_uuid(),
  prefeitura_id uuid not null references public.prefeituras (id) on delete cascade,
  numero        text not null,
  processo      text,
  objeto        text,
  secretaria    text,
  inicio        date,
  fim           date,
  valor_total   numeric(14, 2),
  bdi           numeric(6, 2) not null default 0,
  itens         jsonb not null default '[]'::jsonb,   -- [{codigo, descricao, un, qtd, valor}]
  ativo         boolean not null default true,
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create table if not exists public.medicoes (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity unique,
  contrato_id    uuid not null references public.contratos (id) on delete cascade,
  periodo_inicio date,
  periodo_fim    date,
  obras          uuid[] not null default '{}',
  itens          jsonb not null default '[]'::jsonb,  -- [{codigo, descricao, un, qtd, valor}]
  bdi            numeric(6, 2) not null default 0,
  total          numeric(14, 2) not null default 0,
  status         text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'aprovada', 'paga')),
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

alter table public.obras add column if not exists prefeitura_id uuid references public.prefeituras (id) on delete set null;
alter table public.obras add column if not exists contrato_id   uuid references public.contratos (id) on delete set null;
alter table public.obras add column if not exists protocolo     text;   -- nº da OS / protocolo da prefeitura
alter table public.obras add column if not exists secretaria    text;
alter table public.obras add column if not exists tipo_publico  text check (tipo_publico in ('predio', 'iluminacao', 'obra'));
alter table public.obras add column if not exists referencia    text;   -- nº do poste, sala, bloco...
alter table public.obras add column if not exists fiscal        text;   -- nome do fiscal da prefeitura
alter table public.relatorios add column if not exists fotos_antes text[] not null default '{}';

-- Licitações de que a AGE participa (só o dono vê) e documentos de habilitação
create table if not exists public.licitacoes (
  id             uuid primary key default gen_random_uuid(),
  prefeitura_id  uuid references public.prefeituras (id) on delete set null,
  orgao          text not null,
  modalidade     text,
  numero         text,
  objeto         text,
  link           text,
  abertura       timestamptz,
  visita         timestamptz,
  prazo_duvidas  timestamptz,
  valor_estimado numeric(14, 2),
  bdi            numeric(6, 2) not null default 0,
  itens          jsonb not null default '[]'::jsonb,   -- planilha da proposta [{codigo, descricao, un, qtd, valor}]
  proposta       numeric(14, 2),
  validade_dias  integer not null default 60,
  prazo_execucao text,
  documentos     jsonb not null default '[]'::jsonb,   -- checklist [{nome, ok}]
  status         text not null default 'analise'
                 check (status in ('analise', 'participar', 'enviada', 'ganhou', 'perdeu', 'desistiu', 'cancelada')),
  resultado      text,
  contrato_id    uuid references public.contratos (id) on delete set null,
  observacoes    text,
  criado_em      timestamptz not null default now()
);

create table if not exists public.documentos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  validade   date,
  link       text,
  observacao text,
  criado_em  timestamptz not null default now()
);

create index if not exists licitacoes_abertura_idx on public.licitacoes (abertura);
create index if not exists obras_pref_idx      on public.obras (prefeitura_id);
create index if not exists contratos_pref_idx  on public.contratos (prefeitura_id);
create index if not exists medicoes_contr_idx  on public.medicoes (contrato_id);

-- ---------- Veículos: placa e KM (início e fim do uso, com foto do painel e GPS) ----------
create table if not exists public.veiculos (
  id        uuid primary key default gen_random_uuid(),
  placa     text not null unique,
  modelo    text,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.km_registros (
  id             uuid primary key default gen_random_uuid(),
  veiculo_id     uuid not null references public.veiculos (id) on delete restrict,
  funcionario_id uuid not null references public.funcionarios (id) on delete restrict,
  tipo           text not null check (tipo in ('inicio', 'fim')),
  km             integer not null check (km between 0 and 9999999),
  foto           text not null unique,
  lat            double precision,
  lng            double precision,
  precisao       double precision,
  capturado_em   timestamptz,
  criado_em      timestamptz not null default now()
);
create index if not exists km_veic_idx on public.km_registros (veiculo_id, criado_em);
create index if not exists km_func_idx on public.km_registros (funcionario_id, criado_em);

-- rotas montadas no painel (paradas em ordem, com nome/endereço/coordenadas copiados da loja)
create table if not exists public.rotas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  data           date,
  funcionario_id uuid references public.funcionarios (id) on delete set null,
  partida        jsonb,
  paradas        jsonb not null default '[]'::jsonb,
  km             numeric(10, 1),
  criado_em      timestamptz not null default now()
);

create index if not exists lojas_cidade_idx  on public.lojas (cidade);
create index if not exists obras_loja_idx    on public.obras (loja_id);
create index if not exists rotas_func_idx    on public.rotas (funcionario_id, data);

create index if not exists pontos_func_data_idx on public.pontos (funcionario_id, criado_em);
create index if not exists pontos_data_idx      on public.pontos (criado_em);
create index if not exists pontos_servico_idx   on public.pontos (servico_id);
create index if not exists servicos_func_idx    on public.servicos (funcionario_id);
create index if not exists servicos_obra_idx    on public.servicos (obra_id);
create index if not exists relatorios_serv_idx  on public.relatorios (servico_id);

create or replace function public._tocar_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists orcamentos_atualizado_em on public.orcamentos;
create trigger orcamentos_atualizado_em before update on public.orcamentos
  for each row execute function public._tocar_atualizado_em();

drop trigger if exists medicoes_atualizado_em on public.medicoes;
create trigger medicoes_atualizado_em before update on public.medicoes
  for each row execute function public._tocar_atualizado_em();

-- ---------- Quem é administrador ----------

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.token_valido(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.funcionarios where token = p_token and ativo);
$$;

-- ---------- Regras de acesso (RLS) ----------

alter table public.admins enable row level security;
drop policy if exists admin_le on public.admins;
create policy admin_le on public.admins for select to authenticated using (public.eh_admin());

do $$
declare t text;
begin
  foreach t in array array['funcionarios', 'obras', 'servicos', 'pontos', 'relatorios', 'orcamentos', 'lojas', 'rotas',
                             'prefeituras', 'contratos', 'medicoes', 'licitacoes', 'documentos',
                             'veiculos', 'km_registros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_tudo on public.%I', t);
    execute format('create policy admin_tudo on public.%I for all to authenticated '
                   'using (public.eh_admin()) with check (public.eh_admin())', t);
  end loop;
end $$;

-- ---------- Funções do funcionário (acesso só pelo link) ----------

create or replace function public._func_por_token(p_token text) returns public.funcionarios
language plpgsql stable security definer set search_path = public as $$
declare f public.funcionarios;
begin
  select * into f from public.funcionarios where token = p_token and ativo;
  if not found then
    raise exception 'Link inválido ou desativado. Peça um novo link ao responsável.';
  end if;
  return f;
end $$;

create or replace function public.func_dados(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f        public.funcionarios;
  v_inicio timestamptz := ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
begin
  f := public._func_por_token(p_token);
  return jsonb_build_object(
    'funcionario', jsonb_build_object('nome', f.nome, 'area', f.area),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'categoria', s.categoria, 'descricao', s.descricao,
               'data_prevista', s.data_prevista, 'status', s.status, 'pede_assinatura', s.pede_assinatura,
               'cliente', o.cliente, 'telefone', o.telefone, 'endereco', o.endereco,
               'observacoes', o.observacoes,
               'prefeitura', pf.nome, 'protocolo', o.protocolo, 'secretaria', o.secretaria,
               'tipo_publico', o.tipo_publico, 'referencia', o.referencia, 'fiscal', o.fiscal,
               'contrato_id', o.contrato_id,
               'tem_fotos_antes', exists (select 1 from public.relatorios r
                                          where r.servico_id = s.id and cardinality(r.fotos_antes) > 0))
             order by s.data_prevista nulls last, s.criado_em)
      from public.servicos s join public.obras o on o.id = s.obra_id
      left join public.prefeituras pf on pf.id = o.prefeitura_id
      where s.funcionario_id = f.id and s.status in ('aberto', 'em_andamento')
    ), '[]'::jsonb),
    -- itens do contrato da prefeitura (sem preços) para o funcionário lançar as quantidades
    'itens_contrato', coalesce((
      select jsonb_object_agg(c.id, coalesce((
               select jsonb_agg(jsonb_build_object('codigo', e ->> 'codigo', 'descricao', e ->> 'descricao', 'un', e ->> 'un'))
               from jsonb_array_elements(c.itens) e), '[]'::jsonb))
      from public.contratos c
      where c.id in (select o.contrato_id from public.servicos s join public.obras o on o.id = s.obra_id
                     where s.funcionario_id = f.id and s.status in ('aberto', 'em_andamento'))
    ), '{}'::jsonb),
    'pontos_hoje', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', p.tipo, 'servico_id', p.servico_id, 'criado_em', p.criado_em,
               'tem_gps', p.lat is not null)
             order by p.criado_em)
      from public.pontos p
      where p.funcionario_id = f.id and p.criado_em >= v_inicio
    ), '[]'::jsonb),
    'rotas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'data', r.data, 'paradas', r.paradas, 'km', r.km)
             order by r.data nulls last, r.criado_em)
      from public.rotas r
      where r.funcionario_id = f.id
        and (r.data is null or r.data >= (now() at time zone 'America/Sao_Paulo')::date)
    ), '[]'::jsonb),
    'veiculos', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'placa', v.placa, 'modelo', v.modelo,
               'ultimo_km', (select k.km from public.km_registros k where k.veiculo_id = v.id order by k.criado_em desc limit 1))
             order by v.placa)
      from public.veiculos v where v.ativo
    ), '[]'::jsonb),
    'km_hoje', coalesce((
      select jsonb_agg(jsonb_build_object('veiculo_id', k.veiculo_id, 'tipo', k.tipo, 'km', k.km, 'criado_em', k.criado_em)
             order by k.criado_em)
      from public.km_registros k
      where k.funcionario_id = f.id and k.criado_em >= v_inicio
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.registrar_ponto(
  p_token        text,
  p_tipo         text,
  p_foto         text,
  p_servico_id   uuid             default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_precisao     double precision default null,
  p_capturado_em timestamptz      default null,
  p_observacao   text             default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f        public.funcionarios;
  v_id     uuid;
  v_quando timestamptz;
begin
  f := public._func_por_token(p_token);
  if p_tipo is null or p_tipo not in ('chegada', 'servico', 'saida') then
    raise exception 'Tipo de registro inválido.';
  end if;
  if p_foto is null or split_part(p_foto, '/', 1) <> p_token then
    raise exception 'A foto é obrigatória.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = p_foto) then
    raise exception 'A foto não chegou ao servidor. Tente de novo.';
  end if;
  if exists (select 1 from public.pontos where foto = p_foto) then
    raise exception 'Este registro já foi enviado.';
  end if;
  if p_servico_id is not null
     and not exists (select 1 from public.servicos where id = p_servico_id and funcionario_id = f.id) then
    raise exception 'Este serviço não está com você.';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or coalesce(p_lat not between -90 and 90, false)
     or coalesce(p_lng not between -180 and 180, false) then
    raise exception 'Localização inválida.';
  end if;

  insert into public.pontos (funcionario_id, servico_id, tipo, foto, lat, lng, precisao, capturado_em, observacao)
  values (f.id, p_servico_id, p_tipo, p_foto, p_lat, p_lng, p_precisao, p_capturado_em, left(nullif(trim(p_observacao), ''), 1000))
  returning id, criado_em into v_id, v_quando;

  if p_servico_id is not null and p_tipo in ('chegada', 'servico') then
    update public.servicos set status = 'em_andamento' where id = p_servico_id and status = 'aberto';
  end if;

  -- Chegada com GPS bom numa loja: melhora a localização da loja (para as rotas).
  -- Só troca se a loja não tem local, ou se o novo ponto está a menos de 3 km
  -- do atual (evita estragar com um serviço escolhido errado).
  if p_tipo = 'chegada' and p_servico_id is not null and p_lat is not null and coalesce(p_precisao, 999) <= 60 then
    update public.lojas l set lat = p_lat, lng = p_lng, geo_precisao = 'gps'
    from public.servicos s join public.obras o on o.id = s.obra_id
    where s.id = p_servico_id and l.id = o.loja_id
      and coalesce(l.geo_precisao, '') not in ('gps', 'manual')
      and (l.lat is null
           or 6371 * 2 * asin(sqrt(power(sin(radians(p_lat - l.lat) / 2), 2)
              + cos(radians(l.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - l.lng) / 2), 2))) < 3);
  end if;

  return jsonb_build_object('id', v_id, 'criado_em', v_quando);
end $$;

-- versões antigas: removidas para não ficar duas funções com o mesmo nome
drop function if exists public.enviar_relatorio(text, uuid, text, text, jsonb, text[], boolean);
drop function if exists public.enviar_relatorio(text, uuid, text, text, jsonb, text[], boolean, text, text);

create or replace function public.enviar_relatorio(
  p_token        text,
  p_servico_id   uuid,
  p_tipo_servico text,
  p_descricao    text,
  p_materiais    jsonb   default '[]'::jsonb,
  p_fotos        text[]  default '{}',
  p_concluido    boolean default false,
  p_assinatura   text    default null,
  p_assinado_por text    default null,
  p_fotos_antes  text[]  default '{}'
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f      public.funcionarios;
  v_id   uuid;
  v_pref boolean;
begin
  f := public._func_por_token(p_token);
  p_materiais := coalesce(p_materiais, '[]'::jsonb);
  p_fotos := coalesce(p_fotos, '{}');
  p_fotos_antes := coalesce(p_fotos_antes, '{}');
  if p_servico_id is null
     or not exists (select 1 from public.servicos where id = p_servico_id and funcionario_id = f.id) then
    raise exception 'Escolha um dos seus serviços.';
  end if;
  if coalesce(trim(p_tipo_servico), '') = '' and coalesce(trim(p_descricao), '') = '' then
    raise exception 'Descreva o serviço.';
  end if;
  if jsonb_typeof(p_materiais) <> 'array' or jsonb_array_length(p_materiais) > 200 then
    raise exception 'Lista de materiais inválida.';
  end if;
  if coalesce(array_length(p_fotos, 1), 0) > 10
     or exists (select 1 from unnest(p_fotos) x where split_part(x, '/', 1) <> p_token) then
    raise exception 'Fotos inválidas.';
  end if;
  if coalesce(array_length(p_fotos_antes, 1), 0) > 10
     or exists (select 1 from unnest(p_fotos_antes) x where split_part(x, '/', 1) <> p_token) then
    raise exception 'Fotos inválidas.';
  end if;
  -- OS de prefeitura: para concluir precisa das fotos de ANTES e de DEPOIS
  select o.prefeitura_id is not null into v_pref
  from public.servicos s join public.obras o on o.id = s.obra_id where s.id = p_servico_id;
  if coalesce(p_concluido, false) and v_pref then
    if cardinality(p_fotos_antes) = 0
       and not exists (select 1 from public.relatorios r where r.servico_id = p_servico_id and cardinality(r.fotos_antes) > 0) then
      raise exception 'OS da prefeitura: falta a foto de ANTES do serviço.';
    end if;
    if cardinality(p_fotos) = 0 then
      raise exception 'OS da prefeitura: falta a foto de DEPOIS (serviço pronto).';
    end if;
  end if;
  p_assinatura := nullif(trim(coalesce(p_assinatura, '')), '');
  if p_assinatura is not null then
    if split_part(p_assinatura, '/', 1) <> p_token
       or not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = p_assinatura) then
      raise exception 'A assinatura não chegou ao servidor. Tente de novo.';
    end if;
    if coalesce(trim(p_assinado_por), '') = '' then
      raise exception 'Escreva o nome de quem assinou.';
    end if;
  end if;

  insert into public.relatorios (servico_id, funcionario_id, tipo_servico, descricao, materiais, fotos, fotos_antes, concluido,
                                 assinatura, assinado_por, assinado_em)
  values (p_servico_id, f.id, left(trim(p_tipo_servico), 200), left(trim(p_descricao), 5000),
          p_materiais, p_fotos, p_fotos_antes, coalesce(p_concluido, false),
          p_assinatura, case when p_assinatura is not null then left(trim(p_assinado_por), 120) end,
          case when p_assinatura is not null then now() end)
  returning id into v_id;

  if coalesce(p_concluido, false) then
    update public.servicos set status = 'concluido', concluido_em = now()
    where id = p_servico_id and status <> 'cancelado';
  else
    update public.servicos set status = 'em_andamento' where id = p_servico_id and status = 'aberto';
  end if;

  return jsonb_build_object('id', v_id);
end $$;

-- Serviço que não estava cadastrado: o funcionário cria pelo app (fica marcado
-- "criado pela equipe" no painel). Se ele informar o nº de uma loja da rede, o
-- serviço já fica ligado à loja, com o endereço dela.
create or replace function public.criar_servico_func(
  p_token       text,
  p_categoria   text,
  p_descricao   text,
  p_cliente     text default null,
  p_endereco    text default null,
  p_loja_codigo text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f       public.funcionarios;
  l       public.lojas;
  v_cod   text := nullif(ltrim(trim(coalesce(p_loja_codigo, '')), '0'), '');
  v_cli   text;
  v_end   text;
  v_obra  uuid;
  v_serv  uuid;
begin
  f := public._func_por_token(p_token);
  if p_categoria is null or p_categoria not in ('eletrica', 'pintura') then
    raise exception 'Escolha elétrica ou pintura.';
  end if;
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Escreva o que vai ser feito.';
  end if;
  if v_cod is not null then
    select * into l from public.lojas where codigo = v_cod and ativo order by (tipo = 'loja') desc limit 1;
    if not found then
      raise exception 'Loja % não encontrada. Confira o número ou escreva o nome do cliente.', v_cod;
    end if;
  end if;
  v_cli := coalesce(nullif(trim(p_cliente), ''),
                    case when l.id is not null then
                      case when l.tipo = 'loja' then 'Loja ' || l.codigo || ' – ' || l.nome else l.codigo || ' – ' || l.nome end
                    end);
  if v_cli is null then
    raise exception 'Informe o cliente ou o número da loja.';
  end if;
  v_end := coalesce(nullif(trim(p_endereco), ''),
                    case when l.id is not null then
                      concat_ws(' - ', nullif(concat_ws(', ', l.endereco, l.numero), ''), l.bairro, l.cidade || coalesce('/' || l.uf, ''))
                    end);

  insert into public.obras (cliente, endereco, observacoes, loja_id)
  values (left(v_cli, 200), left(v_end, 300), 'Criado por ' || f.nome || ' pelo app', l.id)
  returning id into v_obra;

  insert into public.servicos (obra_id, categoria, funcionario_id, descricao, data_prevista, status, criado_pelo_funcionario)
  values (v_obra, p_categoria, f.id, left(trim(p_descricao), 2000),
          (now() at time zone 'America/Sao_Paulo')::date, 'em_andamento', true)
  returning id into v_serv;

  return jsonb_build_object('id', v_serv);
end $$;

-- KM do veículo (início ou fim do uso), com foto do painel
create or replace function public.registrar_km(
  p_token        text,
  p_veiculo_id   uuid,
  p_tipo         text,
  p_km           integer,
  p_foto         text,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_precisao     double precision default null,
  p_capturado_em timestamptz      default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  f        public.funcionarios;
  v_id     uuid;
  v_quando timestamptz;
  v_ini    integer;
  v_inicio timestamptz := ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
begin
  f := public._func_por_token(p_token);
  if p_tipo is null or p_tipo not in ('inicio', 'fim') then
    raise exception 'Escolha início ou fim do uso.';
  end if;
  if p_veiculo_id is null or not exists (select 1 from public.veiculos where id = p_veiculo_id and ativo) then
    raise exception 'Escolha o veículo.';
  end if;
  if p_km is null or p_km < 0 or p_km > 9999999 then
    raise exception 'KM inválido.';
  end if;
  if p_foto is null or split_part(p_foto, '/', 1) <> p_token
     or not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = p_foto) then
    raise exception 'A foto do painel não chegou ao servidor. Tente de novo.';
  end if;
  if exists (select 1 from public.km_registros where foto = p_foto) then
    raise exception 'Este registro já foi enviado.';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or coalesce(p_lat not between -90 and 90, false)
     or coalesce(p_lng not between -180 and 180, false) then
    raise exception 'Localização inválida.';
  end if;
  if p_tipo = 'fim' then
    select km into v_ini from public.km_registros
    where veiculo_id = p_veiculo_id and funcionario_id = f.id and tipo = 'inicio' and criado_em >= v_inicio
    order by criado_em desc limit 1;
    if v_ini is not null and p_km < v_ini then
      raise exception 'O KM final (%) é menor que o KM do início (%). Confira o painel.', p_km, v_ini;
    end if;
  end if;

  insert into public.km_registros (veiculo_id, funcionario_id, tipo, km, foto, lat, lng, precisao, capturado_em)
  values (p_veiculo_id, f.id, p_tipo, p_km, p_foto, p_lat, p_lng, p_precisao, p_capturado_em)
  returning id, criado_em into v_id, v_quando;
  return jsonb_build_object('id', v_id, 'criado_em', v_quando);
end $$;

revoke execute on function public._func_por_token(text) from public, anon, authenticated;
revoke execute on function public._tocar_atualizado_em() from public, anon, authenticated;
grant execute on function public.eh_admin() to anon, authenticated;
grant execute on function public.token_valido(text) to anon, authenticated;
grant execute on function public.func_dados(text) to anon, authenticated;
grant execute on function public.registrar_ponto(text, text, text, uuid, double precision, double precision,
                                                double precision, timestamptz, text) to anon, authenticated;
grant execute on function public.enviar_relatorio(text, uuid, text, text, jsonb, text[], boolean, text, text, text[]) to anon, authenticated;
grant execute on function public.criar_servico_func(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.registrar_km(text, uuid, text, integer, text, double precision, double precision,
                                             double precision, timestamptz) to anon, authenticated;

-- ---------- Fotos (Storage) ----------
-- Pasta privada "fotos". O funcionário só consegue ENVIAR fotos para a
-- pasta do próprio link; não consegue ver, trocar nem apagar nenhuma.
-- Só você (admin) vê as fotos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists age_fotos_func_envia on storage.objects;
create policy age_fotos_func_envia on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fotos' and public.token_valido((storage.foldername(name))[1]));

drop policy if exists age_fotos_admin_le on storage.objects;
create policy age_fotos_admin_le on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.eh_admin());

drop policy if exists age_fotos_admin_apaga on storage.objects;
create policy age_fotos_admin_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.eh_admin());

-- ---------- Seu acesso de administrador ----------
-- Troque o e-mail abaixo pelo e-mail do usuário que você criou em
-- Authentication > Users, tire os dois traços do começo e rode só esta linha:
--
-- insert into public.admins (email) values ('seu-email@exemplo.com') on conflict do nothing;
