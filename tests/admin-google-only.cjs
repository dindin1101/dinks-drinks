const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
(async () => {
  const html=fs.readFileSync('dinteams/login.html','utf8');
  assert(!/id="(?:pinView|adminPin|pinBtn)"/.test(html));
  assert(fs.readFileSync('assets/css/styles.css','utf8').includes('[hidden]{display:none !important}'));
  let init, removed=false, entered=false, redirected=false;
  const elements={loginView:{},loginBtn:{},loginError:{}};
  vm.runInNewContext(fs.readFileSync('assets/js/admin-login.js','utf8'),{
    window:{DND:{HAS_SUPABASE:false}},
    document:{getElementById:id=>elements[id],addEventListener:(event,fn)=>{init=fn;}},
    sessionStorage:{removeItem:()=>{removed=true;}}
  });
  init();
  assert(removed); assert.equal(elements.loginBtn.disabled,true);
  assert(elements.loginError.textContent.includes('requires a live Supabase'));
  const ctx={window:{DND:{getSupabase:()=>Promise.resolve(null)}},sessionStorage:{removeItem:()=>{}},location:{replace:()=>{redirected=true;}}};
  vm.runInNewContext(fs.readFileSync('assets/js/admin-common.js','utf8'),ctx);
  await ctx.window.ADMIN.requireLogin(()=>{entered=true;});
  assert(redirected);assert(!entered);
  console.log('PASS: PIN form removed, hidden rule enforced, missing config disables login, admin demo access denied');
})().catch(e=>{console.error(e);process.exitCode=1;});
