/* Dinks & Drinks — business settings (prices, GCash, hours, courts) */
(function () {
  "use strict";
  var D = window.DND, ADMIN = window.ADMIN;
  var $ = function (id) { return document.getElementById(id); };
  var settings = null;

  function fillForm(s) {
    $("setGcashNumber").value = s.gcash_number;
    $("setGcashName").value = s.gcash_name;
    $("setCourtRate").value = s.court_rate;
    $("setOpenRate").value = s.openplay_rate;
    $("setPaddleRate").value = s.paddle_rate;
    $("setPaddlePer").value = s.paddle_per;
    $("setCourts").value = s.courts;
    $("setCapacity").value = s.openplay_capacity;
    $("setCourtOpenHour").value = s.court_open_hour;
    $("setCourtCloseHour").value = s.court_close_hour;
    $("setOpenHour").value = s.open_hour;
    $("setCloseHour").value = s.close_hour;
  }

  function save() {
    var cOpenH = Number($("setCourtOpenHour").value), cCloseH = Number($("setCourtCloseHour").value);
    var openH = Number($("setOpenHour").value), closeH = Number($("setCloseHour").value);
    if (!(cOpenH >= 0 && cCloseH > cOpenH && cCloseH <= 24)) {
      ADMIN.toast("⚠️ Check the court hours (closing must be after opening)."); return;
    }
    if (!(openH >= 0 && closeH > openH && closeH <= 24)) {
      ADMIN.toast("⚠️ Check the open play hours (end must be after start)."); return;
    }
    var next = Object.assign({}, settings, {
      gcash_number: $("setGcashNumber").value.trim(),
      gcash_name: $("setGcashName").value.trim(),
      court_rate: Number($("setCourtRate").value) || 0,
      openplay_rate: Number($("setOpenRate").value) || 0,
      paddle_rate: Number($("setPaddleRate").value) || 0,
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
      $("saveSettingsBtn").addEventListener("click", save);
    });
  });
})();
