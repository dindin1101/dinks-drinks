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
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function render(rows, settings) {
    var board = $("courtBoard"), now = manilaNow(), date = $("boardDate").value;
    board.textContent = "";
    for (var court = 1; court <= settings.courts; court++) {
      var slots = rows.filter(function (r) { return Number(r.court) === court; }).sort(function (a, b) { return a.hour - b.hour; });
      var current = date === now.date ? slots.filter(function (r) { return r.hour === now.hour; })[0] : null;
      var upcoming = slots.filter(function (r) { return date > now.date || (date === now.date && r.hour > now.hour); })[0];
      var focus = current || upcoming;
      var tone = focus ? (focus.booking_status === "confirmed" ? "confirmed" : "pending") : "clear";
      var status = current ? (tone === "confirmed" ? "Scheduled now" : "Pending now") :
        upcoming ? (tone === "confirmed" ? "Upcoming rental" : "Pending rental") :
        date < now.date ? "Past schedule" : date === now.date ? "No rental scheduled now" : "No rental scheduled";
      var card = element("section", "court-card court-tone-" + tone);
      var header = element("div", "court-card-head");
      header.appendChild(element("h2", "", "Court " + court));
      header.appendChild(element("span", "court-badge", status));
      card.appendChild(header);
      var details = element("details", "court-details");
      var summary = element("summary", "court-summary");
      var visual = element("div", "court-visual");
      var image = element("img", "");
      image.src = "assets/img/court-top-view.svg";
      image.alt = "";
      image.width = 400; image.height = 600;
      visual.appendChild(image);
      if (focus) {
        var overlay = element("span", "court-on-court-name");
        overlay.appendChild(element("small", "", current ? "CURRENT SCHEDULE" : "NEXT SCHEDULE"));
        overlay.appendChild(element("span", "", focus.booking_status === "confirmed" ? focus.label : "Awaiting confirmation"));
        visual.appendChild(overlay);
      }
      visual.appendChild(element("span", "court-number", "0" + court));
      visual.appendChild(element("span", "court-visual-caption", "Illustrated court · not live video"));
      summary.appendChild(visual);
      var info = element("div", "court-card-info");
      info.appendChild(element("p", "court-eyebrow", current ? "CURRENT SCHEDULE" : upcoming ? "NEXT SCHEDULE" : "COURT RENTALS"));
      info.appendChild(element("p", "court-alias", focus ? (focus.booking_status === "confirmed" ? focus.label : "Awaiting confirmation") : slots.length ? "View earlier rentals" : "No rental listed"));
      info.appendChild(element("p", "court-time", focus ? D.hourShort(focus.hour) + "–" + D.hourShort(focus.hour + 1) : "Check with staff for availability"));
      if (current && upcoming) info.appendChild(element("p", "court-next", "Next · " + D.hourShort(upcoming.hour) + " · " + (upcoming.booking_status === "confirmed" ? upcoming.label : "Awaiting confirmation")));
      info.appendChild(element("span", "court-expand", "View day schedule (" + slots.length + " hourly slots)"));
      summary.appendChild(info); details.appendChild(summary);
      var list = element("div", "court-day-schedule");
      if (!slots.length) list.appendChild(element("p", "hint", "No court rentals scheduled for this date. Open Play and walk-ins are not included."));
      slots.forEach(function (r) {
        var isCurrent = date === now.date && r.hour === now.hour;
        var line = element("div", "court-slot" + (isCurrent ? " court-current" : ""));
        line.appendChild(element("span", "court-slot-time", D.hourShort(r.hour) + "–" + D.hourShort(r.hour + 1)));
        line.appendChild(element("span", "", r.booking_status === "confirmed" ? r.label : "Awaiting confirmation"));
        line.appendChild(element("small", "hint", r.booking_status === "pending" ? "Pending confirmation" : isCurrent ? "Scheduled now · attendance not verified" : "Confirmed rental"));
        list.appendChild(line);
      });
      details.appendChild(list); card.appendChild(details); board.appendChild(card);
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
        $("boardStatus").textContent = "Updated " + new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date()) + " · Schedule for " + date + ".";
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
