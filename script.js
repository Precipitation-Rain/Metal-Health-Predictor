(() => {
  "use strict";

  const API_BASE = "https://metal-health-predictor-1.onrender.com";

  // ---------------------------------------------------------
  // Theme toggle (light / dark), persisted in localStorage
  // ---------------------------------------------------------
  const themeLightBtn = document.getElementById("theme-light-btn");
  const themeDarkBtn = document.getElementById("theme-dark-btn");

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    themeLightBtn.classList.toggle("active", theme === "light");
    themeDarkBtn.classList.toggle("active", theme === "dark");
    themeLightBtn.setAttribute("aria-pressed", String(theme === "light"));
    themeDarkBtn.setAttribute("aria-pressed", String(theme === "dark"));
    try { localStorage.setItem("mh-signal-theme", theme); } catch (e) { /* ignore */ }
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("mh-signal-theme"); } catch (e) { /* ignore */ }
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
      return;
    }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }

  themeLightBtn.addEventListener("click", () => applyTheme("light"));
  themeDarkBtn.addEventListener("click", () => applyTheme("dark"));
  initTheme();

  // ---------------------------------------------------------
  // Live date pill
  // ---------------------------------------------------------
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    const today = new Date();
    todayDateEl.textContent = today.toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  }

  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const scoreTagsEl = document.getElementById("score-tags");
  const gaugeFill = document.getElementById("gauge-fill");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");
  const loadingStepsEl = document.getElementById("loading-steps");

  const GAUGE_ARC_LENGTH = 314;

  let loadingStepTimers = [];
  // Model's real practical output range — found by running the actual
  // trained pipeline against all 5000 REAL rows in
  // Student_Social_Media_And_Mental_Health_Impact.csv and taking the
  // true min/max of its predictions on real data:
  //   preds = model.predict(real_dataset_rows)
  //   MODEL_MIN = preds.min()  -> 3.803
  //   MODEL_MAX = preds.max()  -> 9.239
  // (An earlier version used a range found from random synthetic
  // test inputs, 4.5-8.3 — dropped, since random field combinations
  // don't reflect real correlated student behavior and gave an
  // untrustworthy range.)
  const MODEL_MIN = 3.803;
  const MODEL_MAX = 9.239;
  // What we actually show the user — a friendlier, full 1–10 scale.
  const DISPLAY_MIN = 1;
  const DISPLAY_MAX = 10;

  // Linearly remaps the model's real output range onto the full
  // 1–10 scale shown to the user, so someone from a non-ML
  // background sees an intuitive number instead of the model's
  // raw, narrower prediction range.
  function remapToDisplayScale(modelScore) {
    const clampedModel = Math.max(MODEL_MIN, Math.min(MODEL_MAX, modelScore));
    const fraction = (clampedModel - MODEL_MIN) / (MODEL_MAX - MODEL_MIN);
    return DISPLAY_MIN + fraction * (DISPLAY_MAX - DISPLAY_MIN);
  }

  const SCORE_MIN = DISPLAY_MIN;
  const SCORE_MAX = DISPLAY_MAX;

  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";
      const cx = 120, cy = 140, rOuter = 100, rInner = 90;
      const range = SCORE_MAX - SCORE_MIN;
      for (let i = SCORE_MIN; i <= SCORE_MAX; i += 1) {
        const fraction = (i - SCORE_MIN) / range;
        const angle = Math.PI - fraction * Math.PI;
        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);
        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        g.appendChild(line);
      }
    });
  }
  drawTicks();

  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");
  segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      stressHiddenInput.value = btn.dataset.value;
      clearFieldError(stressHiddenInput);
    });
  });

  function fieldWrapper(input) { return input.closest(".field"); }

  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  function validate(payload) {
    const errors = [];
    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (val === "" || val === null || Number.isNaN(val)) {
        errors.push([input, "This field is required."]);
      } else if (val < min || val > max) {
        errors.push([input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key] || String(payload[key]).trim() === "") {
        errors.push([input, "This field is required."]);
      }
    });

    if (!payload.stress_level) {
      errors.push([stressHiddenInput, "Pick a stress level."]);
    }

    return errors;
  }

  function collectPayload() {
    const fd = new FormData(form);
    return {
      age: fd.get("age") === "" ? NaN : parseInt(fd.get("age"), 10),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: fd.get("avg_daily_usage_hours") === "" ? NaN : parseFloat(fd.get("avg_daily_usage_hours")),
      daily_unlocks: fd.get("daily_unlocks") === "" ? NaN : parseInt(fd.get("daily_unlocks"), 10),
      study_hours: fd.get("study_hours") === "" ? NaN : parseFloat(fd.get("study_hours")),
      physical_activity_hours: fd.get("physical_activity_hours") === "" ? NaN : parseFloat(fd.get("physical_activity_hours")),
      sleep_hours_per_night: fd.get("sleep_hours_per_night") === "" ? NaN : parseFloat(fd.get("sleep_hours_per_night")),
      stress_level: fd.get("stress_level") || "",
    };
  }

  function showState(name) {
    [stateIdle, stateLoading, stateResult, stateError].forEach((el) => (el.hidden = true));
    ({ idle: stateIdle, loading: stateLoading, result: stateResult, error: stateError }[name]).hidden = false;
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.classList.toggle("loading", isSubmitting);
  }

  function runLoadingSteps() {
    if (!loadingStepsEl) return;
    const items = Array.from(loadingStepsEl.querySelectorAll("li"));
    items.forEach((li) => li.classList.remove("active", "done"));
    clearLoadingSteps();

    const stepDelays = [80, 550, 1050];
    stepDelays.forEach((delay, i) => {
      const t = setTimeout(() => {
        items.forEach((li, j) => {
          if (j < i) li.classList.add("done");
          li.classList.toggle("active", j === i);
        });
      }, delay);
      loadingStepTimers.push(t);
    });
  }

  function clearLoadingSteps() {
    loadingStepTimers.forEach((t) => clearTimeout(t));
    loadingStepTimers = [];
  }

  function bandFor(score) {
    if (score <= 3) {
      return {
        label: "Signal: low",
        color: "#E15252",
        context: "Your responses suggest the signal is running low right now. Small shifts in sleep or screen time can go a long way.",
        tags: ["Prioritize sleep", "Trim screen time", "Check in with someone"],
      };
    }
    if (score <= 7) {
      return {
        label: "Signal: medium",
        color: "#E0C22E",
        context: "Your rhythm looks fairly steady, with some room to recover and reset.",
        tags: ["Steady baseline", "Room to recover"],
      };
    }
    return {
      label: "Signal: strong",
      color: "#6FBE5C",
      context: "Your habits point to a well-supported, resilient baseline. Keep it up.",
      tags: ["Resilient baseline", "Keep the rhythm"],
    };
  }

  function renderResult(rawModelScore) {
    const displayScore = remapToDisplayScale(rawModelScore);
    const clamped = Math.max(SCORE_MIN, Math.min(SCORE_MAX, displayScore));
    const { label, color, context, tags } = bandFor(clamped);

    scoreNumberEl.textContent = displayScore.toFixed(2);
    scoreBandEl.textContent = label;
    scoreBandEl.style.color = color;
    scoreContextEl.textContent = context;

    scoreTagsEl.innerHTML = "";
    tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "score-tag";
      span.textContent = tag;
      scoreTagsEl.appendChild(span);
    });

    gaugeFill.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
    requestAnimationFrame(() => {
      gaugeFill.style.transition = "";
      const fraction = (clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
      const offset = GAUGE_ARC_LENGTH * (1 - fraction);
      gaugeFill.style.strokeDashoffset = String(offset);
    });

    showState("result");
  }

  function renderError(label, copy) {
    if (errorLabelEl) errorLabelEl.textContent = label;
    errorCopyEl.textContent = copy;
    showState("error");
  }

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const input = field ? document.getElementById(field) : null;
      const target = field === "stress_level" ? stressHiddenInput : input;
      if (target) {
        setFieldError(target, err.msg || "Invalid value.");
        matched = true;
      }
    });
    return matched;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const clientErrors = validate(payload);

    if (clientErrors.length > 0) {
      clientErrors.forEach(([input, msg]) => input && setFieldError(input, msg));
      clientErrors[0][0]?.focus?.();
      return;
    }

    setSubmitting(true);
    showState("loading");
    runLoadingSteps();

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        clearLoadingSteps();
        renderError(
          "Check your inputs",
          matched
            ? "The API rejected a few fields — details are marked on the form."
            : "The API rejected this submission. Please review your inputs and try again."
        );
        return;
      }

      if (!res.ok) {
        let detailMsg = `The API responded with status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") detailMsg = body.detail;
        clearLoadingSteps();
        renderError("Prediction failed", detailMsg);
        return;
      }

      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        clearLoadingSteps();
        renderError("Unexpected response", "The API responded, but the score was missing or malformed.");
        return;
      }

      clearLoadingSteps();
      renderResult(data.predicted_mental_health_score);
    } catch (err) {
      clearLoadingSteps();
      renderError(
        "Can't reach the server",
        `Couldn't connect to ${API_BASE}. Make sure the backend is running (uvicorn main:app --reload --port 8000) and reachable from this page.`
      );
    } finally {
      setSubmitting(false);
    }
  });

  function resetFormAndGoIdle() {
    form.reset();
    clearAllErrors();
    segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    stressHiddenInput.value = "";
    gaugeFill.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
    scoreTagsEl.innerHTML = "";
    showState("idle");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => clearFieldError(el));
    el.addEventListener("change", () => clearFieldError(el));
  });

  resetBtn.addEventListener("click", resetFormAndGoIdle);
  errorRetryBtn.addEventListener("click", resetFormAndGoIdle);
})();