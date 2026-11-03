import {useEffect,useState} from 'react';
import {supabase,friendlyError} from '../lib/supabase';
import {goalRange,goalResult} from './goals';
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export default function Goals({data,store,date,reload}:any){
 const [edit,setEdit]=useState(false),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const range=goalRange(date,'month');
 const goal=data.goals?.find((g:any)=>g.store===store&&g.period_type==='month'&&g.period_start===range.start);
 const target=Number(goal?.cents||0),result=goalResult(data.sales,store,range.start,range.end,target);
 const month=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(range.start+'T12:00:00Z'));
 useEffect(()=>{setValue(goal?String(Number(goal.cents)/100).replace('.',','):'');setMessage('')},[store,range.start,edit]);
 async function save(e:any){e.preventDefault();setMessage('');if(!/^\d+(?:[.,]\d{1,2})?$/.test(value)){setMessage('Use um valor como 15000,00, sem ponto de milhar.');return}
 const cents=Math.round(Number(value.replace(',','.'))*100);if(cents<=0||cents>100000000000){setMessage('Informe uma meta maior que zero, até R$ 1 bilhão.');return}
 setBusy(true);try{const {error}=await supabase.from('sales_goals').upsert({store,period_type:'month',period_start:range.start,cents},{onConflict:'store,period_type,period_start'});if(error)throw error;await reload();setEdit(false);setMessage('Meta salva.')}catch(e:any){setMessage(friendlyError(e))}finally{setBusy(false)}
 }
 return <section className="monthly-goal" aria-label={'Meta mensal de '+store}><div className="monthly-heading"><h4>META DO MÊS</h4><span>{goal?money(target):'A definir'}</span></div><small className="goal-month">{month}</small>{goal?<><div className="bar" role="progressbar" aria-label={'Meta mensal de '+store} aria-valuenow={Math.round(result.progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:result.progress+'%'}}/></div><div className="monthly-bottom"><p>{result.remaining?<>Faltam {money(result.remaining)}</>:<b>Meta atingida!</b>}</p>{data.admin&&<button className="monthly-edit" onClick={()=>setEdit(!edit)}>{edit?'Fechar':'Editar meta'}</button>}</div>{result.sold!==target-result.remaining&&<small>{money(result.sold)} vendidos no mês</small>}</>:<div className="monthly-bottom"><p>Meta ainda não definida</p>{data.admin&&<button className="monthly-edit" onClick={()=>setEdit(!edit)}>{edit?'Fechar':'Definir meta'}</button>}</div>}
 {data.admin&&edit&&<form className="monthly-form" onSubmit={save}><label>Meta mensal (R$)<input required inputMode="decimal" placeholder="Ex.: 15000,00" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar meta'}</button></form>}{message&&<p role="status">{message}</p>}</section>
}
