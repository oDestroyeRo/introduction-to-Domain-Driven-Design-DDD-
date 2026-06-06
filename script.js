(function () {
  const body = document.body;
  const presentation = document.getElementById("presentation");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const agendaList = document.getElementById("agendaList");
  const progressBar = document.getElementById("progressBar");
  const slideCounter = document.getElementById("slideCounter");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const presenterPrevButton = document.getElementById("presenterPrevButton");
  const presenterNextButton = document.getElementById("presenterNextButton");
  const presenterMiniCounter = document.getElementById("presenterMiniCounter");
  const modeToggle = document.getElementById("modeToggle");
  const notesToggle = document.getElementById("notesToggle");
  const presenterToggle = document.getElementById("presenterToggle");
  const printButton = document.getElementById("printButton");
  const presenterConsole = document.getElementById("presenterConsole");
  const presenterCounter = document.getElementById("presenterCounter");
  const presenterTitle = document.getElementById("presenterTitle");
  const presenterNotes = document.getElementById("presenterNotes");
  const currentPreview = document.getElementById("currentPreview");
  const nextPreview = document.getElementById("nextPreview");
  const audienceButton = document.getElementById("audienceButton");
  const audienceStatus = document.getElementById("audienceStatus");

  let currentSlide = 0;
  let audienceWindow = null;
  const params = new URLSearchParams(window.location.search);
  const isAudienceMode = params.get("audience") === "1";
  const syncKey = "ddd-presentation-sync-state";
  const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel("ddd-presentation-sync") : null;

  function clampSlide(index) {
    return Math.max(0, Math.min(index, slides.length - 1));
  }

  function setActiveSlide(index, updateHash, options = {}) {
    currentSlide = clampSlide(index);

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === currentSlide;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive && !body.classList.contains("reader-mode")));
    });

    Array.from(agendaList.querySelectorAll("button")).forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === currentSlide);
      button.setAttribute("aria-current", buttonIndex === currentSlide ? "step" : "false");
    });

    const percent = ((currentSlide + 1) / slides.length) * 100;
    progressBar.style.width = `${percent}%`;
    slideCounter.textContent = `${currentSlide + 1} / ${slides.length}`;
    prevButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === slides.length - 1;
    presenterMiniCounter.textContent = `${currentSlide + 1} / ${slides.length}`;
    presenterPrevButton.disabled = currentSlide === 0;
    presenterNextButton.disabled = currentSlide === slides.length - 1;

    const activeSlide = slides[currentSlide];
    if (updateHash && activeSlide.id) {
      history.replaceState(null, "", `#${activeSlide.id}`);
    }

    if (!body.classList.contains("reader-mode")) {
      activeSlide.focus({ preventScroll: true });
    }

    renderPresenterConsole();

    if (options.broadcast !== false) {
      publishSlideState();
    }
  }

  function buildAgenda() {
    slides.forEach((slide, index) => {
      if (!slide.id) {
        slide.id = `slide-${index + 1}`;
      }

      slide.setAttribute("tabindex", "-1");

      const item = document.createElement("li");
      const button = document.createElement("button");
      const title = document.createElement("span");
      const time = document.createElement("small");

      title.textContent = slide.dataset.title || `Slide ${index + 1}`;
      time.textContent = slide.dataset.time || "";

      button.type = "button";
      button.append(title, time);
      button.addEventListener("click", () => {
        setActiveSlide(index, true);
        if (body.classList.contains("reader-mode")) {
          slide.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      });

      item.appendChild(button);
      agendaList.appendChild(item);
    });
  }

  function returnToSlideTopIfControlsAreInline() {
    if (body.classList.contains("reader-mode") || body.classList.contains("presenter-mode")) {
      return;
    }

    if (getComputedStyle(prevButton.parentElement).position === "static") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goNext() {
    if (!body.classList.contains("reader-mode")) {
      setActiveSlide(currentSlide + 1, true);
      returnToSlideTopIfControlsAreInline();
    }
  }

  function goPrevious() {
    if (!body.classList.contains("reader-mode")) {
      setActiveSlide(currentSlide - 1, true);
      returnToSlideTopIfControlsAreInline();
    }
  }

  function toggleReaderMode() {
    if (body.classList.contains("presenter-mode")) {
      stopPresenterMode();
    }

    const isReader = body.classList.toggle("reader-mode");
    modeToggle.textContent = isReader ? "Slide mode" : "Reader mode";
    modeToggle.setAttribute("aria-pressed", String(isReader));

    slides.forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(!isReader && index !== currentSlide));
    });

    if (isReader) {
      slides[currentSlide].scrollIntoView({ block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setActiveSlide(currentSlide, true);
    }
  }

  function toggleNotes() {
    const showNotes = body.classList.toggle("show-notes");
    notesToggle.textContent = showNotes ? "Hide notes" : "Show notes";
    notesToggle.setAttribute("aria-pressed", String(showNotes));
  }

  function hydrateFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setActiveSlide(isAudienceMode ? getStoredSlideIndex() ?? 0 : 0, false, { broadcast: false });
      return;
    }

    const index = slides.findIndex((slide) => slide.id === hash);
    setActiveSlide(index === -1 ? 0 : index, false, { broadcast: false });

    if (!isAudienceMode) {
      const resetSlideScroll = () => window.scrollTo({ top: 0, left: 0 });
      requestAnimationFrame(resetSlideScroll);
      window.addEventListener("load", resetSlideScroll, { once: true });
      window.setTimeout(resetSlideScroll, 120);
    }
  }

  function getStoredSlideIndex() {
    try {
      const stored = JSON.parse(localStorage.getItem(syncKey));
      return Number.isInteger(stored?.slide) ? clampSlide(stored.slide) : null;
    } catch (error) {
      return null;
    }
  }

  function publishSlideState() {
    const state = {
      type: "slide-state",
      slide: currentSlide,
      slideId: slides[currentSlide]?.id || "",
      sourceId: instanceId
    };

    try {
      localStorage.setItem(syncKey, JSON.stringify(state));
    } catch (error) {
      // Local storage can be unavailable in private browsing; BroadcastChannel still covers active windows.
    }

    syncChannel?.postMessage(state);
  }

  function buildAudienceUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("presenter");
    url.searchParams.set("audience", "1");
    url.hash = slides[currentSlide]?.id || "";
    return url.toString();
  }

  function openAudienceDisplay() {
    const audienceUrl = buildAudienceUrl();
    audienceWindow = window.open(audienceUrl, "ddd-audience-display", "popup=yes,width=1280,height=720");

    if (audienceWindow) {
      window.focus();
      audienceStatus.textContent = "Audience display opened";
      publishSlideState();
    } else {
      audienceStatus.textContent = "Audience display blocked";
    }
  }

  function startPresenterMode(openDisplay = false) {
    if (body.classList.contains("reader-mode")) {
      toggleReaderMode();
    }

    body.classList.add("presenter-mode");
    presenterConsole.hidden = false;
    presenterToggle.textContent = "Exit presenter";
    presenterToggle.setAttribute("aria-pressed", "true");
    presenterToggle.setAttribute("title", "Exit presenter mode (Esc)");
    renderPresenterConsole();
    publishSlideState();

    if (openDisplay) {
      openAudienceDisplay();
    }
  }

  function stopPresenterMode() {
    body.classList.remove("presenter-mode");
    presenterConsole.hidden = true;
    presenterToggle.textContent = "Presenter mode";
    presenterToggle.setAttribute("aria-pressed", "false");
    presenterToggle.setAttribute("title", "Toggle presenter mode (P, Esc to exit)");
  }

  function togglePresenterMode() {
    if (body.classList.contains("presenter-mode")) {
      stopPresenterMode();
    } else {
      startPresenterMode(false);
    }
  }

  function clearPreviewIds(root) {
    root.removeAttribute("id");
    root.removeAttribute("tabindex");
    root.setAttribute("aria-hidden", "true");
    root.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    root.querySelectorAll(".speaker-notes").forEach((node) => node.remove());
  }

  function renderPreview(container, slide, emptyText) {
    container.innerHTML = "";

    if (!slide) {
      const empty = document.createElement("p");
      empty.className = "preview-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    const clone = slide.cloneNode(true);
    clone.classList.add("preview-slide");
    clone.classList.remove("is-active");
    clearPreviewIds(clone);
    container.appendChild(clone);
  }

  function renderPresenterConsole() {
    if (!presenterConsole || presenterConsole.hidden) {
      return;
    }

    const current = slides[currentSlide];
    const next = slides[currentSlide + 1];
    presenterCounter.textContent = `${currentSlide + 1} / ${slides.length}`;
    presenterTitle.textContent = current?.dataset.title || `Slide ${currentSlide + 1}`;
    presenterNotes.innerHTML = current?.querySelector(".speaker-notes")?.innerHTML || "No speaker notes for this slide.";
    renderPreview(currentPreview, current, "No current slide.");
    renderPreview(nextPreview, next, "End of presentation.");
  }

  function handleRemoteState(data) {
    if (!data || data.sourceId === instanceId) {
      return;
    }

    if (data.type === "slide-state" && Number.isInteger(data.slide)) {
      setActiveSlide(data.slide, false, { broadcast: false });
    }

    if (data.type === "request-state" && body.classList.contains("presenter-mode")) {
      publishSlideState();
    }
  }

  function setupAudienceMode() {
    if (!isAudienceMode) {
      return;
    }

    body.classList.add("audience-mode");
    body.classList.remove("show-notes", "reader-mode", "presenter-mode");
    presenterConsole.hidden = true;
    document.title = "Audience Display - Introduction to Domain-Driven Design";
    syncChannel?.postMessage({ type: "request-state", sourceId: instanceId });
  }

  syncChannel?.addEventListener("message", (event) => {
    handleRemoteState(event.data);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== syncKey || !event.newValue) {
      return;
    }

    try {
      handleRemoteState(JSON.parse(event.newValue));
    } catch (error) {
      // Ignore malformed storage messages from older tabs.
    }
  });

  buildAgenda();
  setupAudienceMode();
  hydrateFromHash();

  prevButton.addEventListener("click", goPrevious);
  nextButton.addEventListener("click", goNext);
  presenterPrevButton.addEventListener("click", goPrevious);
  presenterNextButton.addEventListener("click", goNext);
  modeToggle.addEventListener("click", toggleReaderMode);
  notesToggle.addEventListener("click", toggleNotes);
  presenterToggle.addEventListener("click", togglePresenterMode);
  audienceButton.addEventListener("click", openAudienceDisplay);
  printButton.addEventListener("click", () => window.print());

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const usesNativeActivation = target instanceof HTMLElement && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );

    if (usesNativeActivation && (event.key === " " || event.key === "Enter")) {
      return;
    }

    if (event.key === "Escape") {
      if (body.classList.contains("presenter-mode")) {
        event.preventDefault();
        stopPresenterMode();
        return;
      }

      if (body.classList.contains("show-notes")) {
        event.preventDefault();
        toggleNotes();
        return;
      }
    }

    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      goNext();
    }

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goPrevious();
    }

    if (event.key.toLowerCase() === "n") {
      toggleNotes();
    }

    if (event.key.toLowerCase() === "r") {
      toggleReaderMode();
    }

    if (event.key.toLowerCase() === "p" && !isAudienceMode) {
      togglePresenterMode();
    }
  });

  window.addEventListener("hashchange", hydrateFromHash);

  if (presentation) {
    presentation.setAttribute("data-ready", "true");
  }
})();
