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

  // ---- Hero: one short signal run around the Beacon, then rest. Replay on request. --------------------------------
  var hero = doc.querySelector("[data-hero]");
  if (hero) {
    var motion = hero.querySelector("animateMotion");
    var replay = hero.querySelector("[data-hero-replay]");
    var heroTimer = 0;
    var finishHero = function () {
      window.clearTimeout(heroTimer);
      hero.classList.remove("is-playing");
    };
    var playHero = function () {
      if (reduced()) return;
      finishHero();
      void hero.offsetWidth; // restart CSS animations
      hero.classList.add("is-playing");
      if (motion && motion.beginElement) motion.beginElement();
      heroTimer = window.setTimeout(finishHero, 2900);
    };
    hiddenHandlers.push(finishHero);
    if (replay) {
      replay.hidden = reduced();
      replay.addEventListener("click", playHero);
    }
    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function () {
        if (replay) replay.hidden = reduced();
        if (reduced()) finishHero();
      });
    }
    window.setTimeout(playHero, 300);
  }

  // ---- AgentJourneyDemo: tabs plus step-through. The transcript stays visible; steps are highlighted, never hidden. --
  var STEP_MS = 1600;
  Array.prototype.forEach.call(doc.querySelectorAll("[data-demo]"), function (demo) {
    var tabs = Array.prototype.slice.call(demo.querySelectorAll("[role=tab]"));
    var players = [];

    Array.prototype.forEach.call(demo.querySelectorAll("[data-scenario]"), function (panel) {
      if (panel.getAttribute("data-initially-hidden") === "1") panel.hidden = true;
      var list = panel.querySelector(".journey");
      var steps = Array.prototype.slice.call(panel.querySelectorAll(".journey-step"));
      var live = panel.querySelector("[data-live]");
      var index = -1;
      var timer = 0;

      function render() {
        list.classList.toggle("is-stepping", index >= 0);
        steps.forEach(function (step, i) {
          step.classList.toggle("is-done", i < index);
          step.classList.toggle("is-current", i === index);
          if (i === index) step.setAttribute("aria-current", "step");
          else step.removeAttribute("aria-current");
        });
        if (live) {
          var kind = index >= 0 ? steps[index].querySelector(".step-kind").firstChild.textContent.trim() : "";
          live.textContent = index >= 0 ? "Step " + (index + 1) + " of " + steps.length + ": " + kind : "";
        }
      }
      function stop() {
        window.clearInterval(timer);
        timer = 0;
      }
      function go(i) {
        index = Math.max(0, Math.min(steps.length - 1, i));
        render();
      }
      function play() {
        stop();
        if (index >= steps.length - 1) index = -1;
        go(index + 1);
        timer = window.setInterval(function () {
          if (index >= steps.length - 1) return stop();
          go(index + 1);
        }, STEP_MS);
      }
      var actions = {
        play: play,
        pause: stop,
        replay: function () { index = -1; play(); },
        prev: function () { stop(); go(index - 1); },
        next: function () { stop(); go(index + 1); },
      };
      Array.prototype.forEach.call(panel.querySelectorAll("[data-action]"), function (button) {
        button.addEventListener("click", function () {
          actions[button.getAttribute("data-action")]();
        });
      });
      players.push(stop);
      hiddenHandlers.push(stop);
    });

    function select(tab, focus) {
      players.forEach(function (stop) { stop(); });
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = doc.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next, true);
        }
      });
    });
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
