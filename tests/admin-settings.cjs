const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
const html=fs.readFileSync('dinteams/settings.html','utf8'),els={};
for(const id of html.matchAll(/id="([^"]+)"/g)) els[id[1]]={value:'',hidden:false,addEventListener(event,fn){this[event]=fn;}};
els.emailPreviewStatus.value='pending';
let init,saved;
const settings={court_rate:250,openplay_rate:100,paddle_rate:100,paddle_per:'booking',courts:3,openplay_capacity:24,court_open_hour:8,court_close_hour:17,open_hour:18,close_hour:22,gcash_number:'test',gcash_name:'test',email_pending_message:'Pending message',email_confirmed_message:'Confirmed message',email_cancelled_message:'Cancelled message',email_footer:'Contact team'};
const D={DEFAULT_SETTINGS:settings,loadSettings:()=>Promise.resolve(settings),saveSettings:s=>{saved=s;return Promise.resolve({ok:true});},peso:n=>'PHP '+n};
vm.runInNewContext(fs.readFileSync('assets/js/admin-settings.js','utf8'),{window:{DND:D,ADMIN:{requireLogin:fn=>fn({}),initShell:()=>{},toast:()=>{}}},document:{getElementById:id=>els[id],addEventListener:(e,fn)=>{init=fn;}},console,setTimeout:()=>{}});
init();await Promise.resolve();
// Browser input values are strings.
for(const el of Object.values(els)) el.value=String(el.value);
assert(els.emailPreview.textContent.includes('PHP 350'));
els.setCourtRate.value='300';els.setPaddleRate.value='50';
els.setEmailPending.value='<script>not executed</script>';
els.setEmailPending.input();
assert(els.emailPreview.textContent.includes('<script>not executed</script>'));
els.saveSettingsBtn.click();await Promise.resolve();
assert.equal(saved.court_rate,300);assert.equal(saved.paddle_rate,50);
assert.equal(saved.email_pending_message,'<script>not executed</script>');
saved=null;els.setCourtRate.value='-1';els.saveSettingsBtn.click();assert.equal(saved,null);
els.setCourtRate.value='300.5';els.saveSettingsBtn.click();assert.equal(saved,null);
els.setCourtRate.value='';els.saveSettingsBtn.click();assert.equal(saved,null);
console.log('PASS: rates and messages load/save, safe text preview, invalid/blank rates rejected');
})().catch(e=>{console.error(e);process.exitCode=1;});
