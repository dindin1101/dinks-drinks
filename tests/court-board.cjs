const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Node {
  constructor(tag){this.tag=tag;this.children=[];this.className='';this.value='';this.text='';}
  set textContent(v){this.text=v;this.children=[];}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join(' ');}
  appendChild(n){this.children.push(n);}
}
const board=new Node('div'),date=new Node('input');date.value='2026-11-03';
const source=fs.readFileSync('assets/js/court-board.js','utf8');
const renderSource=source.slice(source.indexOf('  function element('),source.indexOf('  function refresh()'));
const context={document:{createElement:tag=>new Node(tag)},$:id=>id==='courtBoard'?board:date,manilaNow:()=>({date:'2026-11-03',hour:12}),D:{hourShort:n=>n+':00'}};
vm.createContext(context);vm.runInContext(renderSource,context);
const rows=[{court:1,hour:12,label:'<img onerror=alert(1)>',booking_status:'confirmed'}, {court:1,hour:14,label:'Next Team',booking_status:'confirmed'},{court:2,hour:12,label:'Hidden Pending Name',booking_status:'pending'}];
context.render(rows,{courts:3});
assert.equal(board.children.length,3);
assert(board.children[0].textContent.includes('Scheduled now'));
assert(board.children[0].textContent.includes('Next · 14:00 · Next Team'));
assert(board.children[0].textContent.includes('<img onerror=alert(1)>'));
assert(!board.children[1].textContent.includes('Hidden Pending Name'));
assert(board.children[1].textContent.includes('Awaiting confirmation'));
assert(board.children[2].textContent.includes('Check with staff for availability'));
function flatten(n){return [n,...n.children.flatMap(flatten)];}
assert.equal(flatten(board).filter(n=>n.tag==='img').length,3);
assert.equal(flatten(board).filter(n=>n.tag==='details').length,3);
assert.equal(flatten(board).filter(n=>n.className==='court-on-court-name').length,2);
assert(flatten(board).find(n=>n.className==='court-on-court-name').textContent.includes('<img onerror=alert(1)>'));
for(const page of ['index.html','booking.html']) {
 const html=fs.readFileSync(page,'utf8');
 assert(html.indexOf('>Home</a>') < html.indexOf('>Court View</a>'));
}
assert.equal(flatten(board).filter(n=>n.tag==='img' && n.src!=='assets/img/court-top-view.svg').length,0);
assert(!flatten(board).some(n=>n.tag==='script'));
date.value='2026-11-04';context.render(rows,{courts:3});
assert(!board.textContent.includes('Scheduled now'));
assert(board.textContent.includes('Upcoming rental'));
date.value='2026-11-02';context.render(rows,{courts:3});
assert(board.textContent.includes('Past schedule'));
assert(!board.textContent.includes('Scheduled now'));
context.render([],{courts:4});assert.equal(board.children.length,4);
assert(!source.includes('.innerHTML'));
console.log('PASS: illustrated cards, current/next, pending privacy, safe nickname text, future/past dates, expandable schedule, configured court count');
