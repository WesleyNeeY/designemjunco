create table public.stores (name text primary key);
create table public.access_grants (
 email text primary key check(email=lower(trim(email))),
 role text not null check(role in ('admin','store')),
 store text unique references public.stores(name),
 check((role='admin' and store is null) or (role='store' and store is not null))
);
create table public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null check(role in ('admin','store')),
 store text references public.stores(name),
 check((role='admin' and store is null) or (role='store' and store is not null))
);
create table public.sellers (
 store text not null references public.stores(name),
 slot integer not null check(slot in (1,2)),
 name text not null check(length(trim(name)) between 1 and 60),
 primary key(store,slot), unique(store,name)
);
create table public.sales (
 id uuid primary key,
 store text not null references public.stores(name),
 seller text not null check(length(trim(seller)) between 1 and 60),
 date date not null,
 cents bigint not null check(cents>0 and cents<=1000000000),
 author uuid not null references auth.users(id),
 created timestamptz not null default now()
);
create index sales_store_date on public.sales(store,date desc);
create index sales_author on public.sales(author);
create index memberships_store on public.memberships(store);
alter table public.stores enable row level security;
alter table public.access_grants enable row level security;
alter table public.memberships enable row level security;
alter table public.sellers enable row level security;
alter table public.sales enable row level security;

create function public.dj_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where user_id=(select auth.uid()) and role='admin');
$$;
create function public.dj_my_store() returns text language sql stable security definer set search_path='' as $$
 select store from public.memberships where user_id=(select auth.uid());
$$;
create policy membership_read on public.memberships for select to authenticated using(user_id=(select auth.uid()) or (select public.dj_is_admin()));
create policy stores_read on public.stores for select to authenticated using((select public.dj_is_admin()) or name=(select public.dj_my_store()));
create policy grants_read on public.access_grants for select to authenticated using((select public.dj_is_admin()));
create policy sellers_read on public.sellers for select to authenticated using((select public.dj_is_admin()) or store=(select public.dj_my_store()));
create policy sales_read on public.sales for select to authenticated using((select public.dj_is_admin()) or store=(select public.dj_my_store()));

create function public.dj_register_member() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.memberships(user_id,email,role,store)
 select new.id,lower(new.email),g.role,g.store from public.access_grants g where g.email=lower(new.email)
 on conflict(user_id) do nothing;
 return new;
 end;
$$;
create trigger dj_auth_signup after insert on auth.users for each row execute function public.dj_register_member();

create function public.dj_save_sellers(p_store text,p_names text[]) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not coalesce(public.dj_is_admin() or p_store=public.dj_my_store(),false) then raise exception 'Acesso não autorizado';end if;
 if cardinality(p_names) is distinct from 2 or p_names[1] is null or p_names[2] is null or length(trim(p_names[1])) not between 1 and 60 or length(trim(p_names[2])) not between 1 and 60 or lower(trim(p_names[1]))=lower(trim(p_names[2])) then raise exception 'Preencha dois nomes diferentes';end if;
 delete from public.sellers where store=p_store;
 insert into public.sellers(store,slot,name) values(p_store,1,trim(p_names[1])),(p_store,2,trim(p_names[2]));
 end;
$$;
create function public.dj_save_sale(p_id uuid,p_store text,p_seller text,p_date date,p_cents bigint) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not coalesce(public.dj_is_admin() or p_store=public.dj_my_store(),false) then raise exception 'Acesso não autorizado';end if;
 if not exists(select 1 from public.sellers where store=p_store and name=p_seller) then raise exception 'Vendedor inválido';end if;
 insert into public.sales(id,store,seller,date,cents,author) values(p_id,p_store,p_seller,p_date,p_cents,auth.uid()) on conflict(id) do nothing;
 end;
$$;
create function public.dj_set_store_access(p_store text,p_email text) returns void language plpgsql security definer set search_path='' as $$
 declare cleaned text:=lower(trim(coalesce(p_email,'')));
 begin
 if not public.dj_is_admin() then raise exception 'Somente administrador';end if;
 if not exists(select 1 from public.stores where name=p_store) then raise exception 'Loja inválida';end if;
 if cleaned<>'' and cleaned !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'E-mail inválido';end if;
 if exists(select 1 from public.access_grants where email=cleaned and (role='admin' or store<>p_store)) then raise exception 'E-mail já vinculado a outro acesso';end if;
 delete from public.memberships where store=p_store and role='store';
 delete from public.access_grants where store=p_store and role='store';
 if cleaned<>'' then
 insert into public.access_grants(email,role,store) values(cleaned,'store',p_store);
 insert into public.memberships(user_id,email,role,store) select id,cleaned,'store',p_store from auth.users where lower(email)=cleaned on conflict(user_id) do update set email=excluded.email,role=excluded.role,store=excluded.store;
 end if;
 end;
$$;
revoke all on public.stores,public.access_grants,public.memberships,public.sellers,public.sales from anon,authenticated;
grant select on public.stores,public.access_grants,public.memberships,public.sellers,public.sales to authenticated;
revoke execute on function public.dj_is_admin(),public.dj_my_store(),public.dj_register_member(),public.dj_save_sellers(text,text[]),public.dj_save_sale(uuid,text,text,date,bigint),public.dj_set_store_access(text,text) from public,anon;
grant execute on function public.dj_is_admin(),public.dj_my_store(),public.dj_save_sellers(text,text[]),public.dj_save_sale(uuid,text,text,date,bigint),public.dj_set_store_access(text,text) to authenticated;
