(function () {
  const body = document.body;
  const presentation = document.getElementById("presentation");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const agendaList = document.getElementById("agendaList");
  const progressBar = document.getElementById("progressBar");
  const slideCounter = document.getElementById("slideCounter");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const modeToggle = document.getElementById("modeToggle");
  const notesToggle = document.getElementById("notesToggle");
  const printButton = document.getElementById("printButton");

  let currentSlide = 0;

  function clampSlide(index) {
    return Math.max(0, Math.min(index, slides.length - 1));
  }

  function setActiveSlide(index, updateHash) {
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

    const activeSlide = slides[currentSlide];
    if (updateHash && activeSlide.id) {
      history.replaceState(null, "", `#${activeSlide.id}`);
    }

    if (!body.classList.contains("reader-mode")) {
      activeSlide.focus({ preventScroll: true });
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

  function goNext() {
    if (!body.classList.contains("reader-mode")) {
      setActiveSlide(currentSlide + 1, true);
    }
  }

  function goPrevious() {
    if (!body.classList.contains("reader-mode")) {
      setActiveSlide(currentSlide - 1, true);
    }
  }

  function toggleReaderMode() {
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
      setActiveSlide(0, false);
      return;
    }

    const index = slides.findIndex((slide) => slide.id === hash);
    setActiveSlide(index === -1 ? 0 : index, false);
  }

  buildAgenda();
  hydrateFromHash();

  prevButton.addEventListener("click", goPrevious);
  nextButton.addEventListener("click", goNext);
  modeToggle.addEventListener("click", toggleReaderMode);
  notesToggle.addEventListener("click", toggleNotes);
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
  });

  window.addEventListener("hashchange", hydrateFromHash);

  if (presentation) {
    presentation.setAttribute("data-ready", "true");
  }
})();
