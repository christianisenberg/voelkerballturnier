// Diese Regeln laufen identisch im Browser und in der geschützten Edge Function.
export const TEAMS = ['Physiker','Thunder 40','A - Team','GymHim','purple pain','Bushido','GymAlf'];
export const PAIRS = [[0,4],[1,3],[6,5],[2,4],[0,3],[1,6],[2,5],[3,4],[0,6],[1,5],[2,3],[4,5],[2,6],[0,1],[3,5],[4,6],[1,2],[0,5],[3,6],[1,4],[0,2]];
export function time(i) { const m=18*60+30+i*10; return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`; }
export const SCHEDULE = PAIRS.map(([a,b],i)=>({id:`g${i+1}`,a,b,time:time(i),stage:'group'}));
export const emptyState = () => ({results:{},lot:null});
export function validateScore(r, ko=false) {
  if (!r || !['ra','ca','rb','cb'].every(k=>Number.isSafeInteger(r[k]) && r[k]>=0 && r[k]<= (k[0]==='c'?3:1000000))) throw new Error('Bitte gültige ganze Zahlen eingeben (Kapitän: 0–3).');
  if (r.ca===0 && r.cb===0) throw new Error('Beide Kapitäne können nicht gleichzeitig 0 Leben haben.');
  if (ko && r.ca>0 && r.cb>0) throw new Error('In der Finalrunde muss genau ein Kapitän 0 Leben haben. Bitte bis zur Entscheidung weiterspielen.');
  return {ra:r.ra,ca:r.ca,rb:r.rb,cb:r.cb};
}
export function outcome(r) {return r.ca===0?'b':r.cb===0?'a':'draw';}
export function lives(r){return [r.ra+r.ca,r.rb+r.cb];}
export function standings(state) {
  const rows=TEAMS.map((name,id)=>({id,name,played:0,w:0,d:0,l:0,for:0,against:0,diff:0,pts:0,h2h:0}));
  for (const m of SCHEDULE) {
    const r=state.results[m.id]; if(!r)continue;
    const [a,b]=[rows[m.a],rows[m.b]], [la,lb]=lives(r), out=outcome(r);
    a.played++; b.played++; a.for+=la; a.against+=lb; b.for+=lb; b.against+=la;
    if(out==='draw'){a.d++;b.d++;a.pts++;b.pts++;}
    else {const [win,lose]=out==='a'?[a,b]:[b,a];win.w++;win.pts+=2;lose.l++;}
  }
  rows.forEach(r=>r.diff=r.for-r.against);
  // Mini-Tabelle: nur Punkte aus Spielen innerhalb der gesamten punktgleichen Gruppe.
  for (const m of SCHEDULE) {
    const r=state.results[m.id]; if(!r || rows[m.a].pts!==rows[m.b].pts)continue;
    const out=outcome(r);
    rows[m.a].h2h+=out==='a'?2:out==='draw'?1:0;
    rows[m.b].h2h+=out==='b'?2:out==='draw'?1:0;
  }
  const cmp=(a,b)=>b.pts-a.pts || b.h2h-a.h2h || b.diff-a.diff || b.for-a.for;
  rows.sort((a,b)=>cmp(a,b) || (state.lot ? state.lot.indexOf(a.id)-state.lot.indexOf(b.id) : a.id-b.id));
  const ties=[];
  for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length && cmp(rows[i],rows[j])===0)j++;if(j-i>1)ties.push(rows.slice(i,j).map(x=>x.id));i=j;}
  const complete=SCHEDULE.every(m=>state.results[m.id]);
  const needsLot=complete && !state.lot && ties.some(group=>group.some(id=>rows.slice(0,4).some(r=>r.id===id)));
  rows.forEach((r,i)=>{r.rank=i+1;r.tied=!state.lot && ties.some(g=>g.includes(r.id));if(r.tied){r.rank=rows.findIndex(x=>cmp(x,r)===0)+1;}});
  return {rows,ties,complete,needsLot};
}
export function fixtures(state) {
  const {rows,complete,needsLot}=standings(state), ready=complete&&!needsLot;
  const semi=[{id:'s1',a:ready?rows[0].id:null,b:ready?rows[3].id:null,time:'22:10',stage:'semi',label:'Halbfinale 1',placeholder:['Platz 1','Platz 4']},{id:'s2',a:ready?rows[1].id:null,b:ready?rows[2].id:null,time:'22:20',stage:'semi',label:'Halbfinale 2',placeholder:['Platz 2','Platz 3']}];
  const win=m=>{const r=state.results[m.id];return m.a!==null && r ? m[outcome(r)] : null;};
  return [...SCHEDULE,...semi,{id:'f',a:win(semi[0]),b:win(semi[1]),time:'22:40',stage:'final',label:'Finale',placeholder:['Sieger HF 1','Sieger HF 2']}];
}
export function applyResult(state,id,score) {
  const before=fixtures(state), match=before.find(m=>m.id===id);
  if(!match || match.a===null || match.b===null)throw new Error('Die Teilnehmer stehen noch nicht fest.');
  const result=validateScore(score,match.stage!=='group');
  const next=structuredClone(state);
  if(JSON.stringify(next.results[id])===JSON.stringify(result))return {state:next,cleared:[]};
  next.results[id]=result;
  if(match.stage==='group')next.lot=null;
  const cleared=[];
  // Korrekturen verwerfen nur KO-Ergebnisse, deren Teilnehmer sich tatsächlich ändern.
  for(const key of ['s1','s2','f']){
    const a=before.find(m=>m.id===key), b=fixtures(next).find(m=>m.id===key);
    if(a.a!==b.a || a.b!==b.b){if(next.results[key])cleared.push(key);delete next.results[key];}
  }
  return {state:next,cleared};
}
export function applyLot(state,order){
  if(!standings(state).needsLot)throw new Error('Es ist keine Losentscheidung erforderlich.');
  if(!Array.isArray(order)||order.length!==7||new Set(order).size!==7||order.some(x=>!Number.isInteger(x)||x<0||x>6))throw new Error('Ungültige Losreihenfolge.');
  return {...structuredClone(state),lot:order};
}
