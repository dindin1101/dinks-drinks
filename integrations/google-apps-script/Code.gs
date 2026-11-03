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
    if ((job.email_message != null && (typeof job.email_message !== "string" || job.email_message.length > 1600)) ||
        (job.email_footer != null && (typeof job.email_footer !== "string" || job.email_footer.length > 800))) return reply({ok:false,error:"invalid"});
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
    function hour(n) { return (n % 12 || 12) + ":00 " + (n < 12 || n === 24 ? "AM" : "PM"); }
    var schedule = hour(job.start_hour) + "–" + hour(job.end_hour);
    if (job.type === "court" && Array.isArray(job.slots)) {
      schedule = job.slots.map(function (s) { return "Court " + Number(s.court) + ": " + hour(Number(s.hour)) + "–" + hour(Number(s.hour)+1); }).join("\n");
    }
    var statusText = {pending:"Booking received — pending confirmation",confirmed:"Booking confirmed",cancelled:"Booking cancelled"}[job.status];
    var defaults = {
      pending: "Thank you for booking with Dinks & Drinks. We have received your request and will review it shortly.",
      confirmed: "Your booking is confirmed. Please arrive 15 minutes before your scheduled game and keep your reference handy.",
      cancelled: "Your booking has been cancelled. Please contact our team if you have questions about your booking or payment."
    };
    var message = job.email_message || defaults[job.status];
    var footer = job.email_footer || "Questions? Reply to this business email or message https://www.facebook.com/dinksNdrinks";
    var dateParts = job.date.split("-");
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var displayDate = months[Number(dateParts[1])-1] + ". " + dateParts[2] + ", " + dateParts[0];
    var body = statusText + "\n\n" + message + "\n\nReference: " + job.ref + "\nDate: " + displayDate + " (Philippine time)\n" +
      "Type: " + (job.type === "court" ? "Court rental" : "Open Play") + "\n" + schedule +
      "\nBooking total: PHP " + job.total.toFixed(2) + "\nPayment method: " + (job.payment === "gcash" ? "GCash" : "Over the Counter") +
      "\n\n" + (job.status === "pending" ? "This email is not proof of verified payment. Please wait for team confirmation.\n" : "") +
      (job.status === "cancelled" ? "Cancellation does not mean a refund has been processed. Contact the team regarding payment.\n" : "") +
      "\n" + footer + "\n\n" +
      "If you did not make this booking, contact us. Do not send passwords or verification codes.";
    // Gmail-compatible inline HTML; every editable/dynamic value is escaped.
    function escapeHtml(value) {
      return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function multiline(value) { return escapeHtml(value).replace(/\r?\n/g, "<br>"); }
    function detail(label, value) {
      return '<tr><td style="padding:12px 0;border-bottom:1px solid #e5e9ed;width:36%;font-size:13px;color:#627183;vertical-align:top">' + escapeHtml(label) +
        '</td><td style="padding:12px 0 12px 12px;border-bottom:1px solid #e5e9ed;font-size:14px;color:#1f3a57;vertical-align:top;overflow-wrap:anywhere">' + multiline(value) + '</td></tr>';
    }
    var statusLabel = {pending:"Pending confirmation", confirmed:"Confirmed", cancelled:"Cancelled"}[job.status];
    var heading = {pending:"We received your booking", confirmed:"Your court time is confirmed", cancelled:"Your booking has been cancelled"}[job.status];
    if (job.type === "openplay" && job.status === "confirmed") heading = "Your Open Play booking is confirmed";
    var notice = job.status === "cancelled" ? "Cancellation does not mean a refund has been processed. Contact the team regarding payment." :
      job.status === "pending" ? "This email is not proof of verified payment. Please wait for team confirmation." :
      "This confirms your booking schedule. Keep your reference handy; contact our team for any payment questions.";
    var chipColor = job.status === "cancelled" ? "#f5e7e4" : job.status === "confirmed" ? "#edf5dc" : "#fff3cd";
    var htmlBody = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body style="margin:0;padding:0;background:#f7f5ee;color:#1f3a57;font-family:Arial,Helvetica,sans-serif;font-weight:400">' +
      '<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden">' + escapeHtml(statusText + " · " + job.ref) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5ee"><tr><td align="center" style="padding:28px 12px">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e3e6df;border-radius:16px;overflow:hidden">' +
      '<tr><td style="background:#11263c;padding:28px 28px 24px;border-bottom:4px solid #9cc93e">' +
      '<p style="margin:0;color:#ffffff;font-size:25px;line-height:1.3">Dinks <span style="color:#9cc93e">&amp;</span> Drinks</p>' +
      '<p style="margin:7px 0 0;color:#c5d4e2;font-size:11px;letter-spacing:2px">PICKLEBALL ZONE</p></td></tr>' +
      '<tr><td style="padding:28px"><span style="display:inline-block;background:' + chipColor + ';color:#1f3a57;padding:7px 12px;border-radius:20px;font-size:12px">' + escapeHtml(statusLabel) + '</span>' +
      '<h1 style="margin:18px 0 12px;font-size:25px;line-height:1.3;font-weight:400;color:#1f3a57">' + escapeHtml(heading) + '</h1>' +
      '<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#526273">' + multiline(message) + '</p>' +
      '<div style="background:#f7f5ee;border-radius:10px;padding:18px;margin-bottom:12px"><p style="margin:0 0 7px;font-size:11px;letter-spacing:1px;color:#627183">BOOKING REFERENCE</p>' +
      '<p style="margin:0;font-size:21px;letter-spacing:1px;color:#1f3a57">' + escapeHtml(job.ref) + '</p></div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      detail("Date", displayDate) + detail("Booking", job.type === "court" ? "Court rental" : "Open Play") +
      detail("Schedule", schedule) + detail("Payment method", job.payment === "gcash" ? "GCash" : "Over the Counter") +
      detail("Booking total", "PHP " + job.total.toFixed(2)) + '</table>' +
      '<p style="margin:10px 0 22px;font-size:12px;color:#627183">All schedules are in Philippine time (UTC+8).</p>' +
      '<div style="background:#f2f6fa;border-left:3px solid #9cc93e;padding:14px 16px;font-size:13px;line-height:1.7;color:#3f5368">' + escapeHtml(notice) + '</div>' +
      '<p style="margin:24px 0 18px;font-size:14px;line-height:1.7;color:#526273">' + multiline(footer) + '</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#1f3a57">' +
      '<a href="https://www.facebook.com/dinksNdrinks" style="display:inline-block;padding:13px 19px;color:#ffffff;font-size:14px;text-decoration:none">Message our team</a></td></tr></table>' +
      '<p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#627183">You can also reply directly to this email.</p></td></tr>' +
      '<tr><td style="padding:20px 28px;background:#f7f5ee;border-top:1px solid #e3e6df;font-size:11px;line-height:1.8;color:#627183">' +
      'If you did not make this booking, contact us. Do not send passwords or verification codes.<br>Dinks &amp; Drinks · Brgy. Magsaysay, Naguilian, Isabela</td></tr>' +
      '</table></td></tr></table></body></html>';
    // Mark before sending. An uncertain send is NOT retried blindly.
    props.setProperty(key,"sending:" + Date.now());
    MailApp.sendEmail({to:job.to, subject:"Dinks & Drinks — " + statusText + " | " + job.ref,
      body:body,htmlBody:htmlBody,name:"Dinks & Drinks",replyTo:"dinksdrinks.bookings@gmail.com"});
    props.setProperty(key,"sent:" + Date.now());
    return reply({ok:true});
  } catch (err) {
    return reply({ok:false,error:"send_failed"});
  } finally {
    if (lock) lock.releaseLock();
  }
}
