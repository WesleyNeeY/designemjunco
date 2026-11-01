export function goalRange(date:string,type:'week'|'month'){
 const d=new Date(date+'T12:00:00Z');
 if(type==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+5)%7);else d.setUTCDate(1);
 const start=d.toISOString().slice(0,10);
 if(type==='week')d.setUTCDate(d.getUTCDate()+6);else {d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0)}
 return {start,end:d.toISOString().slice(0,10)};
}
export function goalResult(sales:any[],store:string,start:string,end:string,target:number){
 const sold=sales.filter(s=>s.store===store&&s.date>=start&&s.date<=end).reduce((n,s)=>n+Number(s.cents),0);
 return {sold,remaining:Math.max(0,target-sold),progress:target?Math.min(100,sold/target*100):0};
}
