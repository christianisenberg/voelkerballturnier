import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {emptyState} from '../docs/engine.js';
let handler,row,commits,valid,fetchFailure;
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.invalid':'server-secret'},serve:fn=>{handler=fn;}};
const source=(await readFile(new URL('../supabase/functions/tournament/index.ts',import.meta.url),'utf8')).replace("'../_shared/engine.js'",JSON.stringify(new URL('../docs/engine.js',import.meta.url).href));
await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
globalThis.fetch=async(url,opts)=>{
  if(fetchFailure)throw Error('offline');
  const body=opts.body?JSON.parse(opts.body):{};
  let result;
  if(url.includes('tournament_session'))result=valid&&body.p_token==='a'.repeat(64);
  else if(url.includes('tournament_login'))result={error:'Passwort nicht korrekt.',status:401};
  else if(url.includes('tournament_commit')){commits++;result={...row,payload:body.p_payload,revision:row.revision+1};}
  else result=[row];
  return new Response(JSON.stringify(result),{status:200});
};
function reset(){row={payload:emptyState(),revision:0,updated_at:new Date().toISOString()};commits=0;valid=true;fetchFailure=false;}
async function request(body){return handler(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify(body)}));}
const base=()=>({action:'save',token:'a'.repeat(64),revision:0,id:'g1',score:{ra:4,ca:3,rb:3,cb:2}});
test('Edge: unauthentifizierter Schreibzugriff wird verweigert',async()=>{reset();const b=base();delete b.token;assert.equal((await request(b)).status,401);assert.equal(commits,0);});
test('Edge: gefälschte und abgelaufene Sitzung wird verweigert',async()=>{reset();valid=false;assert.equal((await request(base())).status,401);assert.equal(commits,0);});
test('Edge: falsches Passwort gibt 401',async()=>{reset();assert.equal((await request({action:'login',password:'wrong'})).status,401);});
test('Edge: veraltete Revision überschreibt nichts',async()=>{reset();row.revision=3;assert.equal((await request(base())).status,409);assert.equal(commits,0);});
test('Edge: manipulierte Werte werden serverseitig verworfen',async()=>{reset();const b=base();b.score.ca=0;b.score.cb=0;assert.equal((await request(b)).status,422);assert.equal(commits,0);});
test('Edge: freies Übergeben von Tabelle/Teams ignoriert',async()=>{reset();const b=base();b.payload={results:{f:b.score}};b.score.admin=true;b.teams=['Fake'];const response=await request(b);assert.equal(response.status,200);const result=await response.json();assert.deepEqual(Object.keys(result.payload.results),['g1']);assert.equal(result.payload.results.g1.admin,undefined);});
test('Edge: KO vor Vorrundenabschluss gesperrt',async()=>{reset();const b=base();b.id='s1';assert.equal((await request(b)).status,422);});
test('Edge: Auslosen ohne Gleichstand gesperrt',async()=>{reset();assert.equal((await request({...base(),action:'lot'})).status,422);});
test('Edge: DB-Ausfall meldet Fehler statt Erfolg',async()=>{reset();fetchFailure=true;assert.equal((await request(base())).status,503);});
test('Edge: große und ungültige Anfragen werden abgewiesen',async()=>{reset();assert.equal((await request({data:'a'.repeat(9000)})).status,413);assert.equal((await handler(new Request('https://edge.invalid',{method:'POST',body:'{bad'}))).status,400);});
test('Edge: OPTIONS und unzulässige Methoden',async()=>{assert.equal((await handler(new Request('https://edge.invalid',{method:'OPTIONS'}))).status,204);assert.equal((await handler(new Request('https://edge.invalid'))).status,405);});
