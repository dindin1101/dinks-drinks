(function () {
  "use strict";
  var D = window.DND;
  var $ = function (id) { return document.getElementById(id); };
  function error(message) {
    $("loginError").hidden = false;
    $("loginError").textContent = message;
  }
  function ready() {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Continue with Google";
  }
  document.addEventListener("DOMContentLoaded", function () {
    $("loginView").hidden = false;
    $("loginBtn").disabled = true;
    sessionStorage.removeItem("dnd_admin_demo_v1");
    if (!D.HAS_SUPABASE) {
      error("Admin login requires a live Supabase connection. Demo PIN login is no longer available.");
      return;
    }
    if (new URLSearchParams(location.search).get("access") === "denied") {
      error("This account is not approved, or admin access has not been configured. Contact the owner.");
    }
    if (new URLSearchParams(location.hash.slice(1)).has("error")) {
      error("Google sign-in was cancelled or failed. Please try again.");
      history.replaceState(null, "", location.pathname);
    }
    D.getSupabase().then(function (sb) {
      if (!sb) throw new Error("Connection unavailable");
      $("loginBtn").addEventListener("click", function () {
        $("loginError").hidden = true;
        $("loginBtn").disabled = true;
        $("loginBtn").textContent = "Opening Google…";
        // Check reachability before leaving this page for the OAuth redirect.
        var config = window.DND_CONFIG || {};
        fetch(config.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/settings", {
          headers: { apikey: config.SUPABASE_ANON_KEY },
          signal: AbortSignal.timeout(10000)
        }).then(function (response) {
          if (!response.ok) throw new Error("Auth service unavailable");
          return sb.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: location.origin + "/dinteams/login",
            queryParams: { prompt: "select_account" }
          }
          });
        }).then(function (res) {
          if (res.error) { error("Google sign-in could not start. Check the Google provider setup in Supabase."); ready(); }
        }).catch(function () { error("Cannot reach the Supabase login service. Check the Project URL in Supabase and your internet connection, then try again."); ready(); });
      });
      return sb.auth.getSession().then(function (res) {
        if (res.error) throw res.error;
        if (!res.data.session) { ready(); return; }
        return sb.rpc("is_dnd_admin").then(function (access) {
          if (!access.error && access.data === true) {
            location.replace("/dinteams/dashboard"); return;
          }
          return sb.auth.signOut().then(function () {
            error("This account is not approved, or admin access has not been configured. Choose an approved Google account.");
            ready();
          });
        });
      });
    }).catch(function () { error("Could not check your login. Refresh to try again."); });
  });
})();
