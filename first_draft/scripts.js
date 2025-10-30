// Duomenų saugojimas localStorage
let learnedTerms = JSON.parse(localStorage.getItem("learnedTerms")) || [];
let allSectionsExpanded = false;
let isSearchActive = false;

// Quiz variables
let quizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;

// Pažymėti visus išmoktus terminus iš localStorage
function markLearnedFromStorage() {
  learnedTerms.forEach((term) => {
    const elements = document.querySelectorAll(`[data-term="${term}"]`);
    elements.forEach((el) => {
      el.classList.add("learned");
      const checkbox = el.querySelector(".toggle-checkbox");
      if (checkbox) checkbox.checked = true;
    });
  });
  updateStats();
}

// Toggle checkbox event - use 'change' event for checkboxes, not 'click'
document.addEventListener("change", function (e) {
  if (e.target.classList.contains("toggle-checkbox")) {
    const termItem = e.target.closest(".term-item");
    const term = termItem.dataset.term;

    console.log("TOGGLE CHANGED:", term, "checked:", e.target.checked);

    if (e.target.checked) {
      termItem.classList.add("learned");
      if (!learnedTerms.includes(term)) {
        learnedTerms.push(term);
      }
    } else {
      termItem.classList.remove("learned");
      learnedTerms = learnedTerms.filter((t) => t !== term);
    }

    localStorage.setItem("learnedTerms", JSON.stringify(learnedTerms));

    console.log("LEARNED TERMS ARRAY:", learnedTerms);

    // Force stats update
    updateStats();

    // Reapply filters after toggling learned status
    if (!isSearchActive) {
      console.log("REAPPLYING FILTERS after toggle");
      applyFilters();
    }

    console.log(
      "Toggle changed:",
      term,
      "Learned:",
      e.target.checked,
      "Total learned:",
      learnedTerms.length
    );
  }
});

// Terminų paspaudimas - tik modal, ne learned
function setupTermClickHandlers() {
  document.querySelectorAll(".term-item").forEach((item) => {
    item.addEventListener("click", function (e) {
      // Ignore if clicking on toggle switch
      if (e.target.closest(".toggle-switch")) {
        return;
      }

      const term = this.dataset.term;
      const english = this.dataset.english;
      const desc = this.dataset.desc;

      // Rodyti modalą
      document.getElementById("modalTitle").textContent =
        term.charAt(0).toUpperCase() + term.slice(1);
      document.getElementById("modalEnglish").textContent = english;
      document.getElementById("modalDesc").textContent = desc;
      document.getElementById("modal").classList.add("active");
    });
  });
}

// Skyriaus išskleidimas/suskleidimas
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  section.classList.toggle("collapsed");
}

// Subsection toggle
function setupSubsectionHandlers() {
  document.querySelectorAll(".subsection-title").forEach((title) => {
    title.addEventListener("click", function (e) {
      e.stopPropagation();
      this.parentElement.classList.toggle("collapsed");
    });
  });
}

// Toggle all sections between expanded and collapsed
function toggleAllSections() {
  const sections = document.querySelectorAll(".section");
  const subsections = document.querySelectorAll(".subsection");

  if (allSectionsExpanded) {
    // Collapse all
    sections.forEach((section) => section.classList.add("collapsed"));
    subsections.forEach((subsection) => subsection.classList.add("collapsed"));
    document.getElementById("toggleAllText").textContent = "Išskleisti viską";
    allSectionsExpanded = false;
  } else {
    // Expand all
    sections.forEach((section) => section.classList.remove("collapsed"));
    subsections.forEach((subsection) =>
      subsection.classList.remove("collapsed")
    );
    document.getElementById("toggleAllText").textContent = "Suskleisti viską";
    allSectionsExpanded = true;
  }
}

// Išskleisti viską
function expandAll() {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("collapsed");
  });
  document.querySelectorAll(".subsection").forEach((subsection) => {
    subsection.classList.remove("collapsed");
  });
}

// Suskleisti viską
function collapseAll() {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.add("collapsed");
  });
  document.querySelectorAll(".subsection").forEach((subsection) => {
    subsection.classList.add("collapsed");
  });
}

