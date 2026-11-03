// Test-only dependency: @electric-sql/pglite. No website build step required.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text);`);
  await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
  // Owner copy/paste bundle is safe to apply/reapply on an existing installation.
  const update=fs.readFileSync('supabase/updates/20261103_existing_site_update.sql','utf8');
  await db.exec(update);
  await db.exec(update);
  const date = (await db.query("select ((now() at time zone 'Asia/Manila')::date+1)::text as d")).rows[0].d;
  let seq = 0;
  function booking(extra = {}) {
    seq++;
    return Object.assign({booking_ref:'DND-TEST'+seq,customer_name:'Test Customer',mobile:'09171234567',
      booking_type:'court',date,court_number:1,start_hour:8,end_hour:9,slots:[{court:1,hour:8}],pax:2,
      rent_paddle:false,paddle_qty:0,court_amount:250,paddle_amount:0,total_amount:250,
      payment_method:'counter',status:'pending'}, extra);
  }
  async function insert(b) {
    return db.query('insert into public.bookings select (jsonb_populate_record(null::public.bookings, $1::jsonb)).* returning id',
      [JSON.stringify(Object.assign({id:crypto.randomUUID(),created_at:new Date().toISOString()},b))]);
  }
  async function fails(fn, text) {
    await assert.rejects(fn, e => e.message.includes(text));
    console.log('PASS reject:',text);
  }
  const first = (await insert(booking())).rows[0].id;
  await fails(()=>insert(booking()),'SLOT_UNAVAILABLE');
  await fails(()=>insert(booking({slots:[{court:2,hour:8}],total_amount:1})),'PRICE_CHANGED');
  await fails(()=>insert(booking({slots:[{court:99,hour:8}]})),'BOOKING_INVALID');
  await fails(()=>insert(booking({slots:[{court:2,hour:8},{court:2,hour:8}]})),'BOOKING_INVALID');
  await fails(()=>insert(booking({payment_method:'gcash',gcash_ref:'123456789'})),'PAYMENT_PROOF_REQUIRED');
  await fails(()=>insert(booking({date:'2020-01-01'})),'BOOKING_INVALID');
  await insert(booking({slots:[{court:2,hour:8},{court:3,hour:8}],court_amount:500,total_amount:500}));
  await db.query("update public.bookings set status='confirmed' where id=$1",[first]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_slot_claims')).rows[0].n,3);
  await db.query("update public.bookings set status='cancelled' where id=$1",[first]);
  await insert(booking());
  await fails(()=>db.query("update public.bookings set status='pending' where id=$1",[first]),'SLOT_UNAVAILABLE');
  const open = {booking_type:'openplay',slots:[],court_number:null,start_hour:18,end_hour:22,pax:20,court_amount:3000,total_amount:3000};
  const op = (await insert(booking(open))).rows[0].id;
  await fails(()=>insert(booking({...open,pax:5,court_amount:750,total_amount:750})),'OPENPLAY_FULL');
  await db.query("update public.bookings set status='confirmed' where id=$1",[op]);
  assert.equal((await db.query('select players from public.booking_session_counts')).rows[0].players,20);
  await db.query("update public.bookings set status='cancelled' where id=$1",[op]);
  await insert(booking({...open,pax:24,court_amount:3600,total_amount:3600}));
  await fails(()=>db.query("update public.bookings set status='pending' where id=$1",[op]),'OPENPLAY_FULL');
  await fails(()=>insert(booking({...open,pax:1,start_hour:19,court_amount:150,total_amount:150})),'BOOKING_INVALID');
  assert.equal((await db.query('select players from public.booking_session_counts')).rows[0].players,24);
  console.log('PASS: schema, court conflicts, multi-slot, server prices, validation, cancellations, reactivation, Open Play and counter rollback');
  const em = booking({customer_email:'test@example.com',mobile:'09991234567',slots:[{court:1,hour:10}]});
  const emId=(await insert(em)).rows[0].id;
  let queued=(await db.query('select * from public.booking_email_outbox')).rows;
  assert.equal(queued.length,1);
  assert.equal(queued[0].payload.to,'test@example.com');
  assert(queued[0].payload.email_message.includes('Thank you'));
  await db.query("update public.settings set value = to_jsonb('See you on court!'::text) where key='email_confirmed_message'");
  assert.equal(queued[0].payload.mobile,undefined);
  assert.equal(queued[0].payload.payment_proof_path,undefined);
  const claimed=(await db.query('select * from public.claim_booking_emails($1)',[em.booking_ref])).rows;
  assert.equal(claimed.length,1);
  assert.equal((await db.query('select * from public.claim_booking_emails($1)',[em.booking_ref])).rows.length,0);
  await db.query("update public.bookings set status='confirmed' where id=$1",[emId]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_email_outbox')).rows[0].n,2);
  await db.query("update public.bookings set status='confirmed' where id=$1",[emId]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_email_outbox')).rows[0].n,2);
  const snapshots=(await db.query('select payload from public.booking_email_outbox order by created_at,id')).rows.map(r=>r.payload);
  assert(snapshots.some(p=>p.status==='confirmed' && p.email_message==='See you on court!'));
  assert(snapshots.some(p=>p.status==='pending' && p.email_message.includes('Thank you')));
  console.log('PASS: editable email message snapshots preserve earlier queue content');
  console.log('PASS: email outbox creation/status events, no redundant status email, private fields excluded, worker lease');
  const boardId=(await insert(booking({slots:[{court:3,hour:12}],public_nickname:'Team <Smash>'}))).rows[0].id;
  let board=(await db.query('select * from public.court_board($1)',[date])).rows;
  assert(board.some(r=>r.court===3 && r.hour===12 && r.label==='Awaiting confirmation'));
  assert(!JSON.stringify(board).includes('Team <Smash>'));
  assert(!JSON.stringify(board).includes('Test Customer'));
  await db.query("update public.bookings set status='confirmed' where id=$1",[boardId]);
  await db.exec('set role anon');
  board=(await db.query('select * from public.court_board($1)',[date])).rows;
  assert(board.some(r=>r.label==='Team <Smash>'));
  assert.deepEqual(Object.keys(board[0]).sort(),['booking_status','court','hour','label']);
  assert.equal((await db.query("select * from public.court_board('2000-01-01')")).rows.length,0);
  await assert.rejects(()=>db.query('select customer_name from public.bookings'));
  await db.exec('reset role');
  await db.query("update public.bookings set status='cancelled' where id=$1",[boardId]);
  board=(await db.query('select * from public.court_board($1)',[date])).rows;
  assert(!board.some(r=>r.label==='Team <Smash>'));
  await fails(()=>insert(booking({slots:[{court:3,hour:12}],public_nickname:'x'.repeat(31)})),'bookings_public_nickname_check');
  console.log('PASS: public court board anonymous access, private data hidden, pending alias hidden, confirmed nickname, cancellations, nickname limits');
  await db.query("update public.bookings set status='cancelled' where id=$1",[emId]);
  await db.query("update public.bookings set status='pending' where id=$1",[emId]);
  await db.query("update public.bookings set status='confirmed' where id=$1",[emId]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_email_outbox where booking_ref=$1',[em.booking_ref])).rows[0].n,2);
  console.log('PASS: maximum two email jobs per booking across cancellation and repeated status toggles');
  await fails(()=>insert(booking({slots:[{court:2,hour:18}]})),'BOOKING_INVALID');
  await fails(()=>insert(booking({slots:[{court:3,hour:22}]})),'BOOKING_INVALID');
  await insert(booking({slots:[{court:1,hour:23}],customer_name:'mARY jANE',public_nickname:'tEAM sMASH',rent_paddle:true,paddle_qty:1,paddle_amount:80,total_amount:330}));
  const named=(await db.query("select customer_name,public_nickname,end_hour from public.bookings where public_nickname='Team Smash' and end_hour=24")).rows[0];
  assert.equal(named.customer_name,'Mary Jane');
  await insert(booking({slots:[{court:1,hour:5}]}));
  await insert(booking({slots:[{court:2,hour:17}]}));
  console.log('PASS: Court 1 dawn/midnight, Court 2/3 evening exclusions, paddle80, proper names');
  await db.close();
})().catch(e => { console.error(e); process.exitCode=1; });
