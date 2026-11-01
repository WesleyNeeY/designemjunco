create table public.sales_goals (
 store text not null references public.stores(name),
 period_type text not null check (period_type in ('week','month')),
 period_start date not null,
 cents bigint not null check (cents > 0 and cents <= 100000000000),
 primary key(store,period_type,period_start),
 check ((period_type='week' and extract(isodow from period_start)=2) or (period_type='month' and extract(day from period_start)=1))
);
alter table public.sales_goals enable row level security;
revoke all on public.sales_goals from public,anon,authenticated;
grant select,insert,update on public.sales_goals to authenticated;
create policy goals_read on public.sales_goals for select to authenticated using ((select public.dj_is_admin()) or store=(select public.dj_my_store()));
create policy goals_insert on public.sales_goals for insert to authenticated with check ((select public.dj_is_admin()));
create policy goals_update on public.sales_goals for update to authenticated using ((select public.dj_is_admin())) with check ((select public.dj_is_admin()));
