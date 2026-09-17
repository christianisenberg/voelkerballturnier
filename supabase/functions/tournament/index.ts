import {applyResult,applyLot,TEAMS} from '../_shared/engine.js';
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
async function db(path:string,body?:unknown){
  const response=await fetch(`${url}/rest/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw new Error('database');return response.json();
}
const rpc=(name:string,args:unknown)=>db(`rpc/${name}`,args);
function randomOrder(){
  const list=TEAMS.map((_:string,i:number)=>i);
  for(let i=list.length-1;i>0;i--){
    const bound=i+1,limit=Math.floor(0x100000000/bound)*bound;let value:number;
    do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=limit);
    const j=value%bound;[list[i],list[j]]=[list[j],list[i]];
  }return list;
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return reply({error:'Methode nicht erlaubt.'},405);
  try{
    // Begrenztes Einlesen schützt auch bei fehlendem Content-Length-Header.
    const reader=request.body?.getReader();if(!reader)return reply({error:'Leere Anfrage.'},400);
    let length=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return reply({error:'Anfrage zu groß.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Ungültige Anfrage.'},400);}
    if(!body || typeof body!=='object')return reply({error:'Ungültige Anfrage.'},400);
    if(body.action==='login'){
      if(typeof body.password!=='string'||body.password.length>128)return reply({error:'Ungültiges Passwort.'},400);
      const result=await rpc('tournament_login',{p_password:body.password});return reply(result,result.status||200);
    }
    if(typeof body.token!=='string'||body.token.length!==64||!await rpc('tournament_session',{p_token:body.token,p_logout:body.action==='logout'}))return reply({error:'Sitzung abgelaufen. Bitte erneut anmelden.'},401);
    if(body.action==='logout')return reply({ok:true});
    if(!['save','lot'].includes(body.action)||!Number.isSafeInteger(body.revision))return reply({error:'Ungültige Anfrage.'},400);
    const [row]=await db('tournament_state?id=eq.1&select=*');
    if(row.revision!==body.revision)return reply({error:'Inzwischen wurden Ergebnisse geändert. Bitte aktuelle Werte laden und die Eingabe erneut prüfen.'},409);
    let next;
    try{next=body.action==='save'?applyResult(row.payload,body.id,body.score).state:applyLot(row.payload,randomOrder());}
    catch(error){return reply({error:(error as Error).message},422);}
    const result=await rpc('tournament_commit',{p_token:body.token,p_revision:body.revision,p_payload:next});
    return reply(result,result.status||200);
  }catch{return reply({error:'Speichern derzeit nicht möglich. Bitte Verbindung prüfen und erneut versuchen.'},503);}
});
