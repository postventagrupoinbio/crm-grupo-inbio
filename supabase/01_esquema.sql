-- =====================================================================
--  INBIO CRM · Esquema de base de datos para Supabase (PostgreSQL)
--  Pegar completo en: Supabase → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Zonas ----------------------------------------------------
create table if not exists public.zonas (
  id     smallint primary key,
  nombre text not null unique,
  orden  smallint not null
);
insert into public.zonas (id, nombre, orden) values
  (1,'Zona 1',1),(2,'Zona 2',2),(3,'Zona 3',3),(4,'Zona 4',4),(5,'Zona 5',5),(6,'Laboratorio',6)
on conflict (id) do nothing;

-- ---------- Usuarios (perfil + zonas asignadas) -----------------------
create table if not exists public.perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  email   text,
  nombre  text,
  rol     text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);
create table if not exists public.perfil_zonas (
  user_id uuid     not null references public.perfiles(id) on delete cascade,
  zona_id smallint not null references public.zonas(id)    on delete cascade,
  primary key (user_id, zona_id)
);

-- El primer usuario que se crea queda como ADMIN; los siguientes como vendedor.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
          case when exists (select 1 from public.perfiles) then 'vendedor' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- Funciones de permiso --------------------------------------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo)
$$;
create or replace function public.usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;
create or replace function public.puede_zona(z smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from public.perfil_zonas pz join public.perfiles p on p.id = pz.user_id
    where pz.user_id = auth.uid() and pz.zona_id = z and p.activo)
$$;

-- ---------- Catálogos editables (marcas, líneas, productos, áreas) ----
create table if not exists public.catalogo (
  id     bigint generated always as identity primary key,
  tipo   text not null check (tipo in ('marca','linea','producto','area')),
  valor  text not null,
  marca  text,            -- solo para productos
  linea  text,            -- solo para productos
  unique (tipo, valor)
);

-- ---------- Clientes ---------------------------------------------------
create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  zona_id    smallint not null references public.zonas(id),
  nombre     text not null,
  mercado    text check (mercado in ('PUBLICO','PRIVADO')),
  direccion  text,
  provincia  text,
  ciudad     text,
  contacto   text,
  area       text,
  telefono   text,
  email      text,
  categoria  text check (categoria in ('A','B','C','D')),   -- A=12 visitas/año, B=6, C=2, D=sin seguimiento
  proxima_visita date,        -- fecha de próxima visita fijada a mano (vacía = se calcula según la categoría)
  notas      text,
  creado     timestamptz not null default now(),
  creado_por uuid default auth.uid()
);
create unique index if not exists clientes_zona_nombre_uq on public.clientes (zona_id, lower(btrim(nombre)));
create index if not exists clientes_zona_idx on public.clientes (zona_id);

-- ---------- Visitas ----------------------------------------------------
create table if not exists public.visitas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  zona_id       smallint not null references public.zonas(id),   -- se completa sola desde el cliente
  fecha         date not null,
  tipo          text check (tipo in ('Presencial','Telefónica','Mail','Videollamada')),
  detalle       text,                -- lo que se habló
  proximo_paso  text,
  creado        timestamptz not null default now(),
  editado       timestamptz,
  creado_por    uuid default auth.uid()
);
create index if not exists visitas_cliente_idx on public.visitas (cliente_id, fecha desc);
create index if not exists visitas_zona_idx on public.visitas (zona_id);

-- ---------- Oportunidades (la hoja OPORTUNIDADES del Excel) -----------
create table if not exists public.oportunidades (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete restrict,
  zona_id        smallint not null references public.zonas(id),  -- se completa sola desde el cliente
  fecha          date default current_date,   -- puede quedar vacía (filas viejas del Excel sin fecha)
  canal          text check (canal in ('Directo','Indirecto')),
  nro_cotizacion text,
  mercado        text check (mercado in ('PUBLICO','PRIVADO')),
  anio_probable  smallint,
  trimestre      text check (trimestre in ('Q1','Q2','Q3','Q4')),
  probabilidad   smallint check (probabilidad between 0 and 100),
  marca          text,
  linea          text,
  producto       text,
  info_extra     text,
  cantidad       numeric(12,2),
  monto          numeric(14,2),
  estado         text not null default 'Lead'
                 check (estado in ('Lead','A presupuestar','Presupuestado','Vendido','Perdido','Desestimado','Reemplazado','Sin avance')),
  detalle        text,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),
  creado_por     uuid default auth.uid()
);
create index if not exists opp_zona_estado_idx on public.oportunidades (zona_id, estado);
create index if not exists opp_cliente_idx     on public.oportunidades (cliente_id);

-- ---------- Triggers ---------------------------------------------------
-- La zona de una visita/oportunidad siempre es la de su cliente.
create or replace function public.zona_desde_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select c.zona_id into new.zona_id from public.clientes c where c.id = new.cliente_id;
  if new.zona_id is null then raise exception 'Cliente inexistente'; end if;
  return new;
