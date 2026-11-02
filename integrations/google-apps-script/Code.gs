/* Paste below your existing setup/rotation functions. Never hardcode secrets. */
function doPost(e) {
  function reply(value) {
    return ContentService.createTextOutput(JSON.stringify(value))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var lock;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 16000) return reply({ok:false, error:"invalid"});
    var envelope = JSON.parse(raw);
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("BOOKING_EMAIL_SECRET");
    if (!secret || !Number.isInteger(envelope.timestamp) ||
        Math.abs(Date.now() - envelope.timestamp) > 300000 ||
        typeof envelope.payload !== "string" ||
        typeof envelope.signature !== "string") return reply({ok:false, error:"unauthorized"});
    var bytes = Utilities.computeHmacSha256Signature(
      envelope.timestamp + "." + envelope.payload, secret, Utilities.Charset.UTF_8);
    var expected = bytes.map(function (b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
    var mismatch = expected.length ^ envelope.signature.length;
    for (var i=0;i<expected.length;i++) mismatch |= expected.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (mismatch) return reply({ok:false, error:"unauthorized"});
    var job = JSON.parse(envelope.payload);
    if (!/^[a-f0-9-]{36}$/.test(job.id) || !/^[A-Za-z0-9._%+!-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(job.to) ||
        job.to.length > 254 || !/^DND-[A-Z0-9]+$/.test(job.ref) ||
        !["pending","confirmed","cancelled"].includes(job.status) ||
        !["court","openplay"].includes(job.type) || !["gcash","counter"].includes(job.payment) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(job.date) || !Number.isFinite(job.total) ||
        !Number.isInteger(job.start_hour) || !Number.isInteger(job.end_hour)) return reply({ok:false,error:"invalid"});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return reply({ok:false,error:"busy"});
    var key = "MAIL_" + job.id;
    var existing = props.getProperty(key);
    if (existing) {
      if (existing.indexOf("sent:") === 0) return reply({ok:true, duplicate:true});
      return reply({ok:false,error:"uncertain"});
    }
    if (MailApp.getRemainingDailyQuota() < 1) return reply({ok:false,error:"quota"});
    // Keep replay protection seven days; server only retries jobs under six days.
    var values = props.getProperties();
    Object.keys(values).forEach(function (name) {
      if (name.indexOf("MAIL_") === 0 && Number(values[name].split(":")[1]) < Date.now()-7*86400000) props.deleteProperty(name);
    });
    function hour(n) { return (n % 12 || 12) + ":00 " + (n < 12 ? "AM" : "PM"); }
    var schedule = hour(job.start_hour) + "–" + hour(job.end_hour);
    if (job.type === "court" && Array.isArray(job.slots)) {
      schedule = job.slots.map(function (s) { return "Court " + Number(s.court) + ": " + hour(Number(s.hour)) + "–" + hour(Number(s.hour)+1); }).join("\n");
    }
    var statusText = {pending:"Booking received — pending confirmation",confirmed:"Booking confirmed",cancelled:"Booking cancelled"}[job.status];
    var body = statusText + "\n\nReference: " + job.ref + "\nDate: " + job.date + " (Philippine time)\n" +
      "Type: " + (job.type === "court" ? "Court rental" : "Open Play") + "\n" + schedule +
      "\nBooking total: PHP " + job.total.toFixed(2) + "\nPayment method: " + (job.payment === "gcash" ? "GCash" : "Over the Counter") +
      "\n\n" + (job.status === "pending" ? "This email is not proof of verified payment. Please wait for team confirmation.\n" : "") +
      (job.status === "cancelled" ? "Cancellation does not mean a refund has been processed. Contact the team regarding payment.\n" : "") +
      "\nCustomer-requested cancellations after verified GCash payment are non-refundable, subject to applicable consumer rights. " +
      "For venue cancellations, duplicate payments or payment without a secured slot, contact the team for an appropriate refund or agreed reschedule.\n" +
      "Unpaid counter bookings: message us to cancel. Staff may release a no-show slot 15 minutes after the booked start if you have not contacted us.\n\n" +
      "Questions? Reply to this business email or message https://www.facebook.com/dinksNdrinks\n" +
      "If you did not make this booking, contact us. Do not send passwords or verification codes.";
    // Mark before sending. An uncertain send is NOT retried blindly.
    props.setProperty(key,"sending:" + Date.now());
    MailApp.sendEmail({to:job.to, subject:"Dinks & Drinks — " + statusText + " | " + job.ref,
      body:body,name:"Dinks & Drinks",replyTo:"dinksdrinks.bookings@gmail.com"});
    props.setProperty(key,"sent:" + Date.now());
    return reply({ok:true});
  } catch (err) {
    return reply({ok:false,error:"send_failed"});
  } finally {
    if (lock) lock.releaseLock();
  }
}
