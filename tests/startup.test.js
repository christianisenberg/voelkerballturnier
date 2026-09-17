import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../docs/'+name,import.meta.url),'utf8');
const bundle=await read('app-bundle.js'),config=await read('config.js'),boot=await read('boot.js');
function page(hash=''){
  const elements=new Map();
  const document={documentElement:{dataset:{}},addEventListener(){},querySelector(selector){if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',hidden:false,setAttribute(){},addEventListener(){}});return elements.get(selector);},getElementById(id){return this.querySelector('#'+id);}};
  const listeners={};
  const context={document,location:{hash},sessionStorage:{getItem(){return null;}},setInterval(){},setTimeout(){},addEventListener(name,fn){listeners[name]=fn;},structuredClone,console};
  context.window=context;vm.createContext(context);return {context,elements,listeners};
}
test('Ausgeliefertes klassisches Skript startet Zuschaueransicht ohne Module oder Server',()=>{const p=page();vm.runInContext(config,p.context);vm.runInContext(bundle,p.context);assert.equal(p.context.document.documentElement.dataset.appReady,'true');assert.match(p.elements.get('#app').innerHTML,/Aktuelle Tabelle/);assert.match(p.elements.get('#app').innerHTML,/Halbfinale 1/);assert.match(p.elements.get('#connection').textContent,/Vorschau/);});
test('Direkter Start der Schiedsrichteransicht bleibt ohne Konfiguration verständlich',()=>{const p=page('#admin');vm.runInContext(config,p.context);vm.runInContext(bundle,p.context);assert.match(p.elements.get('#app').innerHTML,/Online-Verbindung ist noch nicht eingerichtet/);assert.equal(p.context.document.documentElement.dataset.appReady,'true');});
test('Startfehler ersetzt den endlosen Ladehinweis',()=>{const p=page();vm.runInContext(boot,p.context);p.listeners.error();assert.match(p.elements.get('#connection').textContent,/nicht gestartet/);});
test('Erfolgreicher Start wird nicht nachträglich als Startfehler überschrieben',()=>{const p=page();vm.runInContext(boot,p.context);vm.runInContext(bundle,p.context);p.listeners.load();assert.match(p.elements.get('#connection').textContent,/Vorschau/);});
test('HTML lädt klassische Skripte; Bundle ist aktuell',async()=>{const html=await read('index.html');assert.doesNotMatch(html,/type="module"/);assert.match(html,/src="app-bundle.js"/);const engine=await read('engine.js'),app=await read('app.js');assert.ok(bundle.includes(engine.replace(/^export /gm,'')));assert.ok(bundle.includes(app.replace(/^import .* from '\.\/engine\.js';\r?\n/m,'')));});
