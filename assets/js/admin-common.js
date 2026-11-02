/* Dinks & Drinks — shared admin helpers (auth guard, shell, toast, CSV) */
(function () {
  "use strict";
  var D = window.DND;

  var ADMIN = {
    DEMO_KEY: "dnd_admin_demo_v1",

    toast: function (msg) {
      var t = document.createElement("div");
      t.className = "toast";
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 2600);
    },

    /* Where pages live (relative, so it works locally AND on Vercel clean URLs) */
    loginUrl: function () { return "login.html"; },
    dashboardUrl: function () { return "dashboard.html"; },

    /* Runs cb(user) only when signed in; otherwise bounces to the login page. */
    requireLogin: function (cb) {
      return D.getSupabase().then(function (sb) {
        if (!sb) {
          // Demo mode — simple PIN session kept for this browser tab.
          if (sessionStorage.getItem(ADMIN.DEMO_KEY) === "1") {
            cb({ mode: "demo", email: "demo@dinksndrinks" });
          } else {
            location.replace(ADMIN.loginUrl());
          }
          return;
        }
        return sb.auth.getSession().then(function (res) {
          var sess = res && res.data && res.data.session;
          if (!sess) { location.replace(ADMIN.loginUrl()); return; }
          // Live updates when the owner signs out in another tab.
          sb.auth.onAuthStateChange(function (evt) {
            if (evt === "SIGNED_OUT") location.replace(ADMIN.loginUrl());
          });
          cb({ mode: "supabase", sb: sb, email: sess.user && sess.user.email });
        });
      });
    },

    logout: function () {
      sessionStorage.removeItem(ADMIN.DEMO_KEY);
      D.getSupabase().then(function (sb) {
        if (!sb) { location.replace(ADMIN.loginUrl()); return; }
        sb.auth.signOut().then(function () { location.replace(ADMIN.loginUrl()); });
      });
    },

    /* Fills the sidebar identity + wires the log-out button + active nav link */
    initShell: function (opts, user) {
      var el = document.getElementById("adminUser");
      if (el) el.textContent = user.email || "";
      var badge = document.getElementById("adminMode");
      if (badge) {
        badge.textContent = user.mode === "demo" ? "demo data" : "live";
        badge.className = "admin-badge" + (user.mode === "demo" ? " is-demo" : "");
      }
      var out = document.getElementById("logoutBtn");
      if (out) out.addEventListener("click", function () { ADMIN.logout(); });
      document.querySelectorAll("[data-nav]").forEach(function (a) {
        if (a.dataset.nav === opts.active) a.classList.add("is-active");
      });
      document.querySelectorAll("[data-toggle-nav]").forEach(function (b) {
        b.addEventListener("click", function () {
          document.body.classList.toggle("nav-open");
        });
      });
    },

    /* ---------- date helpers ---------- */
    startOfWeek: function (d) {                       // Monday
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var shift = (x.getDay() + 6) % 7;
      x.setDate(x.getDate() - shift);
      return x;
    },
    addDays: function (d, n) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      x.setDate(x.getDate() + n);
      return x;
    },
    startOfMonth: function (d) { return new Date(d.getFullYear(), d.getMonth(), 1); },
    endOfMonth: function (d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); },
    monthLabel: function (d) {
      return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
    },
    dayLabel: function (d) {
      return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
    },
    daysBetween: function (a, b) {
      return Math.round((b - a) / 86400000) + 1;
    },

    /* ---------- CSV ---------- */
    downloadCSV: function (filename, rows) {
      var csv = rows.map(function (r) {
        return r.map(function (cell) {
          var s = String(cell == null ? "" : cell);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(",");
      }).join("\r\n");
      var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };

  window.ADMIN = ADMIN;
})();
