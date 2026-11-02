/* Dinks & Drinks — bookings dashboard (list, filters, status updates) */
(function () {
  "use strict";
  var D = window.DND, ADMIN = window.ADMIN;
  var $ = function (id) { return document.getElementById(id); };
  var allBookings = [];

  function slotText(b) {
    if (b.booking_type === "openplay") {
      return "Open Play " + D.hourShort(Number(b.start_hour)) + "–" + D.hourShort(Number(b.end_hour)) +
        " · " + (b.pax || "?") + " pax";
    }
    var byCourt = {};
    (b.slots || []).forEach(function (sl) {
      (byCourt[sl.court] = byCourt[sl.court] || []).push(Number(sl.hour));
    });
    var parts = [];
    Object.keys(byCourt).sort().forEach(function (c) {
      var hrs = byCourt[c].sort(function (a, bb) { return a - bb; });
      var ranges = [], start = hrs[0], prev = hrs[0];
      for (var i = 1; i <= hrs.length; i++) {
        if (hrs[i] === prev + 1) { prev = hrs[i]; continue; }
        ranges.push(D.hourShort(start) + "–" + D.hourShort(prev + 1));
        start = hrs[i]; prev = hrs[i];
      }
      parts.push("Court " + c + " " + ranges.join(", "));
    });
    return parts.length ? parts.join(" · ") :
      "Court " + (b.court_number || "?") + " " + D.hourShort(Number(b.start_hour)) + "–" + D.hourShort(Number(b.end_hour));
  }

  function applyFilters(list) {
    var fd = $("fDate").value, fs = $("fStatus").value, ft = $("fType").value,
      q = $("fSearch").value.trim().toLowerCase();
    return list.filter(function (b) {
      if (fd && b.date !== fd) return false;
      if (fs && b.status !== fs) return false;
      if (ft && b.booking_type !== ft) return false;
      if (q) {
        var hay = ((b.customer_name || "") + " " + (b.mobile || "") + " " + (b.booking_ref || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderStats() {
    var today = D.isoDate(new Date());
    var active = allBookings.filter(function (b) { return b.status !== "cancelled"; });
    $("statToday").textContent = active.filter(function (b) { return b.date === today; }).length;
    $("statPending").textContent = active.filter(function (b) { return b.status === "pending" && b.date >= today; }).length;
    $("statUpcoming").textContent = active.filter(function (b) { return b.date >= today; }).length;
    var rev = allBookings
      .filter(function (b) { return b.status === "confirmed" && b.date >= today; })
      .reduce(function (sum, b) { return sum + Number(b.total_amount || 0); }, 0);
    $("statRevenue").textContent = D.peso(rev);
  }

  function renderList() {
    var list = applyFilters(allBookings).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return Number(a.start_hour) - Number(b.start_hour);
    });
    var box = $("bkList");
    box.innerHTML = "";
    $("bkEmpty").hidden = list.length > 0;
    var today = D.isoDate(new Date());

    list.forEach(function (b) {
      var card = document.createElement("div");
      card.className = "bk-card" + (b.date === today ? " is-today" : "") + (b.status === "cancelled" ? " is-dead" : "");
      var payTxt = b.payment_method === "gcash"
        ? "📱 GCash" + (b.gcash_ref ? " · Ref: <strong>" + D.esc(b.gcash_ref) + "</strong>" : "")
        : "🧾 Over the Counter";
      var dayTag = b.date === today ? ' <span class="day-tag">TODAY</span>' : "";
      card.innerHTML =
        '<div class="bk-main">' +
          '<span class="bk-ref">' + D.esc(b.booking_ref) + "</span> " +
          '<span class="status-pill st-' + D.esc(b.status) + '">' + D.esc(b.status) + "</span>" + dayTag + "<br>" +
          "<strong>" + D.esc(b.customer_name) + "</strong> · 📱 " + D.esc(b.mobile) + "<br>" +
          (b.booking_type === "court" ? "🏟️ " : "👥 ") + D.esc(slotText(b)) + "<br>" +
          "📅 " + D.friendlyDate(b.date) + "<br>" +
          "🏓 Paddles: " + (b.rent_paddle ? "Yes ×" + b.paddle_qty + " (" + D.peso(b.paddle_amount) + ")" : "No") + "<br>" +
          payTxt + " · 💰 <strong>" + D.peso(b.total_amount) + "</strong>" +
          (b.notes ? "<br>📝 " + D.esc(b.notes) : "") +
        "</div>" +
        '<div class="bk-actions"></div>';
      var act = card.querySelector(".bk-actions");
      function addBtn(label, cls, fn) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-sm " + cls;
        btn.textContent = label;
        btn.addEventListener("click", fn);
        act.appendChild(btn);
      }
      if (b.status !== "confirmed") addBtn("✅ Confirm", "btn-lime", function () { setStatus(b.id, "confirmed"); });
      if (b.status !== "pending") addBtn("⏳ Pending", "btn-dark", function () { setStatus(b.id, "pending"); });
      if (b.status !== "cancelled") addBtn("❌ Cancel", "btn-dark", function () {
        if (window.confirm("Cancel booking " + b.booking_ref + "? This frees the slot.")) setStatus(b.id, "cancelled");
      });
      box.appendChild(card);
    });
    renderStats();
  }

  function setStatus(id, status) {
    D.adminUpdateStatus(id, status).then(function (res) {
      if (!res.ok) { ADMIN.toast("⚠️ Failed to update. Check connection / login."); return; }
      allBookings = allBookings.map(function (b) {
        if (b.id === id) b.status = status;
        return b;
      });
      renderList();
      ADMIN.toast("✅ Booking marked " + status + ".");
    });
  }

  function load() {
    $("bkList").innerHTML = '<p class="hint">⏳ Loading bookings…</p>';
    // Demo mode: make sure the sample bookings exist so the dashboard isn't empty.
    var ready = Promise.resolve();
    if (!D.HAS_SUPABASE) {
      var st = D.DEFAULT_SETTINGS;
      ready = Promise.all([-21, -14, -7, -1, 0, 1, 2, 3].map(function (i) {
        var d = new Date(); d.setDate(d.getDate() + i);
        return D.fetchAvailability(D.isoDate(d), st);
      }));
    }
    return ready.then(function () { return D.adminListBookings(); }).then(function (list) {
      allBookings = list || [];
      renderList();
    }).catch(function (err) {
      console.error(err);
      $("bkList").innerHTML = '<p class="form-error">Could not load bookings. If you just connected Supabase, make sure you ran the SQL in supabase/schema.sql and you are logged in as the admin user.</p>';
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ADMIN.requireLogin(function (user) {
      ADMIN.initShell({ active: "dashboard" }, user);
      $("dashView").hidden = false;
      ["fDate", "fStatus", "fType"].forEach(function (id) { $(id).addEventListener("change", renderList); });
      $("fSearch").addEventListener("input", renderList);
      $("clearFilters").addEventListener("click", function () {
        $("fDate").value = ""; $("fStatus").value = ""; $("fType").value = ""; $("fSearch").value = "";
        renderList();
      });
      $("refreshBtn").addEventListener("click", function () {
        load().then(function () { ADMIN.toast("🔄 Bookings refreshed."); });
      });
      load();
    });
  });
})();
