/* Erzeugt durch npm run build. Quellen: engine.js und app.js. */
(()=>{
"use strict";
// Diese Regeln laufen identisch im Browser und in der geschützten Edge Function.
const TEAMS = ['Physiker','Alfeld II','A - Team','Gymhim','Ersatzbank','Bushido','GymAlf'];
const PAIRS = [[0,4],[1,3],[6,5],[2,4],[0,3],[1,6],[2,5],[3,4],[0,6],[1,5],[2,3],[4,5],[2,6],[0,1],[3,5],[4,6],[1,2],[0,5],[3,6],[1,4],[0,2]];
function time(i) { const m=18*60+30+i*10; return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`; }
const SCHEDULE = PAIRS.map(([a,b],i)=>({id:`g${i+1}`,a,b,time:time(i),stage:'group'}));
const emptyState = () => ({results:{},lot:null});
function validateScore(r, ko=false) {
  if (!r || !['ra','ca','rb','cb'].every(k=>Number.isSafeInteger(r[k]) && r[k]>=0 && r[k]<= (k[0]==='c'?3:1000000))) throw new Error('Bitte gültige ganze Zahlen eingeben (Kapitän: 0–3).');
  if (r.ca===0 && r.cb===0) throw new Error('Beide Kapitäne können nicht gleichzeitig 0 Leben haben.');
  if (ko && r.ca>0 && r.cb>0) throw new Error('In der Finalrunde muss genau ein Kapitän 0 Leben haben. Bitte bis zur Entscheidung weiterspielen.');
  return {ra:r.ra,ca:r.ca,rb:r.rb,cb:r.cb};
}
function outcome(r) {return r.ca===0?'b':r.cb===0?'a':'draw';}
function lives(r){return [r.ra+r.ca,r.rb+r.cb];}
function standings(state) {
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
function fixtures(state) {
  const {rows,complete,needsLot}=standings(state), ready=complete&&!needsLot;
  const semi=[{id:'s1',a:ready?rows[0].id:null,b:ready?rows[3].id:null,time:'22:10',stage:'semi',label:'Halbfinale 1',placeholder:['Platz 1','Platz 4']},{id:'s2',a:ready?rows[1].id:null,b:ready?rows[2].id:null,time:'22:20',stage:'semi',label:'Halbfinale 2',placeholder:['Platz 2','Platz 3']}];
  const win=m=>{const r=state.results[m.id];return m.a!==null && r ? m[outcome(r)] : null;};
  return [...SCHEDULE,...semi,{id:'f',a:win(semi[0]),b:win(semi[1]),time:'22:40',stage:'final',label:'Finale',placeholder:['Sieger HF 1','Sieger HF 2']}];
}
function applyResult(state,id,score) {
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
function applyLot(state,order){
  if(!standings(state).needsLot)throw new Error('Es ist keine Losentscheidung erforderlich.');
  if(!Array.isArray(order)||order.length!==7||new Set(order).size!==7||order.some(x=>!Number.isInteger(x)||x<0||x>6))throw new Error('Ungültige Losreihenfolge.');
  return {...structuredClone(state),lot:order};
}

const config=globalThis.VOELKERBALL_CONFIG || {};
const $=s=>document.querySelector(s), root=$('#app');
const configured=!!(config.supabaseUrl && config.publishableKey);
let state=emptyState(),revision=-1,updatedAt='',token='',busy=false,loaded=false;
try{token=sessionStorage.getItem('tournament-session')||'';}catch{}
const drafts=new Map(), messages=new Map();
const admin=()=>location.hash==='#admin';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(message){$('#notice').textContent=message;$('#notice').hidden=!message;}
function remember(value){token=value;try{value?sessionStorage.setItem('tournament-session',value):sessionStorage.removeItem('tournament-session');}catch{}}
function accept(row){if(row.revision<revision)return;state=row.payload;revision=row.revision;updatedAt=row.updated_at;loaded=true;}
async function api(body){
  const response=await fetch(`${config.supabaseUrl}/functions/v1/tournament`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify({...body,token}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok){if(response.status===401&&body.action!=='login'){remember('');render();}throw new Error(data.error||'Die Anfrage ist fehlgeschlagen.');}
  return data;
}
async function refresh(){
  if(!configured)return;
  try{
    const response=await fetch(`${config.supabaseUrl}/rest/v1/tournament_state?id=eq.1&select=payload,revision,updated_at`,{headers:{apikey:config.publishableKey},cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error();const rows=await response.json();if(!rows[0])throw new Error();
    const changed=rows[0].revision!==revision;accept(rows[0]);
    $('#connection').textContent=`Stand ${new Date(updatedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr · automatische Aktualisierung alle 15 Sekunden`;
    if(changed && (!admin()||token||!root.children.length))render();
  }catch{$('#connection').textContent=loaded?'Verbindung unterbrochen · letzter geladener Stand bleibt sichtbar.':'Ergebnisse konnten nicht geladen werden. Verbindung und Einrichtung prüfen.';}
}
function resultText(r,m){if(!r)return '';const [a,b]=lives(r),o=outcome(r);return `<div class="score"><strong>${a} : ${b}</strong><span class="tag ${o==='draw'?'draw':''}">${o==='draw'?'Unentschieden':esc(TEAMS[m[o]])+' gewinnt'}</span></div>`;}
function matchCard(m,editing=false){
  const result=state.results[m.id],ready=m.a!==null&&m.b!==null;
  const a=ready?TEAMS[m.a]:(m.a!==null?TEAMS[m.a]:m.placeholder[0]),b=ready?TEAMS[m.b]:(m.b!==null?TEAMS[m.b]:m.placeholder[1]);
  const draft=drafts.get(m.id),r=draft?.score||result||{ra:0,ca:3,rb:0,cb:3};
  const controls=(team,side)=>`<div class="team-controls"><h3>${esc(team)}</h3>${[['Reguläre Spieler','r'],['Kapitänsleben','c']].map(([label,key])=>{const field=key+side;return `<span class="control-label">${label}</span><div class="stepper"><button type="button" data-step="-1" data-field="${field}" aria-label="${esc(team)}: ${label} verringern" ${r[field]===0?'disabled':''}>−</button><output id="${m.id}-${field}" aria-label="${esc(team)}: ${label}">${r[field]}</output><button type="button" data-step="1" data-field="${field}" aria-label="${esc(team)}: ${label} erhöhen" ${key==='c'&&r[field]===3?'disabled':''}>+</button></div>`;}).join('')}</div>`;
  return `<article class="match ${editing?'':'public'} ${result?'saved':''}" data-id="${m.id}"><div class="match-top"><span><b>${m.time}</b> Uhr${m.stage!=='group'?' · geplant':''}</span><span>${m.label||'Spiel '+m.id.slice(1)}</span></div>${editing&&ready?`<div class="edit-grid">${controls(a,'a')}${controls(b,'b')}</div><p class="dirty-label" ${draft?'':'hidden'}>Noch nicht gespeichert</p><button class="save" data-save ${!loaded||busy?'disabled':''}>${result?'Änderung speichern':'Ergebnis speichern'}</button>${draft?'<button class="secondary" data-discard style="margin-top:10px">Aktuelle Werte laden</button>':''}<p class="feedback" role="status">${esc(messages.get(m.id)||'')}</p>`:`<div class="teams"><span>${esc(a)}</span><span class="versus">–</span><span>${esc(b)}</span></div>`}${resultText(result,m)}</article>`;
}
function render(){
  $('#public-link').setAttribute('aria-current',admin()?'false':'page');$('#admin-link').setAttribute('aria-current',admin()?'page':'false');
  if(admin()&&!token){root.innerHTML=`<div class="login"><h1>Ergebnisse eintragen</h1><p class="muted">Zugang für Schiedsrichter</p>${configured?'<form id="login"><label for="password">Passwort</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button>Anmelden</button><p id="login-error" class="feedback error" role="alert"></p></form>':'<p>Die Online-Verbindung ist noch nicht eingerichtet. Die Anleitung liegt dem App-Paket bei.</p>'}</div>`;return;}
  const table=standings(state),all=fixtures(state),played=SCHEDULE.filter(m=>state.results[m.id]).length;
  const tableHtml=`<div class="section-head"><h1>Aktuelle Tabelle</h1><span class="count">${played} / 21 Spiele</span></div><p class="subtitle">Vorrunde · Jeder gegen jeden</p><div class="table-wrap" tabindex="0" role="region" aria-label="Turniertabelle, seitlich scrollbar"><table><thead><tr>${['#','Team','Sp','S','U','N','Leben','Diff','Pkt'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r=>`<tr class="${!r.tied&&r.rank<=4?'qualified':''}"><td>${r.rank}${r.tied?'=':''}</td><td>${esc(r.name)}</td><td>${r.played}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.for}:${r.against}</td><td>${r.diff>0?'+':''}${r.diff}</td><td>${r.pts}</td></tr>`).join('')}</tbody></table></div><p class="legend">Platz 1–4 → Halbfinale · = gleicher Rang${state.lot?' · Losentscheidung berücksichtigt':''}</p><details><summary>So wird gewertet</summary><p>Sieg 2 Punkte · Unentschieden 1 · Niederlage 0. Leben = reguläre Spieler + Kapitänsleben. Haben beide Kapitäne noch Leben, ist das Spiel unentschieden – auch bei 7:5.</p><p>Reihenfolge: Punkte → direkter Vergleich (Punkte innerhalb der punktgleichen Gruppe) → gesamte Lebensdifferenz → gesamte verbliebene Leben. Besteht danach noch Gleichstand bei den Halbfinalplätzen, entscheidet ein bestätigtes Los. Der direkte Vergleich wird nicht erneut für Teilgruppen berechnet.</p><p>Sp: Spiele · S/U/N: Siege/Unentschieden/Niederlagen · Leben: eigene/gegnerische verbliebene Leben.</p></details>`;
  root.innerHTML=`${admin()?'<div class="section-head"><h1>Ergebniseingabe</h1><button class="secondary" data-logout>Abmelden</button></div><p class="subtitle">Vier Werte eintragen und speichern. Gespeicherte Spiele bleiben bearbeitbar.</p><p class="note">Bei Korrekturen werden abhängige KO-Ergebnisse gelöscht, wenn sich deren Teilnehmer ändern. Die App weist vor dem Speichern darauf hin.</p>':tableHtml}${table.needsLot?`<div class="note">Die Vorrunde ist abgeschlossen. Bei den Halbfinalplätzen besteht vollständiger Gleichstand. Die Losentscheidung steht noch aus.${admin()?'<p><button data-lot>Losentscheidung durchführen</button></p>':''}</div>`:''}<section class="${admin()?'admin-matches':''}"><div class="section-head"><h2>Spielplan & Ergebnisse</h2><span class="count">Vorrunde</span></div>${all.filter(m=>m.stage==='group').map(m=>matchCard(m,admin())).join('')}<section class="bracket"><h2>Finalrunde</h2><p class="ko-time">Geplante Zeiten · bei längeren KO-Spielen entsprechend später.<br>22:00 Uhr: Auswertung · 22:30 Uhr: Finalpause</p>${all.filter(m=>m.stage!=='group').map(m=>matchCard(m,admin())).join('')}</section></section>${state.results.f?`<div class="champion">Turniersieger<strong>${esc(TEAMS[all.at(-1)[outcome(state.results.f)]])}</strong></div>`:''}`;
}
root.addEventListener('submit',async e=>{
  if(e.target.id!=='login')return;e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
  try{const data=await api({action:'login',password:$('#password').value});remember(data.token);notice('');await refresh();render();}
  catch(error){$('#login-error').textContent=error.message;button.disabled=false;}
});
root.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-logout')){if(drafts.size&&!confirm('Ungespeicherte Eingaben verwerfen und abmelden?'))return;try{await api({action:'logout'});}catch{}remember('');drafts.clear();render();return;}
  if(button.hasAttribute('data-lot')){
    if(!confirm('Vollständig gleiche Teams werden zufällig gereiht. Die Losentscheidung wird gespeichert und veröffentlicht. Jetzt auslosen?'))return;
    button.disabled=true;try{const row=await api({action:'lot',revision});accept(row);render();notice('Losentscheidung gespeichert. Die Halbfinalpaarungen stehen fest.');}catch(err){notice(err.message);button.disabled=false;}return;
  }
  const card=button.closest('[data-id]');if(!card)return;const id=card.dataset.id;
  if(button.hasAttribute('data-discard')){drafts.delete(id);messages.delete(id);await refresh();render();return;}
  if(button.dataset.step){
    if(!drafts.has(id))drafts.set(id,{revision,score:{...(state.results[id]||{ra:0,ca:3,rb:0,cb:3})}});
    const r=drafts.get(id).score,key=button.dataset.field;
    r[key]=Math.max(0,Math.min(key[0]==='c'?3:1000000,r[key]+Number(button.dataset.step)));
    card.querySelector(`#${id}-${key}`).textContent=r[key];
    card.querySelector(`[data-field="${key}"][data-step="-1"]`).disabled=r[key]===0;
    card.querySelector(`[data-field="${key}"][data-step="1"]`).disabled=key[0]==='c'?r[key]===3:r[key]===1000000;
    card.querySelector('.dirty-label').hidden=false;
    card.querySelector('.feedback').textContent='';return;
  }
  if(button.hasAttribute('data-save')){
    if(busy)return;
    const draft=drafts.get(id)||{revision,score:{...(state.results[id]||{ra:0,ca:3,rb:0,cb:3})}};
    drafts.set(id,draft);let proposed;
    try{proposed=applyResult(state,id,draft.score);}catch(err){card.querySelector('.feedback').textContent=err.message;card.querySelector('.feedback').classList.add('error');return;}
    if(proposed.cleared.length&&!confirm(`Diese Korrektur löscht ${proposed.cleared.map(k=>({s1:'Halbfinale 1',s2:'Halbfinale 2',f:'Finale'})[k]).join(', ')}, weil sich die Teilnehmer ändern. Speichern?`))return;
    const score={...draft.score};busy=true;button.disabled=true;button.textContent='Wird gespeichert …';
    try{
      const row=await api({action:'save',id,score,revision:draft.revision});accept(row);
      if(JSON.stringify(drafts.get(id)?.score)===JSON.stringify(score))drafts.delete(id);
      messages.set(id,'Gespeichert ✓');notice('');
    }catch(err){messages.set(id,err.message);notice(err.message);await refresh();}
    finally{busy=false;render();}
  }
});
window.addEventListener('hashchange',render);
window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
render();
document.documentElement.dataset.appReady='true';
if(configured){refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);}
else{$('#connection').textContent='Vorschau · noch nicht mit der Online-Datenbank verbunden';}

})();