// Atstatyti pažangą (with confirmation)
function resetProgress() {
  if (
    !confirm(
      'Visi terminai bus nustatyti kaip "nežinomi", ar tikrai norite tai daryti?'
    )
  ) {
    return;
  }

  learnedTerms = [];
  localStorage.setItem("learnedTerms", JSON.stringify(learnedTerms));
  document.querySelectorAll(".term-item").forEach((item) => {
    item.classList.remove("learned");
    const checkbox = item.querySelector(".toggle-checkbox");
    if (checkbox) checkbox.checked = false;
  });
  updateStats();

  // Reapply filters after reset
  if (!isSearchActive) {
    applyFilters();
  }
}

// Atnaujinti statistiką
function updateStats() {
  const total = document.querySelectorAll(".term-item").length;
  const learned = learnedTerms.length;
  const percent = total > 0 ? Math.round((learned / total) * 100) : 0;

  console.log(
    "updateStats called:",
    "total=",
    total,
    "learned=",
    learned,
    "percent=",
    percent
  );

  const totalEl = document.getElementById("totalTerms");
  const learnedEl = document.getElementById("learnedTerms");
  const percentEl = document.getElementById("percentLearned");

  if (totalEl) totalEl.textContent = total;
  if (learnedEl) learnedEl.textContent = learned;
  if (percentEl) percentEl.textContent = percent + "%";

  console.log("Stats updated in DOM");
}

// Apply filters based on learned/unlearned checkboxes
function applyFilters() {
  const showUnlearned = document.getElementById("showUnlearned");
  const showLearned = document.getElementById("showLearned");

  if (!showUnlearned || !showLearned) {
    console.log("Filter checkboxes not found");
    return;
  }

  const showUnlearnedChecked = showUnlearned.checked;
  const showLearnedChecked = showLearned.checked;

  console.log(
    "applyFilters called:",
    "showUnlearned=",
    showUnlearnedChecked,
    "showLearned=",
    showLearnedChecked,
    "isSearchActive=",
    isSearchActive
  );

  // If search is active, don't interfere with search results
  if (isSearchActive) {
    console.log("Search active, skipping filter");
    return;
  }

  let visibleCount = 0;
  let hiddenCount = 0;

  // Apply visibility to each term using a CSS class instead of inline styles
  document.querySelectorAll(".term-item").forEach((item) => {
    const term = item.dataset.term;
    const isLearned = learnedTerms.includes(term);

    let shouldShow = false;

    // Show if: (learned AND showLearned is ON) OR (unlearned AND showUnlearned is ON)
    if (isLearned && showLearnedChecked) {
      shouldShow = true;
    } else if (!isLearned && showUnlearnedChecked) {
      shouldShow = true;
    }

    console.log(
      "FILTER CHECK:",
      term,
      "isLearned:",
      isLearned,
      "shouldShow:",
      shouldShow,
      "showLearned:",
      showLearnedChecked,
      "showUnlearned:",
      showUnlearnedChecked
    );

    if (shouldShow) {
      item.classList.remove("filter-hidden");
      visibleCount++;
    } else {
      item.classList.add("filter-hidden");
      hiddenCount++;
    }
  });

  console.log("Filter applied: visible=", visibleCount, "hidden=", hiddenCount);

  // Update section/subsection visibility
  updateSectionVisibility();
}

// Update section and subsection visibility based on visible terms
function updateSectionVisibility() {
  let visibleSections = 0;
  let hiddenSections = 0;

  // First, handle subsections
  document.querySelectorAll(".subsection").forEach((subsection) => {
    const allTerms = subsection.querySelectorAll(".term-item");
    let hasVisibleTerms = false;

    for (const term of allTerms) {
      if (!term.classList.contains("filter-hidden")) {
        hasVisibleTerms = true;
        break;
      }
    }

    if (hasVisibleTerms) {
      subsection.classList.remove("filter-hidden");
    } else {
      subsection.classList.add("filter-hidden");
    }
  });

  // Then, handle sections based on subsection visibility
  document.querySelectorAll(".section").forEach((section) => {
    const allSubsections = section.querySelectorAll(".subsection");
    let hasVisibleSubsections = false;

    for (const sub of allSubsections) {
      if (!sub.classList.contains("filter-hidden")) {
        hasVisibleSubsections = true;
        break;
      }
    }

    if (hasVisibleSubsections) {
      section.classList.remove("filter-hidden");
      visibleSections++;
    } else {
      section.classList.add("filter-hidden");
      hiddenSections++;
    }
  });

  console.log(
    "Section visibility updated: visible=",
    visibleSections,
    "hidden=",
    hiddenSections
  );
}

