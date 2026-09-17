import {readFile,writeFile} from 'node:fs/promises';
const engine=await readFile(new URL('../docs/engine.js',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
// Keine externen Pakete: zwei kontrollierte Quelldateien, keine dynamischen Imports.
const bundle='/* Erzeugt durch npm run build. Quellen: engine.js und app.js. */\n(()=>{\n"use strict";\n'+engine.replace(/^export /gm,'')+'\n'+app.replace(/^import .* from '\.\/engine\.js';\r?\n/m,'')+'\n})();\n';
await writeFile(new URL('../docs/app-bundle.js',import.meta.url),bundle);
console.log('Direkt startbare Browser-Version erstellt.');
