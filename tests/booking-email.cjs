const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const values = {BOOKING_EMAIL_SECRET:'test-only-not-a-real-secret'};
let sent = 0, quota = 100, fail = false, lastMail;
const props = {getProperty:k=>values[k],setProperty:(k,v)=>{values[k]=v;},getProperties:()=>({...values}),deleteProperty:k=>{delete values[k];}};
const context = {
  PropertiesService:{getScriptProperties:()=>props},
  Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(text,key)=>Array.from(crypto.createHmac('sha256',key).update(text).digest())},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:mail=>{if(fail)throw Error('uncertain');assert(!mail.body.includes('payment_proof'));lastMail=mail;sent++;}}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('integrations/google-apps-script/Code.gs','utf8'),context);
function envelope(job, timestamp=Date.now()) {
  const payload=JSON.stringify(job);
  return {timestamp,payload,signature:crypto.createHmac('sha256',values.BOOKING_EMAIL_SECRET).update(timestamp+'.'+payload).digest('hex')};
}
const job={id:crypto.randomUUID(),to:'test@example.com',ref:'DND-TEST',status:'pending',date:'2026-12-01',type:'court',start_hour:8,end_hour:9,slots:[{court:1,hour:8}],total:250,payment:'counter'};
const call=body=>context.doPost({postData:{contents:JSON.stringify(body)}});
assert.equal(call({}).ok,false);
let env=envelope(job);env.signature='bad';assert.equal(call(env).ok,false);assert.equal(sent,0);
assert.equal(call(envelope(job,Date.now()-600000)).ok,false);
assert.equal(call(envelope(job)).ok,true);assert.equal(sent,1);
assert.equal(call(envelope(job)).duplicate,true);assert.equal(sent,1);
const next={...job,id:crypto.randomUUID()};
quota=0;assert.equal(call(envelope(next)).error,'quota');assert.equal(sent,1);
quota=100;assert.equal(call(envelope(next)).ok,true);assert.equal(sent,2);
const uncertain={...job,id:crypto.randomUUID()};fail=true;
assert.equal(call(envelope(uncertain)).error,'send_failed');fail=false;
assert.equal(call(envelope(uncertain)).error,'uncertain');assert.equal(sent,2);
assert.equal(call(envelope({...job,id:crypto.randomUUID(),to:'one@example.com,two@example.com'})).error,'invalid');
console.log('PASS: signed requests, invalid signature, expired request, duplicate suppression, quota recovery, uncertain-send suppression, single recipient');

const custom={...job,id:crypto.randomUUID(),email_message:'Custom welcome <text> & instructions.',email_footer:'Contact our team.'};
assert.equal(call(envelope(custom)).ok,true);
assert(lastMail.body.includes(custom.email_message));
assert(lastMail.body.includes(custom.email_footer));
assert(lastMail.body.includes('Reference: DND-TEST'));
assert(lastMail.body.includes('This email is not proof of verified payment'));
assert(!lastMail.body.includes('non-refundable'));
assert.equal(call(envelope({...job,id:crypto.randomUUID(),email_message:'x'.repeat(1601)})).error,'invalid');
console.log('PASS: editable plain-text messages, bounded length, fixed booking/payment details preserved');
