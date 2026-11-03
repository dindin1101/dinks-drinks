// Test-only external dependency. No npm/build step for the static website.
const ts=require(process.env.TYPESCRIPT_MODULE || 'typescript');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
let handler,inserted=0,lastRow;
const env={BOOKING_ORIGIN:'https://dinksndrinks.vercel.app',SUPABASE_URL:'test',SUPABASE_SERVICE_ROLE_KEY:'test-only'};
const source=fs.readFileSync('supabase/functions/create-booking/index.ts','utf8').replace(/^import .*;$/gm,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
vm.runInNewContext(js,{Deno:{env:{get:n=>env[n]},serve:fn=>{handler=fn;}},Response,URLSearchParams,AbortSignal,TextDecoder,Uint8Array,console:{warn:()=>{}},fetch:async()=>{throw Error('No Google CAPTCHA request expected');},createClient:()=>({from:()=>({insert:async row=>{inserted++;lastRow=row;return {error:null};}})}),EdgeRuntime:{waitUntil:()=>{}},sendBookingEmails:async()=>{}});
const booking={customer_name:'Private Name',public_nickname:'Team Smash',mobile:'09171234567',booking_ref:'DND-TEST',customer_email:'test@example.com',date:'2026-11-04',booking_type:'court',payment_method:'counter',slots:[{court:1,hour:8}]};
async function call(b=booking,protection={website:''},origin=env.BOOKING_ORIGIN){return handler(new Request(env.BOOKING_ORIGIN+'/booking',{method:'POST',headers:{origin},body:JSON.stringify({booking:b,protection})}));}
assert.equal((await call(booking,{website:'spam.example'})).status,400);
assert.equal((await call(booking,null)).status,400);
assert.equal((await call(booking,{website:''},'https://wrong.example')).status,403);
assert.equal(inserted,0);
assert.equal((await call({...booking,public_nickname:''})).status,400);
assert.equal((await call()).status,200);assert.equal(inserted,1);assert.equal(lastRow.public_nickname,'Team Smash');assert.equal(lastRow.status,'pending');
console.log('PASS: no CAPTCHA secrets or token needed, honeypot/origin rejection, nickname required, valid booking reaches insert');
})().catch(e=>{console.error(e);process.exitCode=1;});
