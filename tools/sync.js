import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../supabase/functions/_shared/',import.meta.url),{recursive:true});
await copyFile(new URL('../docs/engine.js',import.meta.url),new URL('../supabase/functions/_shared/engine.js',import.meta.url));
console.log('Gemeinsame Turnierregeln synchronisiert.');
