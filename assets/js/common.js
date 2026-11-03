/*
 * Dinks N Drinks — shared logic for booking page + admin page.
 * Data layer automatically uses Supabase when keys are set in config.js,
 * otherwise falls back to DEMO MODE (browser localStorage).
 */
(function () {
  "use strict";

  var LS_BOOKINGS = "dnd_demo_bookings_v1";
  var LS_SETTINGS = "dnd_demo_settings_v1";
  var LS_SEEDED = "dnd_demo_seeded_v1";

  var DEFAULT_SETTINGS = {
    email_pending_message: "Thank you for booking with Dinks & Drinks. We have received your request and will review it shortly.",
    email_confirmed_message: "Your booking is confirmed. Please arrive 15 minutes before your scheduled game and keep your reference handy.",
    email_cancelled_message: "Your booking has been cancelled. Please contact our team if you have questions about your booking or payment.",
    email_footer: "Questions? Reply to this business email or message https://www.facebook.com/dinksNdrinks",
    business_name: "Dinks & Drinks",
    tagline: "Pickleball Zone",
    location: "Brgy. Magsaysay, Naguilian, Isabela",
    contact_number: "+63 917 708 2805",
    facebook_url: "https://www.facebook.com/dinksNdrinks",
    messenger_url: "https://m.me/dinksNdrinks",
    gcash_number: "0917 708 2805",          // from FB page contact — VERIFY this is your GCash number in Admin!
    gcash_name: "Dinks & Drinks Pickleball Zone", // VERIFY exact GCash account name in Admin!
    courts: 3,
    court_open_hour: 8,                     // 8:00 AM — court rentals start
    court_close_hour: 17,                   // last court game ends 5:00 PM
    open_hour: 18,                          // 6:00 PM — open play start
    close_hour: 22,                         // last game ends 10:00 PM
    court_rate: 250,                        // ₱ per court per hour
    openplay_rate: 100,                     // ₱ per person per session
    paddle_rate: 100,                       // ₱ per paddle
    paddle_per: "booking",                  // "booking" = flat per paddle | "hour" = per paddle per hour
    openplay_capacity: 24,                  // max players per open play session (all courts)
    openplay_sessions: [
      { id: "openplay", label: "Open Play", start_hour: 18, end_hour: 22 }
    ]
  };

  /* ---------------- helpers ---------------- */
  function peso(n) {
    return "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 });
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function parseISODate(s) {
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function hourLabel(h) {
    var hh = ((h + 11) % 12) + 1;
    var ap = h < 12 || h === 24 ? "AM" : "PM";
    if (h === 24) hh = 12;
    return hh + ":00 " + ap;
  }
  function hourShort(h) {
    var hh = ((h + 11) % 12) + 1;
    var ap = h < 12 || h === 24 ? "AM" : "PM";
    if (h === 24) hh = 12;
    return hh + ap;
  }
  function friendlyDate(s) {
    return parseISODate(s).toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function makeRef() {
    return "DND-" + Date.now().toString(36).toUpperCase().slice(-4) +
      Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- mode / supabase client ---------------- */
  var cfg = window.DND_CONFIG || {};
  var HAS_SUPABASE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var _sbPromise = null;

  function getSupabase() {
    if (!HAS_SUPABASE) return Promise.resolve(null);
    if (!_sbPromise) {
      _sbPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(function (mod) {
          return mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        })
        .catch(function (err) {
          console.error("Supabase connection failed.", err);
          _sbPromise = null;
          throw new Error("Cannot connect to the booking service. Please try again; no booking has been saved.");
        });
    }
    return _sbPromise;
  }

  /* ---------------- settings ---------------- */
  function loadLocalSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}");
      return mergeSettings(Object.assign({}, DEFAULT_SETTINGS, saved));
    } catch (e) {
      return mergeSettings(Object.assign({}, DEFAULT_SETTINGS));
    }
  }

  var SETTINGS_REV = 2;   // bump when the defaults change (clears saved demo settings once)
  function mergeSettings(out) {
    if (out.settings_rev !== SETTINGS_REV) {
      out = Object.assign({}, DEFAULT_SETTINGS);
      out.settings_rev = SETTINGS_REV;
    }
    return out;
  }

  function loadSettings() {
    return getSupabase().then(function (sb) {
      if (!sb) return loadLocalSettings();
      return sb.from("settings").select("key, value").then(function (res) {
        if (res.error || !res.data) return loadLocalSettings();
        var out = Object.assign({}, DEFAULT_SETTINGS);
        res.data.forEach(function (row) { out[row.key] = row.value; });
        return mergeSettings(out);
      });
    });
  }

  function saveSettings(settings) {
    settings.settings_rev = SETTINGS_REV;
    return getSupabase().then(function (sb) {
      if (!sb) {
        localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
        return { ok: true };
      }
      var rows = Object.keys(settings).map(function (k) {
        return { key: k, value: settings[k] };
      });
      return sb.from("settings").upsert(rows, { onConflict: "key" }).then(function (res) {
        return { ok: !res.error, error: res.error };
      });
    });
  }

  /* ---------------- demo data ---------------- */
  function getDemoBookings() {
    try { return JSON.parse(localStorage.getItem(LS_BOOKINGS) || "[]"); }
    catch (e) { return []; }
  }
  function setDemoBookings(list) {
    localStorage.setItem(LS_BOOKINGS, JSON.stringify(list));
  }

  // Create a few sample blocked slots per date so the grid looks alive in demo mode.
  function ensureDemoSeed(dateStr, settings) {
    var seeded;
    try { seeded = JSON.parse(localStorage.getItem(LS_SEEDED) || "[]"); }
    catch (e) { seeded = []; }
    if (seeded.indexOf(dateStr) !== -1) return;

    var seed = 0;
    for (var i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

    var list = getDemoBookings();
    var names = ["(Sample) Team Dinkers", "(Sample) Rally Crew", "(Sample) Morning Club", "(Sample) Barkada Game"];
    var made = 0;
    for (var c = 1; c <= settings.courts && made < 4; c++) {
      if (rnd() < 0.35) continue;
      var start = settings.court_open_hour + Math.floor(rnd() * (settings.court_close_hour - settings.court_open_hour - 1));
      var slots = [{ court: c, hour: start }];
      if (rnd() > 0.5) slots.push({ court: c, hour: start + 1 });
      list.push({
        id: "seed-" + dateStr + "-" + c,
        booking_ref: "DND-SAMPLE" + c,
        customer_name: names[(c - 1) % names.length],
        mobile: "09000000000",
        booking_type: "court",
        date: dateStr,
        court_number: c,
        start_hour: start,
        end_hour: start + slots.length,
        slots: slots,
        pax: 4,
        rent_paddle: false,
        paddle_qty: 0,
        court_amount: slots.length * settings.court_rate,
        paddle_amount: 0,
        total_amount: slots.length * settings.court_rate,
        payment_method: "gcash",
        gcash_ref: "SAMPLE",
        status: "confirmed",
        notes: "Sample booking (demo mode)",
        created_at: new Date().toISOString()
      });
      made++;
    }
    setDemoBookings(list);
    seeded.push(dateStr);
    localStorage.setItem(LS_SEEDED, JSON.stringify(seeded));
  }

  /* ---------------- availability / bookings API ---------------- */
  // Returns minimal rows for availability: {booking_type, slots, start_hour, end_hour, pax, status}
  function fetchAvailability(dateStr, settings) {
    return getSupabase().then(function (sb) {
      if (!sb) {
        ensureDemoSeed(dateStr, settings);
        return getDemoBookings().filter(function (b) {
          return b.date === dateStr && b.status !== "cancelled";
        });
      }
      return sb.from("public_availability")
        .select("booking_type, slots, start_hour, end_hour, pax, status")
        .eq("date", dateStr)
        .neq("status", "cancelled")
        .then(function (res) {
          if (res.error) throw new Error("Could not check availability. Please refresh before booking.");
          return res.data || [];
        });
    });
  }

  function createBooking(booking, protection) {
    var fileInput = document.getElementById("gcashProof");
    var file = fileInput && fileInput.files[0];
    return new Promise(function (resolve, reject) {
      if (booking.payment_method !== "gcash") return resolve(null);
      if (!file || file.size > 1048576 || ["image/jpeg", "image/png", "image/webp"].indexOf(file.type) < 0) {
        return reject(new Error("Upload a JPG, PNG or WebP payment receipt up to 1 MB."));
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read receipt. Please select it again.")); };
      reader.onload = function () { resolve({ type: file.type, data: String(reader.result).split(",")[1] }); };
      reader.readAsDataURL(file);
    }).then(function (proof) { return saveBooking(booking, protection, proof); });
  }

  function saveBooking(booking, protection, proof) {
    return getSupabase().then(function (sb) {
      if (!sb) {
        var list = getDemoBookings();
        // Demo receipts stay local and are not uploaded or persisted.
        list.push(booking);
        setDemoBookings(list);
        return { ok: true, booking: booking };
      }
      var row = {
        booking_ref: booking.booking_ref,
        customer_name: booking.customer_name,
        public_nickname: booking.public_nickname,
        customer_email: booking.customer_email,
        mobile: booking.mobile,
        booking_type: booking.booking_type,
        date: booking.date,
        court_number: booking.court_number,
        start_hour: booking.start_hour,
        end_hour: booking.end_hour,
        slots: booking.slots,
        pax: booking.pax,
        rent_paddle: booking.rent_paddle,
        paddle_qty: booking.paddle_qty,
        court_amount: booking.court_amount,
        paddle_amount: booking.paddle_amount,
        total_amount: booking.total_amount,
        payment_method: booking.payment_method,
        gcash_ref: booking.gcash_ref,
        status: "pending",
        notes: booking.notes
      };
      return sb.functions.invoke("create-booking", { body: { booking: row, protection: protection, proof: proof } }).then(function (res) {
        if (res.error && res.error.context && typeof res.error.context.json === "function") {
          return res.error.context.json().then(function (body) {
            return { ok: false, error: { message: body.error, code: body.code } };
          }).catch(function () { return { ok: false, error: res.error }; });
        }
        return { ok: !res.error && !(res.data && res.data.error), error: res.error || (res.data && res.data.error), booking: booking };
      });
    });
  }

  /* ---------------- admin API ---------------- */
  function adminListBookings() {
    return getSupabase().then(function (sb) {
      if (!sb) {
        return getDemoBookings().slice().sort(function (a, b) {
          return (b.date + b.created_at) > (a.date + a.created_at) ? 1 : -1;
        });
      }
      return sb.from("bookings").select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500)
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
    });
  }

  function adminUpdateStatus(id, status) {
    return getSupabase().then(function (sb) {
      if (!sb) {
        var list = getDemoBookings().map(function (b) {
          if (b.id === id) b.status = status;
          return b;
        });
        setDemoBookings(list);
        return { ok: true };
      }
      return sb.from("bookings").update({ status: status }).eq("id", id)
        .then(function (res) {
          if (res.error) return { ok: false, error: res.error };
          // Status is already saved. Email failure must not turn this into a failed update.
          return sb.functions.invoke("send-booking-emails").then(function () {
            return { ok: true };
          }).catch(function () { return { ok: true }; });
        });
    });
  }

  window.DND = {
    HAS_SUPABASE: HAS_SUPABASE,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    peso: peso, pad: pad, isoDate: isoDate, parseISODate: parseISODate,
    hourLabel: hourLabel, hourShort: hourShort, friendlyDate: friendlyDate,
    uid: uid, makeRef: makeRef, esc: esc,
    getSupabase: getSupabase,
    loadSettings: loadSettings, saveSettings: saveSettings,
    fetchAvailability: fetchAvailability, createBooking: createBooking,
    adminListBookings: adminListBookings, adminUpdateStatus: adminUpdateStatus,
    getDemoBookings: getDemoBookings
  };
})();
