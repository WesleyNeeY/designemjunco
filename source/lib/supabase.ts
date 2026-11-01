import {createClient} from '@supabase/supabase-js';
// Publishable browser key. Access to every record is enforced by database RLS.
export const supabase=createClient('https://rhvhnhnkmsahemhrjgki.supabase.co','sb_publishable_WR4wWNqL_EkXZ6FWUcVgnQ_3kwY2_nL');
export async function readDashboard(){
 const {data:{session}}=await supabase.auth.getSession();if(!session)return null;
 const member=await supabase.from('memberships').select('*').eq('user_id',session.user.id).maybeSingle();if(member.error)throw member.error;if(!member.data)throw Error('Seu e-mail ainda não foi liberado. Peça ao administrador para vincular seu acesso.');
 const sales:any[]=[];let offset=0;
 while(true){const r=await supabase.from('sales').select('*').is('deleted_at',null).order('date',{ascending:false}).order('created',{ascending:false}).order('id').range(offset,offset+999);if(r.error)throw r.error;sales.push(...r.data);if(r.data.length<1000)break;offset+=1000;}
 const sellers=await supabase.from('sellers').select('*').order('slot');if(sellers.error)throw sellers.error;
 const config:Record<string,string>={};for(const row of sellers.data){const key='sellers:'+row.store;const names=JSON.parse(config[key]||'[]');names[row.slot-1]=row.name;config[key]=JSON.stringify(names);}
 if(member.data.role==='admin'){const grants=await supabase.from('access_grants').select('email,store');if(grants.error)throw grants.error;for(const row of grants.data)if(row.store)config['email:'+row.store]=row.email;}
 const goals:any[]=[];let goalOffset=0;while(true){const r=await supabase.from('sales_goals').select('*').order('period_start',{ascending:false}).order('store').order('period_type').range(goalOffset,goalOffset+999);if(r.error)throw r.error;goals.push(...r.data);if(r.data.length<1000)break;goalOffset+=1000;}
 return {goals,admin:member.data.role==='admin',store:member.data.store,email:session.user.email,sales,config};
}
export async function writeDashboard(body:any){
 let result;
 if(body.action==='sellers')result=await supabase.rpc('dj_save_sellers',{p_store:body.store,p_names:body.names});
 else if(body.action==='access')result=await supabase.rpc('dj_set_store_access',{p_store:body.store,p_email:body.email});
 else if(body.action==='delete')result=await supabase.rpc('dj_delete_sale',{p_id:body.id});
 else if(body.action==='sale')result=await supabase.rpc('dj_save_sale',{p_id:body.id,p_store:body.store,p_seller:body.seller,p_date:body.date,p_cents:body.cents});
 else throw Error('Ação inválida.');
 if(result.error)throw result.error;
}

