(function () {
  "use strict";
  var D = window.DND, version = 0;
  function $(id) { return document.getElementById(id); }
  function manilaNow() {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    var p = {};
    parts.forEach(function (part) { p[part.type] = part.value; });
    return { date: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour) };
  }
  function render(rows, settings) {
    var board = $("courtBoard"), now = manilaNow();
    board.textContent = "";
    for (var court = 1; court <= settings.courts; court++) {
      var card = document.createElement("section"), heading = document.createElement("h2");
      card.className = "panel"; heading.textContent = "Court " + court; card.appendChild(heading);
      var slots = rows.filter(function (r) { return r.court === court; }).sort(function (a, b) { return a.hour - b.hour; });
      if (!slots.length) {
        var empty = document.createElement("p"); empty.textContent = "No court rentals scheduled for this date."; card.appendChild(empty);
      }
      slots.forEach(function (r) {
        var line = document.createElement("p");
        var current = $("boardDate").value === now.date && r.hour === now.hour;
        line.textContent = D.hourShort(r.hour) + "–" + D.hourShort(r.hour + 1) + " · " + r.label + (current ? " · Scheduled now" : "") + (r.booking_status === "pending" ? " · Pending" : "");
        if (current) line.className = "court-current";
        card.appendChild(line);
      });
      board.appendChild(card);
    }
  }
  function refresh() {
    var request = ++version, date = $("boardDate").value;
    $("courtBoard").textContent = "";
    $("boardStatus").textContent = "Loading schedule…";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $("boardStatus").textContent = "Choose a valid date."; return; }
    Promise.all([D.getSupabase(), D.loadSettings()]).then(function (values) {
      if (!values[0]) throw new Error("Live court schedule is not configured. No live availability is shown.");
      return values[0].rpc("court_board", { p_date: date }).then(function (res) {
        if (res.error) throw new Error("Court schedule unavailable. Please try Refresh or contact staff.");
        if (request !== version) return;
        render(res.data || [], values[1]);
        $("boardStatus").textContent = "Schedule loaded for " + date + ".";
      });
    }).catch(function (error) {
      if (request !== version) return;
      $("courtBoard").textContent = "";
      $("boardStatus").textContent = error.message;
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    $("boardDate").value = manilaNow().date;
    $("boardRefresh").addEventListener("click", refresh);
    $("boardDate").addEventListener("change", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    setInterval(function () { if (!document.hidden) refresh(); }, 60000);
    refresh();
  });
})();
