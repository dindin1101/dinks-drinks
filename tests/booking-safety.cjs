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
  const open = {booking_type:'openplay',slots:[],court_number:null,start_hour:18,end_hour:22,pax:20,court_amount:2000,total_amount:2000};
  const op = (await insert(booking(open))).rows[0].id;
  await fails(()=>insert(booking({...open,pax:5,court_amount:500,total_amount:500})),'OPENPLAY_FULL');
  await db.query("update public.bookings set status='confirmed' where id=$1",[op]);
  assert.equal((await db.query('select players from public.booking_session_counts')).rows[0].players,20);
  await db.query("update public.bookings set status='cancelled' where id=$1",[op]);
  await insert(booking({...open,pax:24,court_amount:2400,total_amount:2400}));
  await fails(()=>db.query("update public.bookings set status='pending' where id=$1",[op]),'OPENPLAY_FULL');
  await fails(()=>insert(booking({...open,pax:1,start_hour:19,court_amount:100,total_amount:100})),'BOOKING_INVALID');
  assert.equal((await db.query('select players from public.booking_session_counts')).rows[0].players,24);
  console.log('PASS: schema, court conflicts, multi-slot, server prices, validation, cancellations, reactivation, Open Play and counter rollback');
  const em = booking({customer_email:'test@example.com',mobile:'09991234567',slots:[{court:1,hour:10}]});
  const emId=(await insert(em)).rows[0].id;
  let queued=(await db.query('select * from public.booking_email_outbox')).rows;
  assert.equal(queued.length,1);
  assert.equal(queued[0].payload.to,'test@example.com');
  assert.equal(queued[0].payload.mobile,undefined);
  assert.equal(queued[0].payload.payment_proof_path,undefined);
  const claimed=(await db.query('select * from public.claim_booking_emails($1)',[em.booking_ref])).rows;
  assert.equal(claimed.length,1);
  assert.equal((await db.query('select * from public.claim_booking_emails($1)',[em.booking_ref])).rows.length,0);
  await db.query("update public.bookings set status='confirmed' where id=$1",[emId]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_email_outbox')).rows[0].n,2);
  await db.query("update public.bookings set status='confirmed' where id=$1",[emId]);
  assert.equal((await db.query('select count(*)::int as n from public.booking_email_outbox')).rows[0].n,2);
  console.log('PASS: email outbox creation/status events, no redundant status email, private fields excluded, worker lease');
  await db.close();
})().catch(e => { console.error(e); process.exitCode=1; });