end $$;
drop trigger if exists opp_zona on public.oportunidades;
create trigger opp_zona before insert or update of cliente_id on public.oportunidades
  for each row execute function public.zona_desde_cliente();
drop trigger if exists vis_zona on public.visitas;
create trigger vis_zona before insert or update of cliente_id on public.visitas
  for each row execute function public.zona_desde_cliente();

-- Si un cliente cambia de zona, arrastra sus visitas y oportunidades.
create or replace function public.cliente_cambia_zona() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.zona_id is distinct from old.zona_id then
    update public.oportunidades set zona_id = new.zona_id where cliente_id = new.id;
    update public.visitas       set zona_id = new.zona_id where cliente_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists cli_zona on public.clientes;
create trigger cli_zona after update of zona_id on public.clientes
  for each row execute function public.cliente_cambia_zona();

create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$ begin new.actualizado := now(); return new; end $$;
drop trigger if exists opp_upd on public.oportunidades;
create trigger opp_upd before update on public.oportunidades
  for each row execute function public.tocar_actualizado();

-- ---------- Vista de seguimiento de visitas ---------------------------
create or replace view public.v_seguimiento with (security_invoker = true) as
select c.id as cliente_id,
       count(v.id)  as visitas,
       max(v.fecha) as ultima_visita,
       c.proxima_visita as proxima_manual
from public.clientes c
left join public.visitas v on v.cliente_id = c.id
group by c.id, c.proxima_visita;

-- ---------- Seguridad (RLS) -------------------------------------------
alter table public.zonas          enable row level security;
alter table public.perfiles       enable row level security;
alter table public.perfil_zonas   enable row level security;
alter table public.catalogo       enable row level security;
alter table public.clientes       enable row level security;
alter table public.visitas        enable row level security;
alter table public.oportunidades  enable row level security;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in
             ('zonas','perfiles','perfil_zonas','catalogo','clientes','visitas','oportunidades')
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;

create policy zonas_ver on public.zonas for select to authenticated using (true);

create policy perfiles_ver  on public.perfiles for select to authenticated using (id = auth.uid() or public.es_admin());
create policy perfiles_mod  on public.perfiles for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy perfiles_baja on public.perfiles for delete to authenticated using (public.es_admin() and id <> auth.uid());

create policy pz_ver on public.perfil_zonas for select to authenticated using (user_id = auth.uid() or public.es_admin());
create policy pz_ins on public.perfil_zonas for insert to authenticated with check (public.es_admin());
create policy pz_del on public.perfil_zonas for delete to authenticated using (public.es_admin());

create policy cat_ver on public.catalogo for select to authenticated using (public.usuario_activo());
create policy cat_ins on public.catalogo for insert to authenticated with check (public.usuario_activo());
create policy cat_upd on public.catalogo for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy cat_del on public.catalogo for delete to authenticated using (public.es_admin());

create policy cli_ver on public.clientes for select to authenticated using (public.puede_zona(zona_id));
create policy cli_ins on public.clientes for insert to authenticated with check (public.puede_zona(zona_id));
create policy cli_upd on public.clientes for update to authenticated using (public.puede_zona(zona_id)) with check (public.puede_zona(zona_id));
create policy cli_del on public.clientes for delete to authenticated using (public.es_admin());

create policy vis_ver on public.visitas for select to authenticated using (public.puede_zona(zona_id));
create policy vis_ins on public.visitas for insert to authenticated with check (public.puede_zona(zona_id));
create policy vis_upd on public.visitas for update to authenticated using (public.puede_zona(zona_id)) with check (public.puede_zona(zona_id));
create policy vis_del on public.visitas for delete to authenticated using (public.puede_zona(zona_id));

create policy opp_ver on public.oportunidades for select to authenticated using (public.puede_zona(zona_id));
create policy opp_ins on public.oportunidades for insert to authenticated with check (public.puede_zona(zona_id));
create policy opp_upd on public.oportunidades for update to authenticated using (public.puede_zona(zona_id)) with check (public.puede_zona(zona_id));
create policy opp_del on public.oportunidades for delete to authenticated using (public.puede_zona(zona_id));

-- ---------- Permisos de tablas ----------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- Datos fijos: líneas de producto ---------------------------
insert into public.catalogo (tipo, valor) values
  ('linea','Anestesia'),('linea','Cardiologia'),('linea','Cirugia'),('linea','Desfibrilacion'),
  ('linea','Esterilizacion'),('linea','Heridas'),('linea','Iluminacion'),('linea','Infusion'),
  ('linea','Laboratorio'),('linea','Mobiliario'),('linea','Monitoreo'),('linea','Neo'),
  ('linea','Odontologia'),('linea','Otros'),('linea','Pesaje'),('linea','RX'),
  ('linea','Ultrasonido'),('linea','Ventilacion')
on conflict (tipo, valor) do nothing;
