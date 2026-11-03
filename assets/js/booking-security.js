/* Basic honeypot only: no CAPTCHA widget, token or third-party script. */
(function () {
  "use strict";
  window.DND_SECURITY = {
    read: function () {
      var input = document.getElementById("bookingWebsite");
      if (!input || input.value !== "") throw new Error("Unable to submit. Please refresh and try again.");
      return { website: "" };
    },
    // Keep the existing submission lifecycle API; no challenge needs resetting.
    reset: function () {}
  };
})();
