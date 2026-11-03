import {createClient} from '@supabase/supabase-js';
// Publishable browser key. Access to every record is enforced by database RLS.
export const supabase=createClient('https://rhvhnhnkmsahemhrjgki.supabase.co','sb_publishable_WR4wWNqL_EkXZ6FWUcVgnQ_3kwY2_nL');

// Cache das vendas já baixadas. Depois da primeira carga completa, cada atualização
// busca só o que foi lançado ou excluído desde a última sincronização.
const OVERLAP=5*60*1000; // margem de segurança para não perder lançamentos simultâneos
const FULL_EVERY=30*60*1000; // recarga completa periódica, para corrigir qualquer divergência
let cache:{user:string;sales:Map<string,any>;created:number;deleted:number;full:number}|null=null;

const iso=(t:number)=>new Date(t-OVERLAP).toISOString();
const time=(v:string|null|undefined)=>v?Date.parse(v)||0:0;
async function paged(build:(from:number,to:number)=>any){
 const rows:any[]=[];let offset=0;
 while(true){const r=await build(offset,offset+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)break;offset+=1000;}
 return rows;
}
const order=(q:any)=>q.order('date',{ascending:false}).order('created',{ascending:false}).order('id');

async function syncSales(user:string,force:boolean){
 const now=Date.now();
 if(force||!cache||cache.user!==user||now-cache.full>FULL_EVERY){
  const rows=await paged((a,b)=>order(supabase.from('sales').select('*').is('deleted_at',null)).range(a,b));
  const last=await supabase.from('sales').select('deleted_at').not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(1);
  if(last.error)throw last.error;
  cache={user,sales:new Map(rows.map(r=>[r.id,r])),created:Math.max(0,...rows.map(r=>time(r.created))),deleted:time(last.data[0]?.deleted_at),full:now};
 }else{
  const c=cache;
  const added=await paged((a,b)=>{let q=supabase.from('sales').select('*').is('deleted_at',null);if(c.created)q=q.gte('created',iso(c.created));return order(q).range(a,b)});
  const removed=await paged((a,b)=>{let q=supabase.from('sales').select('id,deleted_at').not('deleted_at','is',null);if(c.deleted)q=q.gte('deleted_at',iso(c.deleted));return q.order('id').range(a,b)});
  for(const r of added){c.sales.set(r.id,r);c.created=Math.max(c.created,time(r.created));}
  for(const r of removed){c.sales.delete(r.id);c.deleted=Math.max(c.deleted,time(r.deleted_at));}
 }
 return [...cache!.sales.values()].sort((x,y)=>y.date.localeCompare(x.date)||y.created.localeCompare(x.created)||x.id.localeCompare(y.id));
}

export async function readDashboard(force=false){
 const {data:{session}}=await supabase.auth.getSession();if(!session){cache=null;return null;}
 const member=await supabase.from('memberships').select('*').eq('user_id',session.user.id).maybeSingle();if(member.error)throw member.error;if(!member.data)throw Error('Seu e-mail ainda não foi liberado. Peça ao administrador para vincular seu acesso.');
 const sales=await syncSales(session.user.id,force);
 const sellers=await supabase.from('sellers').select('*').order('slot');if(sellers.error)throw sellers.error;
 const config:Record<string,string>={};for(const row of sellers.data){const key='sellers:'+row.store;const names=JSON.parse(config[key]||'[]');names[row.slot-1]=row.name;config[key]=JSON.stringify(names);}
 if(member.data.role==='admin'){const grants=await supabase.from('access_grants').select('email,store');if(grants.error)throw grants.error;for(const row of grants.data)if(row.store)config['email:'+row.store]=row.email;}
 const goals=await paged((a,b)=>supabase.from('sales_goals').select('*').order('period_start',{ascending:false}).order('store').order('period_type').range(a,b));
 return {goals,admin:member.data.role==='admin',store:member.data.store,email:session.user.email,sales,config};
}

// Converte erros técnicos (banco, rede) em mensagens claras em português.
export function friendlyError(e:any):string{
 const m=String(e?.message||e||'');
 if(/failed to fetch|network|load failed|fetch failed/i.test(m))return 'Sem conexão com a internet. Confira a rede e tente novamente.';
 if(/sales_cents_check/i.test(m))return 'Informe um valor maior que zero e de até R$ 10.000.000,00.';
 if(/sales_goals_cents_check/i.test(m))return 'Informe uma meta maior que zero, até R$ 1 bilhão.';
 if(/check constraint|violates|invalid input syntax/i.test(m))return 'Algum dado não foi aceito. Confira os campos e tente novamente.';
 if(/JWT|not authenticated|permission denied/i.test(m))return 'Sua sessão expirou ou não tem permissão. Saia e entre novamente.';
 return m||'Não foi possível concluir. Tente novamente.';
}

export async function writeDashboard(body:any){
 let result;
 if(body.action==='sellers')result=await supabase.rpc('dj_save_sellers',{p_store:body.store,p_names:body.names});
 else if(body.action==='access')result=await supabase.rpc('dj_set_store_access',{p_store:body.store,p_email:body.email});
 else if(body.action==='delete')result=await supabase.rpc('dj_delete_sale',{p_id:body.id});
 else if(body.action==='sale')result=await supabase.rpc('dj_save_sale',{p_id:body.id,p_store:body.store,p_seller:body.seller,p_date:body.date,p_cents:body.cents});
 else throw Error('Ação inválida.');
 if(result.error)throw Error(friendlyError(result.error));
}
