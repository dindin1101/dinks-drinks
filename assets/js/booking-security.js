/* reCAPTCHA is required for live submissions, never for local demo bookings. */
(function () {
  "use strict";
  var widget = null;
  var config = window.DND_CONFIG || {};
  var live = !!config.SUPABASE_ANON_KEY;
  window.DND_SECURITY = {
    read: function () {
      var trap = document.getElementById("bookingWebsite").value;
      if (trap) throw new Error("Unable to submit. Please refresh and try again.");
      var token = widget !== null && window.grecaptcha ? window.grecaptcha.getResponse(widget) : "";
      if (live && !token) throw new Error("Please complete the spam protection checkbox. If it is missing, refresh or message us on Facebook.");
      return { website: trap, token: token };
    },
    reset: function () {
      if (widget !== null && window.grecaptcha) window.grecaptcha.reset(widget);
    }
  };
  window.dndCaptchaReady = function () {
    widget = window.grecaptcha.render("bookingCaptcha", {
      sitekey: config.RECAPTCHA_SITE_KEY,
      size: "compact"
    });
  };
  document.addEventListener("DOMContentLoaded", function () {
    var notice = document.getElementById("captchaNotice");
    if (!live) { notice.textContent = "Demo mode: spam protection checkbox is not required."; return; }
    notice.textContent = "Complete the spam protection checkbox before confirming your booking.";
    if (!config.RECAPTCHA_SITE_KEY) {
      notice.textContent = "Online bookings are awaiting spam protection setup. Please message us on Facebook to book.";
      return;
    }
    var script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=dndCaptchaReady&render=explicit";
    script.async = true;
    script.onerror = function () { notice.textContent = "Spam protection could not load. Please refresh or message us on Facebook."; };
    document.head.appendChild(script);
  });
})();
