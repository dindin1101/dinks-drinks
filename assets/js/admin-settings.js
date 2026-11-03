/* Dinks & Drinks — business settings (prices, GCash, hours, courts) */
(function () {
  "use strict";
  var D = window.DND, ADMIN = window.ADMIN;
  var $ = function (id) { return document.getElementById(id); };
  var settings = null;
  var emailFields = { pending: "setEmailPending", confirmed: "setEmailConfirmed", cancelled: "setEmailCancelled" };
  function previewEmail() {
    var status = $("emailPreviewStatus").value;
    var titles = { pending: "Booking received — pending confirmation", confirmed: "Booking confirmed", cancelled: "Booking cancelled" };
    var total = (Number($("setCourtRate").value) || 0) + (Number($("setPaddleRate").value) || 0);
    $("emailPreview").textContent = "Subject: Dinks & Drinks — " + titles[status] + " | DND-EXAMPLE\n\n" + titles[status] +
      "\n\n" + $(emailFields[status]).value.trim() + "\n\nReference: DND-EXAMPLE\nDate: [booking date] (Philippine time)\nType: Court rental\nCourt 1: [selected hour]\nBooking total: " + D.peso(total) + "\nPayment method: Over the Counter\n\n" +
      (status === "pending" ? "This email is not proof of verified payment. Please wait for team confirmation.\n\n" : "") +
      (status === "cancelled" ? "Cancellation does not mean a refund has been processed. Contact the team regarding payment.\n\n" : "") +
      $("setEmailFooter").value.trim() + "\n\nIf you did not make this booking, contact us. Do not send passwords or verification codes.";
  }

  function fillForm(s) {
    Object.keys(emailFields).forEach(function (status) { $(emailFields[status]).value = s["email_" + status + "_message"] || D.DEFAULT_SETTINGS["email_" + status + "_message"]; });
    $("setEmailFooter").value = s.email_footer || D.DEFAULT_SETTINGS.email_footer;
    $("setGcashQr").value = s.gcash_qr_url || "";
    $("setGcashNumber").value = s.gcash_number;
    $("setGcashName").value = s.gcash_name;
    $("setCourtRate").value = s.court_rate;
    $("setOpenRate").value = s.openplay_rate;
    $("setPaddleRate").value = s.paddle_rate;
    $("setBallRate").value = s.ball_rate == null ? 50 : s.ball_rate;
    $("setPaddlePer").value = s.paddle_per;
    $("setCourts").value = s.courts;
    $("setCapacity").value = s.openplay_capacity;
    $("setCourtOpenHour").value = s.court_open_hour;
    $("setCourtCloseHour").value = s.court_close_hour;
    $("setOpenHour").value = s.open_hour;
    $("setCloseHour").value = s.close_hour;
    previewEmail();
  }

  function save() {
    var rates = [Number($("setCourtRate").value), Number($("setOpenRate").value), Number($("setPaddleRate").value), Number($("setBallRate").value)];
    if (["setCourtRate", "setOpenRate", "setPaddleRate", "setBallRate"].some(function (id) { return $(id).value.trim() === ""; }) || rates.some(function (n) { return !isFinite(n) || n < 0 || n > 1000000 || n % 1 !== 0; }) || rates[0] <= 0 || rates[1] <= 0 || rates[3] <= 0) {
      ADMIN.toast("Enter rates in whole pesos. Court and Open Play rates must be greater than zero; paddle rental may be zero."); return;
    }
    var texts = {};
    var invalidText = false;
    Object.keys(emailFields).forEach(function (status) {
      var text = $(emailFields[status]).value.trim();
      if (!text || text.length > 1600) invalidText = true;
      texts["email_" + status + "_message"] = text;
    });
    texts.email_footer = $("setEmailFooter").value.trim();
    if (invalidText || !texts.email_footer || texts.email_footer.length > 800) {
      ADMIN.toast("Complete each email message (up to 1600 characters) and footer (up to 800)."); return;
    }
    var cOpenH = Number($("setCourtOpenHour").value), cCloseH = Number($("setCourtCloseHour").value);
    var openH = Number($("setOpenHour").value), closeH = Number($("setCloseHour").value);
    if (!(cOpenH >= 0 && cCloseH > cOpenH && cCloseH <= 24)) {
      ADMIN.toast("⚠️ Check the court hours (closing must be after opening)."); return;
    }
    if (!(openH >= 0 && closeH > openH && closeH <= 24)) {
      ADMIN.toast("⚠️ Check the open play hours (end must be after start)."); return;
    }
    var qr = $("setGcashQr").value.trim();
    if (qr && !/^https:\/\//i.test(qr)) { ADMIN.toast("Use an HTTPS QR image URL."); return; }
    var next = Object.assign({}, settings, texts, {
      gcash_qr_url: qr,
      gcash_number: $("setGcashNumber").value.trim(),
      gcash_name: $("setGcashName").value.trim(),
      court_rate: rates[0],
      openplay_rate: rates[1],
      paddle_rate: rates[2],
      ball_rate: rates[3],
      openplay_sessions: [{ id: "openplay", label: "Open Play", start_hour: openH, end_hour: closeH }],
      paddle_per: $("setPaddlePer").value,
      courts: Number($("setCourts").value) || 3,
      openplay_capacity: Number($("setCapacity").value) || 24,
      court_open_hour: cOpenH,
      court_close_hour: cCloseH,
      open_hour: openH,
      close_hour: closeH
    });
    $("saveSettingsBtn").disabled = true;
    D.saveSettings(next).then(function (res) {
      $("saveSettingsBtn").disabled = false;
      if (res.ok) {
        settings = next;
        $("settingsSaved").hidden = false;
        setTimeout(function () { $("settingsSaved").hidden = true; }, 3000);
        ADMIN.toast("💾 Settings saved!");
      } else {
        console.error(res.error);
        ADMIN.toast("⚠️ Could not save settings (must be logged in as admin).");
      }
    }).catch(function () {
      $("saveSettingsBtn").disabled = false;
      ADMIN.toast("Could not save settings. Please check your connection and try again.");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ADMIN.requireLogin(function (user) {
      ADMIN.initShell({ active: "settings" }, user);
      $("setView").hidden = false;
      D.loadSettings().then(function (s) {
        settings = s;
        fillForm(s);
      });
      ["setEmailPending", "setEmailConfirmed", "setEmailCancelled", "setEmailFooter", "setCourtRate", "setPaddleRate"].forEach(function (id) { $(id).addEventListener("input", previewEmail); });
      $("emailPreviewStatus").addEventListener("change", previewEmail);
      $("saveSettingsBtn").addEventListener("click", save);
    });
  });
})();