// Perform search
function performSearch() {
  const searchInput = document.getElementById("searchInput");
  const query = searchInput.value.toLowerCase().trim();

  if (!query) {
    clearSearch();
    return;
  }

  isSearchActive = true;
  // Find matches, show only matched term-items, expand their parents and hide empty groups
  const allItems = Array.from(document.querySelectorAll(".term-item"));
  // Clear previous match highlights
  allItems.forEach((it) => it.classList.remove("search-match"));

  // Mark matches and ensure their parent subsection/section are visible
  allItems.forEach((item) => {
    const termLt = (item.dataset.term || "").toLowerCase();
    const termEn = (item.dataset.english || "").toLowerCase();
    const desc = (item.dataset.desc || "").toLowerCase();

    if (
      termLt.includes(query) ||
      termEn.includes(query) ||
      desc.includes(query)
    ) {
      item.style.display = "block";
      item.classList.add("search-match");

      // Ensure parent subsection and section are visible and expanded
      const subsection = item.closest(".subsection");
      if (subsection) {
        subsection.style.display = "block";
        subsection.classList.remove("collapsed");
      }
      const section = item.closest(".section");
      if (section) {
        section.style.display = "block";
        section.classList.remove("collapsed");
      }
    } else {
      item.style.display = "none";
      item.classList.remove("search-match");
    }
  });

  // Hide subsections and sections with no visible matched items
  document.querySelectorAll(".subsection").forEach((sub) => {
    const anyVisible =
      sub.querySelectorAll(".term-item").length &&
      Array.from(sub.querySelectorAll(".term-item")).some((i) => {
        const cs = window.getComputedStyle(i);
        return cs.display !== "none";
      });
    sub.style.display = anyVisible ? "block" : "none";
  });

  document.querySelectorAll(".section").forEach((sec) => {
    const anyVisible =
      sec.querySelectorAll(".term-item").length &&
      Array.from(sec.querySelectorAll(".term-item")).some((i) => {
        const cs = window.getComputedStyle(i);
        return cs.display !== "none";
      });
    sec.style.display = anyVisible ? "block" : "none";
  });

  // Update toggle button text
  document.getElementById("toggleAllText").textContent = "Suskleisti viską";
  allSectionsExpanded = true;
}

// Clear search and return to normal view
function clearSearch() {
  const searchInput = document.getElementById("searchInput");
  searchInput.value = "";
  isSearchActive = false;

  // Remove search match highlights and inline display
  document.querySelectorAll(".term-item").forEach((item) => {
    item.classList.remove("search-match");
    item.style.display = "";
  });

  // Clear inline display from sections and subsections
  document.querySelectorAll(".section").forEach((section) => {
    section.style.display = "";
  });
  document.querySelectorAll(".subsection").forEach((subsection) => {
    subsection.style.display = "";
  });

  // Apply filters to restore learned/unlearned visibility
  applyFilters();

  // Collapse all sections back to default
  collapseAll();
}

// Paieška (on input - for real-time search feel, but button is primary)
function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    // Allow Enter key to trigger search
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        performSearch();
      }
    });

    // Live search feel: highlight matches as user types but still use button as primary
    searchInput.addEventListener("input", function (e) {
      const v = e.target.value.trim();
      if (!v) {
        clearSearch();
      }
    });
  }
}

// Quiz functions
function startQuiz() {
  // Get all unlearned terms
  const allTerms = Array.from(document.querySelectorAll(".term-item"));
  const unlearnedTerms = allTerms.filter(
    (item) => !learnedTerms.includes(item.dataset.term)
  );

  if (unlearnedTerms.length === 0) {
    alert("Puiku! Jūs jau išmokote visus terminus. 🎉");
    return;
  }

  if (unlearnedTerms.length < 10) {
    alert(
      `Rasta tik ${unlearnedTerms.length} neišmoktų terminų. Testas bus su šiais terminais.`
    );
  }

  // Shuffle and take up to 10 questions
  quizQuestions = unlearnedTerms
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(10, unlearnedTerms.length))
    .map((item) => ({
      term: item.dataset.term,
      english: item.dataset.english,
      desc: item.dataset.desc,
    }));

  currentQuizIndex = 0;
  quizScore = 0;

  // Show quiz modal
  document.getElementById("quizModal").classList.add("active");
  document.getElementById("quizContent").style.display = "block";
  document.getElementById("quizResults").style.display = "none";

  showQuizQuestion();
}

