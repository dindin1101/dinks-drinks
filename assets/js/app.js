/* Dinks & Drinks Pickleball Zone — customer booking page logic */
(function () {
  "use strict";
  var D = window.DND;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    settings: null,
    type: "court",                 // "court" | "openplay"
    date: D.isoDate(new Date()),
    selected: {},                  // key "court-hour" -> true
    dayBookings: [],
    sessionId: null,
    pax: 2,
    rentPaddle: false,
    paddleQty: 2,
    payment: "gcash",
    lastBookingText: "",
    attemptFingerprint: "",
    attemptRef: ""
  };

  /* ---------- toast ---------- */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- static texts from settings ---------- */
  function applySettingsTexts() {
    var s = state.settings;
    if ($("heroCourts")) $("heroCourts").textContent = s.courts + " courts";
    if ($("chipCourtRate")) $("chipCourtRate").textContent = D.peso(s.court_rate) + "/hr";
    if ($("chipOpenRate")) $("chipOpenRate").textContent = D.peso(s.openplay_rate) + "/pax";
    if ($("chipPaddleRate")) $("chipPaddleRate").textContent = D.peso(s.paddle_rate);
    if ($("chipCourtHours")) $("chipCourtHours").textContent = D.hourLabel(s.court_open_hour) + " – " + D.hourLabel(s.court_close_hour);
    if ($("chipOpenHours")) $("chipOpenHours").textContent = D.hourLabel(s.open_hour) + " – " + D.hourLabel(s.close_hour);
    if ($("rateCourt")) $("rateCourt").textContent = D.peso(s.court_rate);
    if ($("rateOpen")) $("rateOpen").textContent = D.peso(s.openplay_rate);
    if ($("ratePaddle")) $("ratePaddle").textContent = D.peso(s.paddle_rate);
    if ($("typeCourtSub")) $("typeCourtSub").textContent = D.peso(s.court_rate) + " per court / hour";
    if ($("typeOpenSub")) $("typeOpenSub").textContent = D.peso(s.openplay_rate) + " per person / session";
    if ($("paddleRateHint")) $("paddleRateHint").textContent = "(" + D.peso(s.paddle_rate) + " each" +
      (s.paddle_per === "hour" ? " / hour" : "") + ")";
    if ($("gcashNumber")) $("gcashNumber").textContent = s.gcash_number;
    if ($("gcashName")) $("gcashName").textContent = s.gcash_name;
    if ($("fbBtn")) $("fbBtn").href = s.facebook_url;
    if ($("messengerBtn")) $("messengerBtn").href = s.messenger_url;
    if ($("gcashQrImage") && /^https:\/\//i.test(s.gcash_qr_url || "")) {
      $("gcashQrImage").src = s.gcash_qr_url;
      $("gcashQrBox").hidden = false;
      $("gcashQrImage").onerror = function () { $("gcashQrBox").hidden = true; };
    }
    if (!D.HAS_SUPABASE) $("demoBanner").hidden = false;
  }

  /* ---------- date chips ---------- */
  function buildDateChips() {
    var box = $("dateChips");
    box.innerHTML = "";
    var today = new Date();
    for (var i = 0; i < 14; i++) {
      (function (d) {
        var iso = D.isoDate(d);
        var b = document.createElement("button");
        b.type = "button";
        b.className = "date-chip" + (iso === state.date ? " is-active" : "");
        b.dataset.date = iso;
        b.innerHTML =
          '<span class="d-dow">' + (i === 0 ? "Today" : d.toLocaleDateString("en-PH", { weekday: "short" })) + "</span>" +
          '<span class="d-num">' + d.getDate() + "</span>" +
          '<span class="d-mon">' + d.toLocaleDateString("en-PH", { month: "short" }) + "</span>";
        b.addEventListener("click", function () { setDate(iso); });
        box.appendChild(b);
      })(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    }
    var inp = $("dateInput");
    inp.min = D.isoDate(today);
    inp.value = state.date;
    $("selDateLabel").textContent = D.friendlyDate(state.date);
  }

  function setDate(iso) {
    state.date = iso;
    state.selected = {};
    document.querySelectorAll(".date-chip").forEach(function (c) {
      c.classList.toggle("is-active", c.dataset.date === iso);
    });
    $("dateInput").value = iso;
    $("selDateLabel").textContent = D.friendlyDate(iso);
    refreshAvailability();
  }

  /* ---------- availability ---------- */
  function bookedSlotSet() {
    var set = {};
    state.dayBookings.forEach(function (b) {
      if (b.booking_type !== "court") return;
      (b.slots || []).forEach(function (sl) { set[sl.court + "-" + sl.hour] = true; });
    });
    return set;
  }
  function openPlayTaken(session) {
    var n = 0;
    state.dayBookings.forEach(function (b) {
      if (b.booking_type === "openplay" && Number(b.start_hour) === session.start_hour) {
        n += Number(b.pax || 0);
      }
    });
    return n;
  }
  function isPastSlot(hour) {
    var now = new Date();
    if (state.date !== D.isoDate(now)) return false;
    return hour <= now.getHours();
  }

  function refreshAvailability() {
    $("slotGrid").innerHTML = '<p class="hint">⏳ Loading availability…</p>';
    return D.fetchAvailability(state.date, state.settings).then(function (rows) {
      state.dayBookings = rows || [];
      renderSlotGrid();
      renderSessions();
      renderSummary();
    }).catch(function (err) {
      $("slotGrid").textContent = "Availability could not load. Please refresh before choosing a slot.";
      state.selected = {};
      showError(err.message);
    });
  }

  /* ---------- slot grid (court rental) ---------- */
  function renderSlotGrid() {
    var s = state.settings;
    var grid = $("slotGrid");
    var booked = bookedSlotSet();
    grid.style.gridTemplateColumns = "88px repeat(" + s.courts + ", 1fr)";
    var html = '<div></div>';
    for (var c = 1; c <= s.courts; c++) html += '<div class="slot-head">Court ' + c + "</div>";
    for (var h = s.court_open_hour; h < s.court_close_hour; h++) {
      html += '<div class="slot-time">' + D.hourShort(h) + "–" + D.hourShort(h + 1) + "</div>";
      for (var cc = 1; cc <= s.courts; cc++) {
        var key = cc + "-" + h;
        var cls = "slot-btn", label = D.peso(s.court_rate), dis = "";
        if (booked[key]) { cls += " is-booked"; label = "Booked"; dis = " disabled"; }
        else if (isPastSlot(h)) { cls += " is-past"; label = "Past"; dis = " disabled"; }
        else if (state.selected[key]) { cls += " is-selected"; label = "✓ " + D.peso(s.court_rate); }
        html += '<button type="button" class="' + cls + '" data-key="' + key + '"' + dis + ">" + label + "</button>";
      }
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".slot-btn:not(:disabled)").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.dataset.key;
        if (state.selected[k]) delete state.selected[k]; else state.selected[k] = true;
        renderSlotGrid();
        renderSummary();
      });
    });
    var n = Object.keys(state.selected).length;
    var msg = $("slotMsg");
    if (state.type === "court") {
      msg.hidden = false;
      msg.className = "hint";
      msg.textContent = n === 0
        ? "No slot selected yet — tap a green slot above."
        : "✅ " + n + " hour-slot" + (n > 1 ? "s" : "") + " selected.";
    } else msg.hidden = true;
  }

  /* ---------- open play sessions ---------- */
  function renderSessions() {
    var s = state.settings;
    var box = $("sessionList");
    box.innerHTML = "";
    s.openplay_sessions.forEach(function (sess) {
      var taken = openPlayTaken(sess);
      var left = Math.max(0, s.openplay_capacity - taken);
      var past = state.date === D.isoDate(new Date()) && sess.end_hour <= new Date().getHours();
      var full = left <= 0 || past;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "session-card" + (state.sessionId === sess.id ? " is-active" : "") + (full ? " is-full" : "");
      b.innerHTML =
        '<span class="s-label">' + D.esc(sess.label) + "</span>" +
        '<span class="s-time">' + D.hourLabel(sess.start_hour) + " – " + D.hourLabel(sess.end_hour) + "</span>" +
        '<span class="s-spots">' + (past ? "⏱ Session ended" : full ? "🔴 Full" : "🟢 " + left + " slots left") + "</span>";
      if (!full) b.addEventListener("click", function () {
        state.sessionId = sess.id;
        renderSessions(); renderSummary();
      });
      box.appendChild(b);
    });
  }

  /* ---------- totals & summary ---------- */
  function selectedSlotsArr() {
    return Object.keys(state.selected).map(function (k) {
      var p = k.split("-");
      return { court: Number(p[0]), hour: Number(p[1]) };
    }).sort(function (a, b) { return a.court - b.court || a.hour - b.hour; });
  }
  function slotSummaryText(slots) {
    var byCourt = {};
    slots.forEach(function (sl) { (byCourt[sl.court] = byCourt[sl.court] || []).push(sl.hour); });
    var parts = [];
    Object.keys(byCourt).sort().forEach(function (c) {
      var hrs = byCourt[c].sort(function (a, b) { return a - b; });
      var ranges = [], start = hrs[0], prev = hrs[0];
      for (var i = 1; i <= hrs.length; i++) {
        if (hrs[i] === prev + 1) { prev = hrs[i]; continue; }
        ranges.push(D.hourShort(start) + "–" + D.hourShort(prev + 1));
        start = hrs[i]; prev = hrs[i];
      }
      parts.push("Court " + c + ": " + ranges.join(", "));
    });
    return parts.join(" · ");
  }
  function currentSession() {
    return state.settings.openplay_sessions.find(function (x) { return x.id === state.sessionId; }) || null;
  }
  function computeTotals() {
    var s = state.settings;
    var t = { court: 0, paddle: 0, total: 0, hours: 0, desc: "" };
    if (state.type === "court") {
      var slots = selectedSlotsArr();
      t.hours = slots.length;
      t.court = slots.length * s.court_rate;
      t.desc = slots.length ? slotSummaryText(slots) : "No slot selected";
    } else {
      var sess = currentSession();
      t.hours = sess ? (sess.end_hour - sess.start_hour) : 0;
      t.court = state.pax * s.openplay_rate;
      t.desc = sess ? sess.label + " " + D.hourShort(sess.start_hour) + "–" + D.hourShort(sess.end_hour) : "No session selected";
    }
    if (state.rentPaddle) {
      t.paddle = state.paddleQty * s.paddle_rate * (s.paddle_per === "hour" ? Math.max(1, t.hours) : 1);
    }
    t.total = t.court + t.paddle;
    return t;
  }

  function row(dt, dd) {
    return '<div class="row"><dt>' + dt + "</dt><dd>" + dd + "</dd></div>";
  }
  function renderSummary() {
    var s = state.settings;
    var t = computeTotals();
    var html = "";
    html += row("Type", state.type === "court" ? "🏟️ Court Rental" : "👥 Open Play");
    html += row("Date", D.friendlyDate(state.date));
    if (state.type === "court") {
      html += row("Court &amp; time", D.esc(t.desc));
      html += row("Court fee", t.hours + " hr × " + D.peso(s.court_rate) + " = " + D.peso(t.court));
    } else {
      html += row("Session", D.esc(t.desc));
      html += row("Open play fee", state.pax + " pax × " + D.peso(s.openplay_rate) + " = " + D.peso(t.court));
    }
    html += row("Rent paddle?", state.rentPaddle ? "Yes — " + state.paddleQty + " paddle(s)" : "No");
    if (state.rentPaddle) html += row("Paddle fee", D.peso(t.paddle));
    html += row("Payment", state.payment === "gcash" ? "📱 GCash" : "🧾 Over the Counter");
    $("summaryBody").innerHTML = html;
    $("summaryTotal").textContent = D.peso(t.total);
    $("gcashAmount").textContent = D.peso(t.total);
    $("counterAmount").textContent = D.peso(t.total);
  }

  /* ---------- type / paddle / payment toggles ---------- */
  function setType(type) {
    state.type = type;
    $("typeCourt").classList.toggle("is-active", type === "court");
    $("typeOpen").classList.toggle("is-active", type === "openplay");
    $("courtPanel").hidden = type !== "court";
    $("openPanel").hidden = type !== "openplay";
    $("playersCourtRow").hidden = type !== "court";
    renderSlotGrid();
    renderSummary();
  }
  function setRentPaddle(yes) {
    state.rentPaddle = yes;
    $("paddleYes").classList.toggle("is-active", yes);
    $("paddleNo").classList.toggle("is-active", !yes);
    $("paddleQtyRow").hidden = !yes;
    renderSummary();
  }
  function setPayment(pay) {
    state.payment = pay;
    $("payGcash").classList.toggle("is-active", pay === "gcash");
    $("payCounter").classList.toggle("is-active", pay === "counter");
    $("gcashBox").hidden = pay !== "gcash";
    $("counterBox").hidden = pay !== "counter";
    renderSummary();
  }
  function bindSteppers(inputId, minusId, plusId, get, set) {
    var inp = $(inputId);
    function commit(v) {
      v = Math.max(Number(inp.min || 1), Math.min(Number(inp.max || 99), Math.floor(v) || 1));
      inp.value = v;
      set(v);
      renderSummary();
    }
    $(minusId).addEventListener("click", function () { commit(get() - 1); });
    $(plusId).addEventListener("click", function () { commit(get() + 1); });
    inp.addEventListener("change", function () { commit(Number(inp.value)); });
  }

  /* ---------- submit ---------- */
  function showError(msg) {
    var e = $("formError");
    e.hidden = !msg;
    e.textContent = msg || "";
    if (msg) {
      e.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("⚠️ Please check your booking details.");
    }
  }

  function submitBooking() {
    if ($("confirmBtn").disabled) return;
    showError("");
    var protection;
    try { protection = window.DND_SECURITY.read(); }
    catch (err) { return showError(err.message); }
    var s = state.settings;
    var t = computeTotals();
    var name = $("custName").value.trim();
    var mobile = $("custMobile").value.replace(/[\s\-()]/g, "");
    if (/^639\d{9}$/.test(mobile)) mobile = "+" + mobile;
    var notes = $("custNotes").value.trim();
    var gcashRef = $("gcashRef").value.trim();
    if (state.payment === "gcash" && !$("gcashProof").files[0]) return showError("Please upload your GCash payment receipt.");

    if (state.type === "court" && t.hours === 0) return showError("Please select at least one court time slot (Step 3).");
    if (state.type === "openplay" && !currentSession()) return showError("Please pick an Open Play session (Step 3).");
    if (state.type === "openplay") {
      var sess0 = currentSession();
      var left = s.openplay_capacity - openPlayTaken(sess0);
      if (state.pax > left) return showError("Only " + left + " slot(s) left in that session. Please reduce players or pick another session.");
    }
    if (state.rentPaddle && state.paddleQty < 1) return showError("Please choose how many paddles to rent.");
    if (name.length < 2) return showError("Please enter your full name.");
    if (!/^(\+?63|0)9\d{9}$/.test(mobile)) return showError("Please enter a valid PH mobile number (e.g. 0917 123 4567).");
    if (state.payment === "gcash" && gcashRef.replace(/\D/g, "").length < 6)
      return showError("Please send your GCash payment first, then enter the GCash Reference Number.");
    if (t.total <= 0) return showError("Total is ₱0 — please complete your selection.");

    var btn = $("confirmBtn");
    btn.disabled = true;
    btn.textContent = "⏳ Saving booking…";

    // re-check availability right before saving (avoids most double-bookings)
    D.fetchAvailability(state.date, s).then(function (rows) {
      state.dayBookings = rows || [];
      if (state.type === "court") {
        var booked = bookedSlotSet();
        var conflict = selectedSlotsArr().some(function (sl) { return booked[sl.court + "-" + sl.hour]; });
        if (conflict) {
          btn.disabled = false; btn.textContent = "✅ Confirm Booking";
          state.selected = {};
          renderSlotGrid(); renderSummary();
          return showError("One of your slots was just booked. Choose another slot. If you already paid, contact us with your GCash reference before paying again.");
        }
      }

      var slots = selectedSlotsArr();
      var sess = currentSession();
      if (state.type === "openplay" && state.pax > s.openplay_capacity - openPlayTaken(sess)) {
        btn.disabled = false; btn.textContent = "✅ Confirm Booking";
        renderSessions(); renderSummary();
        return showError("Open Play availability has changed. Reduce players or choose another date. If already paid, contact us before paying again.");
      }
      var booking = {
        id: D.uid(),
        booking_ref: D.makeRef(),
        customer_name: name,
        mobile: mobile,
        booking_type: state.type,
        date: state.date,
        court_number: state.type === "court" && slots.length ? slots[0].court : null,
        start_hour: state.type === "court" ? Math.min.apply(null, slots.map(function (x) { return x.hour; })) : sess.start_hour,
        end_hour: state.type === "court" ? Math.max.apply(null, slots.map(function (x) { return x.hour; })) + 1 : sess.end_hour,
        slots: state.type === "court" ? slots : [],
        pax: state.type === "openplay" ? state.pax : (Number($("courtPax").value) || null),
        rent_paddle: state.rentPaddle,
        paddle_qty: state.rentPaddle ? state.paddleQty : 0,
        court_amount: t.court,
        paddle_amount: t.paddle,
        total_amount: t.total,
        payment_method: state.payment,
        gcash_ref: state.payment === "gcash" ? gcashRef : null,
        status: "pending",
        notes: notes,
        created_at: new Date().toISOString()
      };

      // Keep the same reference for an unchanged retry after a lost response.
      var fingerprintData = Object.assign({}, booking);
      delete fingerprintData.id;
      delete fingerprintData.booking_ref;
      delete fingerprintData.created_at;
      var fingerprint = JSON.stringify(fingerprintData);
      if (state.attemptFingerprint !== fingerprint) {
        state.attemptFingerprint = fingerprint;
        state.attemptRef = booking.booking_ref;
      }
      booking.booking_ref = state.attemptRef;

      return D.createBooking(booking, protection).then(function (res) {
        window.DND_SECURITY.reset();
        btn.disabled = false; btn.textContent = "✅ Confirm Booking";
        if (!res.ok) {
          console.error(res.error);
          if (res.error && (res.error.code === "SLOT_UNAVAILABLE" || res.error.code === "OPENPLAY_FULL")) {
            state.selected = {};
            refreshAvailability();
          }
          return showError(res.error && res.error.message || "Could not confirm your booking. Contact us before retrying if you already paid.");
        }
        showSuccess(booking, t);
      });
    }).catch(function (err) {
      console.error(err);
      window.DND_SECURITY.reset();
      btn.disabled = false; btn.textContent = "✅ Confirm Booking";
      showError(err.message || "Connection problem while saving. Please try again.");
    });
  }

  function showSuccess(b) {
    var s = state.settings;
    $("bookingApp").hidden = true;
    $("successView").hidden = false;
    $("successRef").textContent = b.booking_ref;
    $("successStatus").textContent = b.payment_method === "gcash"
      ? "Salamat, " + b.customer_name.split(" ")[0] + "! Your slot is reserved — we'll confirm once your GCash payment is verified. Show this code when you arrive:"
      : "Salamat, " + b.customer_name.split(" ")[0] + "! Your slot is reserved — please pay at the counter before your game and arrive 15 minutes early. Show this code when you arrive:";
    var when = b.booking_type === "court" ? slotSummaryText(b.slots)
      : currentSession().label + " " + D.hourShort(b.start_hour) + "–" + D.hourShort(b.end_hour) + " · " + b.pax + " pax";
    var html = "";
    html += row("Name", D.esc(b.customer_name));
    html += row("Mobile", D.esc(b.mobile));
    html += row("Type", b.booking_type === "court" ? "🏟️ Court Rental" : "👥 Open Play");
    html += row("Date", D.friendlyDate(b.date));
    html += row("Schedule", D.esc(when));
    html += row("Rent paddle", b.rent_paddle ? "Yes — " + b.paddle_qty + " paddle(s) (" + D.peso(b.paddle_amount) + ")" : "No");
    html += row("Payment", b.payment_method === "gcash" ? "📱 GCash · Ref: " + D.esc(b.gcash_ref || "") : "🧾 Over the Counter");
    html += row("Total", D.peso(b.total_amount));
    html += row("Status", "⏳ Pending confirmation");
    $("successBody").innerHTML = html;

    state.lastBookingText =
      "Hi Dinks & Drinks Pickleball Zone! 🎾 I just booked online.\n" +
      "Ref: " + b.booking_ref + "\n" +
      "Name: " + b.customer_name + " (" + b.mobile + ")\n" +
      "Type: " + (b.booking_type === "court" ? "Court Rental" : "Open Play") + "\n" +
      "Date: " + D.friendlyDate(b.date) + "\n" +
      "Schedule: " + when + "\n" +
      "Rent paddle: " + (b.rent_paddle ? "Yes x" + b.paddle_qty : "No") + "\n" +
      "Total: " + D.peso(b.total_amount) + " via " + (b.payment_method === "gcash" ? "GCash (Ref: " + (b.gcash_ref || "") + ")" : "Over the Counter") + "\n" +
      "📍 " + (s.location || "");
    $("successView").scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- init ---------- */
  function init() {
    D.loadSettings().then(function (settings) {
      state.settings = settings;
      if (settings.openplay_sessions && settings.openplay_sessions.length) {
        state.sessionId = settings.openplay_sessions[settings.openplay_sessions.length - 1].id;
      }
      applySettingsTexts();
      if (!$("bookingApp")) return;
      if (new URLSearchParams(window.location.search).get("type") === "openplay") {
        state.type = "openplay";
      }
      buildDateChips();

      $("dateInput").addEventListener("change", function () {
        if (this.value) setDate(this.value);
      });
      $("typeCourt").addEventListener("click", function () { setType("court"); });
      $("typeOpen").addEventListener("click", function () { setType("openplay"); });
      document.querySelectorAll("[data-goto-type]").forEach(function (a) {
        a.addEventListener("click", function () { setType(a.dataset.gotoType); });
      });
      $("paddleYes").addEventListener("click", function () { setRentPaddle(true); });
      $("paddleNo").addEventListener("click", function () { setRentPaddle(false); });
      $("payGcash").addEventListener("click", function () { setPayment("gcash"); });
      $("payCounter").addEventListener("click", function () { setPayment("counter"); });
      bindSteppers("paxInput", "paxMinus", "paxPlus",
        function () { return state.pax; }, function (v) { state.pax = v; });
      bindSteppers("paddleQty", "paddleMinus", "paddlePlus",
        function () { return state.paddleQty; }, function (v) { state.paddleQty = v; });
      $("courtPax").addEventListener("change", renderSummary);
      $("copyGcashBtn").addEventListener("click", function () {
        var num = state.settings.gcash_number.replace(/\s/g, "");
        if (navigator.clipboard) navigator.clipboard.writeText(num).then(function () { toast("📋 GCash number copied!"); });
      });
      $("gcashProof").addEventListener("change", function () {
        $("proofPreview").hidden = true;
        $("proofPreview").removeAttribute("src");
        var file = this.files[0];
        $("proofStatus").textContent = "";
        if (!file) return;
        if (file.size > 1048576 || ["image/jpeg", "image/png", "image/webp"].indexOf(file.type) < 0) {
          $("proofStatus").textContent = "Please choose a JPG, PNG or WebP image up to 1 MB.";
          this.value = ""; return;
        }
        $("proofStatus").textContent = file.name + " selected. Uploaded when you confirm your booking.";
        var reader = new FileReader();
        reader.onload = function () { $("proofPreview").src = reader.result; $("proofPreview").hidden = false; };
        reader.readAsDataURL(file);
      });
      $("confirmBtn").addEventListener("click", submitBooking);
      $("copyDetailsBtn").addEventListener("click", function () {
        if (navigator.clipboard && state.lastBookingText) {
          navigator.clipboard.writeText(state.lastBookingText).then(function () { toast("📋 Booking details copied — paste it in Messenger!"); });
        }
      });
      $("bookAgainBtn").addEventListener("click", function () {
        $("successView").hidden = true;
        $("bookingApp").hidden = false;
        state.selected = {};
        state.attemptFingerprint = "";
        state.attemptRef = "";
        $("gcashRef").value = "";
        $("gcashProof").value = "";
        $("proofPreview").hidden = true;
        $("proofPreview").removeAttribute("src");
        $("proofStatus").textContent = "";
        refreshAvailability();
        $("book").scrollIntoView({ behavior: "smooth" });
      });

      setType(state.type);
      refreshAvailability();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
