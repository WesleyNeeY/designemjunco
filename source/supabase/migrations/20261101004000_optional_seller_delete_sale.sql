alter table public.sales add column deleted_at timestamptz;
create or replace function public.dj_save_sellers(p_store text,p_names text[]) returns void language plpgsql security definer set search_path='' as $$
declare clean text[];
begin
 if not coalesce(public.dj_is_admin() or p_store=public.dj_my_store(),false) then raise exception 'Acesso não autorizado';end if;
 select array_agg(trim(n) order by ord) into clean from unnest(p_names) with ordinality as x(n,ord) where nullif(trim(n),'') is not null;
 if coalesce(cardinality(p_names),0)>2 or coalesce(cardinality(clean),0) not between 1 and 2 or exists(select 1 from unnest(clean) n where length(n)>60) then raise exception 'Preencha um ou dois nomes, com até 60 caracteres';end if;
 if cardinality(clean)=2 and lower(clean[1])=lower(clean[2]) then raise exception 'Use nomes diferentes';end if;
 delete from public.sellers where store=p_store;
 insert into public.sellers(store,slot,name) select p_store,ord::integer,n from unnest(clean) with ordinality as x(n,ord);
end;
$$;
create function public.dj_delete_sale(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.sales set deleted_at=now() where id=p_id and deleted_at is null and (public.dj_is_admin() or store=public.dj_my_store());
 if not found then raise exception 'Lançamento não encontrado ou acesso não autorizado';end if;
end;
$$;
revoke execute on function public.dj_delete_sale(uuid) from public,anon;
grant execute on function public.dj_delete_sale(uuid) to authenticated;
