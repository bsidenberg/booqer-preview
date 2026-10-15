/* global window, document */
// Booqer website preview. Progressive enhancement only: every word is already in the server HTML.
// No network calls (the page CSP sets connect-src 'none'), text is set with textContent only, no camera or file access.
(function () {
  "use strict";

  var doc = document;
  doc.documentElement.classList.add("has-js");
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() {
    return !!(motionQuery && motionQuery.matches);
  }
  var hiddenHandlers = [];
  doc.addEventListener("visibilitychange", function () {
    doc.documentElement.classList.toggle("is-tab-hidden", doc.hidden);
    if (doc.hidden) hiddenHandlers.forEach(function (fn) { fn(); });
  });

  // ---- Conversation demo: typing indicators and message reveal. Without JS or under reduced motion the full transcript shows. --
  var TYPE_MS = 1200;
  var GAP_MS = 800;
  Array.prototype.forEach.call(doc.querySelectorAll("[data-demo]"), function (demo) {
    var list = demo.querySelector(".chat");
    var items = Array.prototype.slice.call(list.querySelectorAll(".chat-item"));
    var live = demo.querySelector("[data-live]");
    var shown = items.length; // everything visible until a play starts
    var timer = 0;
    var typing = null;
    var started = false;

    function clearTyping() {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      typing = null;
    }
    function stop() {
      window.clearTimeout(timer);
      timer = 0;
      clearTyping();
    }
    function render() {
      list.classList.add("is-playing");
      items.forEach(function (item, i) {
        item.classList.toggle("is-shown", i < shown);
      });
      if (live) live.textContent = shown >= items.length ? "Done" : "Message " + (shown + 1) + " of " + items.length;
    }
    function showTyping(item) {
      clearTyping();
      typing = doc.createElement("li");
      typing.className = "chat-item chat-typing chat-" + (item.classList.contains("chat-customer") ? "customer" : "agent") + " is-shown";
      typing.setAttribute("aria-hidden", "true");
      for (var d = 0; d < 3; d++) typing.appendChild(doc.createElement("span"));
      list.insertBefore(typing, item);
    }
    function step() {
      if (shown >= items.length) return stop();
      var next = items[shown];
      var talks = next.classList.contains("chat-customer") || next.classList.contains("chat-agent");
      if (talks) showTyping(next);
      timer = window.setTimeout(function () {
        clearTyping();
        shown += 1;
        render();
        timer = window.setTimeout(step, GAP_MS);
      }, talks ? TYPE_MS : GAP_MS);
    }
    function play() {
      if (reduced()) return;
      stop();
      if (shown >= items.length) shown = 0;
      started = true;
      render();
      step();
    }
    var actions = {
      play: play,
      pause: function () { stop(); },
      replay: function () { stop(); shown = 0; play(); },
    };
    Array.prototype.forEach.call(demo.querySelectorAll("[data-action]"), function (button) {
      button.addEventListener("click", function () {
        actions[button.getAttribute("data-action")]();
      });
    });
    hiddenHandlers.push(stop);

    if (reduced()) {
      Array.prototype.forEach.call(demo.querySelectorAll(".chat-controls"), function (c) { c.hidden = true; });
    } else if ("IntersectionObserver" in window) {
      // Start once, when the demo scrolls into view; it is already complete in the HTML if this never fires.
      var watcher = new window.IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting || started) return;
        watcher.disconnect();
        shown = 0;
        play();
      }, { threshold: 0.4 });
      watcher.observe(demo);
    }
  });

  // ---- One-time reveals for cards below the fold. Skipped under reduced motion or without IntersectionObserver. -----
  if (!reduced() && "IntersectionObserver" in window) {
    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        entry.target.classList.remove("will-reveal");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    Array.prototype.forEach.call(doc.querySelectorAll(".reveal"), function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add("will-reveal");
        observer.observe(el);
      }
    });
  }

  // ---- Mock claim: remember the last fixture state id in this browser so the view is resumable. ---------------------
  var claim = doc.querySelector("[data-claim]");
  if (claim) {
    var KEY = "booqer.preview.claim";
    var known = {};
    Array.prototype.forEach.call(claim.querySelectorAll("[data-claim-state]"), function (a) {
      known[a.getAttribute("data-claim-state")] = a;
    });
    var params = new window.URLSearchParams(window.location.search);
    try {
      if (params.has("state")) {
        var current = claim.getAttribute("data-claim-current");
        if (known[current]) window.localStorage.setItem(KEY, current);
      } else {
        var saved = window.localStorage.getItem(KEY);
        var resume = claim.querySelector("[data-claim-resume]");
        if (saved && saved !== "draft" && known[saved] && resume) {
          var link = resume.querySelector("a");
          link.href = known[saved].getAttribute("href");
          link.textContent = link.textContent + ": " + known[saved].textContent;
          resume.hidden = false;
        }
      }
    } catch {
      // Storage can be unavailable (private mode); the URL alone still carries the state.
    }
  }
})();