function showQuizQuestion() {
  if (currentQuizIndex >= quizQuestions.length) {
    showQuizResults();
    return;
  }

  const question = quizQuestions[currentQuizIndex];
  document.getElementById("currentQuestion").textContent = currentQuizIndex + 1;
  document.getElementById("quizTerm").textContent =
    question.term.charAt(0).toUpperCase() + question.term.slice(1);

  // Hide english/desc initially
  const quizEnglishEl = document.getElementById("quizEnglish");
  quizEnglishEl.textContent =
    question.english + (question.desc ? " — " + question.desc : "");
  quizEnglishEl.style.display = "none";

  // Ask: "Do you know this term?"
  const buttonsNode = document.getElementById("quizButtons");
  buttonsNode.innerHTML = "";

  const knowBtn = document.createElement("button");
  knowBtn.className = "quiz-btn quiz-btn-yes";
  knowBtn.textContent = "Taip, žinau";
  knowBtn.onclick = function () {
    handleKnowAnswer(true);
  };

  const dontKnowBtn = document.createElement("button");
  dontKnowBtn.className = "quiz-btn quiz-btn-no";
  dontKnowBtn.textContent = "Ne, nežinau";
  dontKnowBtn.onclick = function () {
    handleKnowAnswer(false);
  };

  buttonsNode.appendChild(dontKnowBtn);
  buttonsNode.appendChild(knowBtn);
}

function handleKnowAnswer(knows) {
  const quizEnglishEl = document.getElementById("quizEnglish");
  const buttonsNode = document.getElementById("quizButtons");

  if (knows) {
    // Mark as learned and move to next question
    quizScore++;
    const term = quizQuestions[currentQuizIndex].term;
    if (!learnedTerms.includes(term)) {
      learnedTerms.push(term);
      localStorage.setItem("learnedTerms", JSON.stringify(learnedTerms));

      // Update UI
      const elements = document.querySelectorAll(`[data-term="${term}"]`);
      elements.forEach((el) => {
        el.classList.add("learned");
        const checkbox = el.querySelector(".toggle-checkbox");
        if (checkbox) checkbox.checked = true;
      });
      updateStats();
    }

    // Move to next question
    currentQuizIndex++;
    showQuizQuestion();
  } else {
    // Show definition, then provide "Next" button (no option to mark as learned)
    quizEnglishEl.style.display = "block";

    buttonsNode.innerHTML = "";
    const nextBtn = document.createElement("button");
    nextBtn.className = "quiz-btn";
    nextBtn.textContent = "Toliau ➜";
    nextBtn.onclick = function () {
      currentQuizIndex++;
      showQuizQuestion();
    };
    buttonsNode.appendChild(nextBtn);
  }
}

function showQuizResults() {
  document.getElementById("quizContent").style.display = "none";
  document.getElementById("quizResults").style.display = "block";
  document.getElementById("scoreNumber").textContent = quizScore;
}

function closeQuizModal() {
  document.getElementById("quizModal").classList.remove("active");
}

// Uždaryti modalą
function closeModal() {
  document.getElementById("modal").classList.remove("active");
}

// Uždaryti modalą paspaudus už jo ribų
function setupModalHandlers() {
  document.getElementById("modal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeModal();
    }
  });

  document.getElementById("quizModal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeQuizModal();
    }
  });
}

// Uždaryti modalą paspaudus ESC
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeModal();
    closeQuizModal();
  }
});

// Inicializacija - paleidžiama kai puslapis įkrautas
document.addEventListener("DOMContentLoaded", function () {
  markLearnedFromStorage();
  updateStats();
  setupTermClickHandlers();
  setupSubsectionHandlers();
  setupSearch();
  setupModalHandlers();

  // Collapse all sections by default
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.add("collapsed");
  });

  // Collapse all subsections by default
  document.querySelectorAll(".subsection").forEach((subsection) => {
    subsection.classList.add("collapsed");
  });

  // Apply initial filters (show unlearned by default)
  applyFilters();
});
