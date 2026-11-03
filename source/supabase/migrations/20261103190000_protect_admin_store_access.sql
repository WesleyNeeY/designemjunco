-- Impede que o e-mail de um administrador seja vinculado a uma loja,
-- o que rebaixaria a conta para "loja" e tiraria o acesso às quatro unidades.
create or replace function public.dj_set_store_access(p_store text,p_email text) returns void language plpgsql security definer set search_path='' as $$
 declare cleaned text:=lower(trim(coalesce(p_email,'')));
 begin
 if not public.dj_is_admin() then raise exception 'Somente administrador';end if;
 if not exists(select 1 from public.stores where name=p_store) then raise exception 'Loja inválida';end if;
 if cleaned<>'' and cleaned !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'E-mail inválido';end if;
 if exists(select 1 from public.access_grants where email=cleaned and (role='admin' or store<>p_store)) then raise exception 'E-mail já vinculado a outro acesso';end if;
 if exists(select 1 from public.memberships where role='admin' and lower(email)=cleaned)
  or exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.role='admin' and lower(u.email)=cleaned)
 then raise exception 'Esse e-mail é de um administrador. Use outro e-mail para a loja.';end if;
 delete from public.memberships where store=p_store and role='store';
 delete from public.access_grants where store=p_store and role='store';
 if cleaned<>'' then
 insert into public.access_grants(email,role,store) values(cleaned,'store',p_store);
 insert into public.memberships(user_id,email,role,store) select id,cleaned,'store',p_store from auth.users where lower(email)=cleaned on conflict(user_id) do update set email=excluded.email,role=excluded.role,store=excluded.store;
 end if;
 end;
$$;
