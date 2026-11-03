// Test-only external dependency. No npm/build step for the static website.
const ts=require(process.env.TYPESCRIPT_MODULE || 'typescript');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
let handler,verification,inserted=0,lastRow;
const env={BOOKING_ORIGIN:'https://dinksndrinks.vercel.app',RECAPTCHA_HOSTNAME:'dinksndrinks.vercel.app',RECAPTCHA_SECRET_KEY:'test-only',SUPABASE_URL:'test',SUPABASE_SERVICE_ROLE_KEY:'test-only'};
const source=fs.readFileSync('supabase/functions/create-booking/index.ts','utf8').replace(/^import .*;$/gm,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
vm.runInNewContext(js,{Deno:{env:{get:n=>env[n]},serve:fn=>{handler=fn;}},Response,URLSearchParams,AbortSignal,TextDecoder,Uint8Array,console:{warn:()=>{}},fetch:async()=>({ok:true,json:async()=>verification}),createClient:()=>({from:()=>({insert:async row=>{inserted++;lastRow=row;return {error:null};}})}),EdgeRuntime:{waitUntil:()=>{}},sendBookingEmails:async()=>{}});
const booking={customer_name:'Private Name',public_nickname:'Team Smash',mobile:'09171234567',booking_ref:'DND-TEST',customer_email:'test@example.com',date:'2026-11-04',booking_type:'court',payment_method:'counter',slots:[{court:1,hour:8}]};
async function call(b=booking){return handler(new Request(env.BOOKING_ORIGIN+'/booking',{method:'POST',headers:{origin:env.BOOKING_ORIGIN},body:JSON.stringify({booking:b,protection:{website:'',token:'test-token'}})}));}
verification={success:false,'error-codes':['timeout-or-duplicate']};assert.equal((await (await call()).json()).code,'CAPTCHA_EXPIRED');
verification={success:false,'error-codes':['invalid-input-secret']};assert.equal((await (await call()).json()).code,'CAPTCHA_CONFIG');
verification={success:true,hostname:'dinks-drinks.vercel.app'};assert.equal((await (await call()).json()).code,'CAPTCHA_DOMAIN_MISMATCH');
assert.equal(inserted,0);
verification={success:true,hostname:env.RECAPTCHA_HOSTNAME};
assert.equal((await call({...booking,public_nickname:''})).status,400);
assert.equal((await call()).status,200);assert.equal(inserted,1);assert.equal(lastRow.public_nickname,'Team Smash');assert.equal(lastRow.status,'pending');
console.log('PASS: CAPTCHA expired/config/domain diagnostics; nickname required; verified request reaches insert; failed CAPTCHA never inserts');
})().catch(e=>{console.error(e);process.exitCode=1;});
