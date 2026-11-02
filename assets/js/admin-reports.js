/* Dinks & Drinks — weekly / monthly reports (bookings, revenue, usage) */
(function () {
  "use strict";
  var D = window.DND, ADMIN = window.ADMIN;
  var $ = function (id) { return document.getElementById(id); };
  var all = [];          // every booking loaded
  var range = { key: "week", from: null, to: null };

  function money(n) { return D.peso(Math.round(n)); }

  /* ---------- range calculation ---------- */
  function boundsFor(key) {
    var now = new Date();
    if (key === "week") {
      var s = ADMIN.startOfWeek(now);
      return { from: s, to: ADMIN.addDays(s, 6) };
    }
    if (key === "lastweek") {
      var s2 = ADMIN.addDays(ADMIN.startOfWeek(now), -7);
      return { from: s2, to: ADMIN.addDays(s2, 6) };
    }
    if (key === "month") {
      return { from: ADMIN.startOfMonth(now), to: ADMIN.endOfMonth(now) };
    }
    if (key === "lastmonth") {
      var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: ADMIN.startOfMonth(lm), to: ADMIN.endOfMonth(lm) };
    }
    // custom
    var f = $("repFrom").value ? D.parseISODate($("repFrom").value) : ADMIN.startOfMonth(now);
    var t = $("repTo").value ? D.parseISODate($("repTo").value) : new Date();
    if (t < f) { var tmp = f; f = t; t = tmp; }
    return { from: f, to: t };
  }

  function inRange(b) {
    return b.date >= D.isoDate(range.from) && b.date <= D.isoDate(range.to);
  }

  /* ---------- aggregation ---------- */
  function aggregate(list) {
    var a = {
      n: 0, revenue: 0, pendingAmt: 0, court: 0, open: 0, paddles: 0, hours: 0,
      courtRev: 0, openRev: 0, paddleRev: 0,
      gcash: 0, gcashRev: 0, counter: 0, counterRev: 0,
      confirmed: 0, pending: 0, cancelled: 0, pax: 0, perCourt: {}
    };
    list.forEach(function (b) {
      var amt = Number(b.total_amount || 0);
      if (b.status === "cancelled") { a.cancelled++; return; }
      a.n++;
      a[b.booking_type === "court" ? "court" : "open"]++;
      if (b.status === "confirmed") { a.revenue += amt; a.confirmed++; }
      else if (b.status === "pending") { a.pendingAmt += amt; a.pending++; }
      a[b.payment_method === "gcash" ? "gcash" : "counter"]++;
      if (b.status === "confirmed") {
        a[b.payment_method === "gcash" ? "gcashRev" : "counterRev"] += amt;
        if (b.booking_type === "court") a.courtRev += Number(b.court_amount || 0);
        else a.openRev += Number(b.court_amount || 0);
        a.paddleRev += Number(b.paddle_amount || 0);
      }
      if (b.rent_paddle) a.paddles += Number(b.paddle_qty || 0);
      if (b.booking_type === "court") {
        a.hours += (b.slots && b.slots.length) ? b.slots.length : Math.max(0, Number(b.end_hour) - Number(b.start_hour));
        (b.slots || []).forEach(function (sl) {
          a.perCourt[sl.court] = (a.perCourt[sl.court] || 0) + 1;
        });
      } else {
        a.pax += Number(b.pax || 0);
      }
    });
    return a;
  }

  function bar(pct, cls) {
    return '<div class="bar"><span class="bar-fill ' + (cls || "") + '" style="width:' + Math.max(1, Math.min(100, pct)) + '%"></span></div>';
  }

  function breakdownRows(items, total) {
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    return items.map(function (i) {
      var pct = total > 0 ? (i.value / total) * 100 : 0;
      return '<div class="bd-row">' +
        '<div class="bd-top"><span>' + i.label + '</span><strong>' + i.display + '</strong></div>' +
        bar((i.value / max) * 100, i.cls) +
        '<div class="bd-sub">' + pct.toFixed(0) + "% of confirmed revenue</div>" +
        "</div>";
    }).join("");
  }

  /* ---------- render ---------- */
  function render() {
    var rows = all.filter(inRange);
    var a = aggregate(rows);

    $("repRangeLabel").textContent = ADMIN.dayLabel(range.from) + " — " + ADMIN.dayLabel(range.to) +
      "  ·  " + ADMIN.daysBetween(range.from, range.to) + " days";

    $("kpiBookings").textContent = a.n;
    $("kpiRevenue").textContent = money(a.revenue);
    $("kpiPending").textContent = money(a.pendingAmt);
    $("kpiCourt").textContent = a.court;
    $("kpiOpen").textContent = a.open;
    $("kpiPaddles").textContent = a.paddles;
    $("kpiHours").textContent = a.hours;
    $("kpiAvg").textContent = a.confirmed ? money(a.revenue / a.confirmed) : "₱0";

    $("breakdown").innerHTML = breakdownRows([
      { label: "🏟️ Court rentals", value: a.courtRev, display: money(a.courtRev), cls: "fill-court" },
      { label: "👥 Open play", value: a.openRev, display: money(a.openRev), cls: "fill-open" },
      { label: "🏓 Paddle rentals", value: a.paddleRev, display: money(a.paddleRev), cls: "fill-paddle" }
    ], a.revenue);

    var payTotal = a.gcash + a.counter;
    $("payMix").innerHTML = breakdownRows([
      { label: "📱 GCash (" + a.gcash + " bookings)", value: a.gcash, display: a.gcashRev ? money(a.gcashRev) + " paid" : a.gcash + " bookings", cls: "fill-court" },
      { label: "🧾 Over the counter (" + a.counter + ")", value: a.counter, display: a.counterRev ? money(a.counterRev) + " paid" : a.counter + " bookings", cls: "fill-open" }
    ], payTotal);

    // court usage
    var courts = Object.keys(a.perCourt).sort();
    var maxC = Math.max.apply(null, courts.map(function (c) { return a.perCourt[c]; }).concat([1]));
    $("courtUse").innerHTML = courts.length
      ? courts.map(function (c) {
          return '<div class="bd-row"><div class="bd-top"><span>Court ' + c + "</span><strong>" +
            a.perCourt[c] + " hr</strong></div>" + bar((a.perCourt[c] / maxC) * 100, "fill-paddle") + "</div>";
        }).join("")
      : '<p class="hint">No court rentals in this period.</p>';

    // day by day
    var body = $("repDailyBody"), foot = $("repDailyFoot");
    body.innerHTML = ""; foot.innerHTML = "";
    var tot = { n: 0, court: 0, open: 0, paddles: 0, conf: 0, pend: 0, canc: 0, hours: 0, rev: 0 };
    var d = new Date(range.from);
    var any = false;
    while (d <= range.to) {
      var iso = D.isoDate(d);
      var dayRows = all.filter(function (b) { return b.date === iso; });
      var dd = aggregate(dayRows);
      var showRow = dayRows.length > 0;
      if (showRow) any = true;
      tot.n += dd.n; tot.court += dd.court; tot.open += dd.open; tot.paddles += dd.paddles;
      tot.conf += dd.confirmed; tot.pend += dd.pending; tot.canc += dd.cancelled;
      tot.hours += dd.hours; tot.rev += dd.revenue;
      var tr = document.createElement("tr");
      if (!showRow) tr.className = "rep-empty";
      tr.innerHTML =
        "<td>" + ADMIN.dayLabel(d) + "</td>" +
        '<td class="num">' + (showRow ? dd.n : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.court : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.open : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.paddles : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.confirmed : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.pending : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.cancelled : "—") + "</td>" +
        '<td class="num">' + (showRow ? dd.hours : "—") + "</td>" +
        '<td class="num">' + (showRow ? money(dd.revenue) : "—") + "</td>";
      body.appendChild(tr);
      d = ADMIN.addDays(d, 1);
    }
    if (!any) body.innerHTML = '<tr class="rep-empty"><td colspan="10">No bookings in this period yet.</td></tr>';
    foot.innerHTML =
      "<tr><th>Total</th>" +
      '<th class="num">' + tot.n + "</th>" +
      '<th class="num">' + tot.court + "</th>" +
      '<th class="num">' + tot.open + "</th>" +
      '<th class="num">' + tot.paddles + "</th>" +
      '<th class="num">' + tot.conf + "</th>" +
      '<th class="num">' + tot.pend + "</th>" +
      '<th class="num">' + tot.canc + "</th>" +
      '<th class="num">' + tot.hours + "</th>" +
      '<th class="num">' + money(tot.rev) + "</th></tr>";
  }

  function setRange(key) {
    range.key = key;
    range = Object.assign({}, range, boundsFor(key));
    $("repCustom").hidden = key !== "custom";
    if (key === "custom" && !$("repFrom").value) {
      $("repFrom").value = D.isoDate(range.from);
      $("repTo").value = D.isoDate(range.to);
    }
    document.querySelectorAll(".rep-tab").forEach(function (t) {
      t.classList.toggle("is-active", t.dataset.range === key);
    });
    render();
  }

  function exportCSV() {
    var rows = [["Date", "Ref", "Customer", "Mobile", "Type", "Slot", "Paddles", "Payment", "GCash Ref", "Status", "Total (PHP)"]];
    all.filter(inRange).forEach(function (b) {
      rows.push([
        b.date, b.booking_ref, b.customer_name, b.mobile,
        b.booking_type === "court" ? "Court rental" : "Open play",
        b.booking_type === "court"
          ? (b.slots || []).map(function (s) { return "Court " + s.court + " " + D.hourShort(s.hour); }).join("; ")
          : D.hourShort(b.start_hour) + "-" + D.hourShort(b.end_hour) + " / " + (b.pax || 0) + " pax",
        b.rent_paddle ? b.paddle_qty : 0,
        b.payment_method === "gcash" ? "GCash" : "Counter",
        b.gcash_ref || "", b.status, Number(b.total_amount || 0)
      ]);
    });
    var a = aggregate(all.filter(inRange));
    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", a.paddles, "", "", "confirmed only", a.revenue]);
    ADMIN.downloadCSV("dinks-reports-" + D.isoDate(range.from) + "-to-" + D.isoDate(range.to) + ".csv", rows);
    ADMIN.toast("⬇️ CSV downloaded.");
  }

  document.addEventListener("DOMContentLoaded", function () {
    ADMIN.requireLogin(function (user) {
      ADMIN.initShell({ active: "reports" }, user);
      $("repView").hidden = false;

      document.querySelectorAll(".rep-tab").forEach(function (t) {
        t.addEventListener("click", function () { setRange(t.dataset.range); });
      });
      $("repApply").addEventListener("click", function () { setRange("custom"); });
      $("exportBtn").addEventListener("click", exportCSV);

      // Demo mode: seed sample history across the last 3 weeks + this month.
      var ready = Promise.resolve();
      if (!D.HAS_SUPABASE) {
        var st = D.DEFAULT_SETTINGS, ds = [];
        for (var i = -24; i <= 3; i++) ds.push(i);
        ready = Promise.all(ds.map(function (i) {
          var d = new Date(); d.setDate(d.getDate() + i);
          return D.fetchAvailability(D.isoDate(d), st);
        }));
      }
      ready.then(function () { return D.adminListBookings(); }).then(function (list) {
        all = list || [];
        setRange("week");
      }).catch(function (err) {
        console.error(err);
        $("repView").innerHTML = '<p class="form-error">Could not load bookings for the report. Check that you ran supabase/schema.sql and you are logged in.</p>';
      });
    });
  });
})();
