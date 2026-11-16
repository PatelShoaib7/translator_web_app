// Supported languages list
const languages = {
  "en": "English",
  "hi": "Hindi",
  "mr": "Marathi",
  "es": "Spanish",
  "fr": "French",
  "de": "German",
  "ja": "Japanese",
  "zh-CN": "Chinese",
  "ar": "Arabic",
  "ru": "Russian",
  "pt": "Portuguese",
  "it": "Italian",
  "ko": "Korean",
  "bn": "Bengali",
  "ta": "Tamil",
  "te": "Telugu",
  "gu": "Gujarati",
  "ur": "Urdu"
};

// Select DOM elements
const sourceLang = document.getElementById("source-lang");
const targetLang = document.getElementById("target-lang");
const swapBtn = document.getElementById("swap-btn");
const inputText = document.getElementById("input-text");
const outputText = document.getElementById("output-text");
const translateBtn = document.getElementById("translate-btn");
const clearBtn = document.getElementById("clear-btn");
const charCount = document.getElementById("char-count");
const statusBadge = document.getElementById("status-badge");
const errorMsg = document.getElementById("error-msg");

const copyInputBtn = document.getElementById("copy-input-btn");
const copyOutputBtn = document.getElementById("copy-output-btn");
const speakInputBtn = document.getElementById("speak-input-btn");
const speakOutputBtn = document.getElementById("speak-output-btn");

const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeLabel = document.getElementById("theme-label");

const HISTORY_KEY = "translator_recent_history";
const THEME_KEY = "translator_theme";
let debounceTimer = null;

// Day / Night Theme Toggle
function applyTheme(theme) {
  const icon = themeToggleBtn.querySelector("i");
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    icon.className = "fa-solid fa-sun";
    themeLabel.textContent = "Day Mode";
  } else {
    document.body.classList.remove("dark-mode");
    icon.className = "fa-solid fa-moon";
    themeLabel.textContent = "Night Mode";
  }
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
}

// 1. Populate language dropdowns on load
function populateLanguages() {
  for (const [code, name] of Object.entries(languages)) {
    const option1 = document.createElement("option");
    option1.value = code;
    option1.textContent = name;

    const option2 = document.createElement("option");
    option2.value = code;
    option2.textContent = name;

    sourceLang.appendChild(option1);
    targetLang.appendChild(option2);
  }

  // Default selection: English -> Hindi
  sourceLang.value = "en";
  targetLang.value = "hi";
}

// 2. Auto-resize textarea and update character count
function updateInputUI() {
  const length = inputText.value.length;
  charCount.textContent = `${length} / 500`;

  if (length >= 450) {
    charCount.classList.add("limit-near");
  } else {
    charCount.classList.remove("limit-near");
  }

  // Show or hide Clear button
  clearBtn.style.display = length > 0 ? "inline-block" : "none";

  // Auto-adjust textarea height
  inputText.style.height = "auto";
  outputText.style.height = "auto";
  const newHeight = Math.max(190, inputText.scrollHeight);
  inputText.style.height = `${newHeight}px`;
  outputText.style.height = `${newHeight}px`;
}

// 3. Translate text using MyMemory free API
async function translateText(saveHistory = true) {
  const text = inputText.value.trim();
  errorMsg.textContent = "";

  if (!text) {
    outputText.value = "";
    return;
  }

  if (!navigator.onLine) {
    statusBadge.textContent = "Offline";
    statusBadge.className = "status-badge offline";
    errorMsg.textContent = "No internet connection.";
    return;
  }

  // If both languages are the same, no API call needed
  if (sourceLang.value === targetLang.value) {
    outputText.value = text;
    return;
  }

  // Show loading state
  translateBtn.disabled = true;
  statusBadge.textContent = "Translating...";
  statusBadge.className = "status-badge loading";

  try {
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${sourceLang.value}|${targetLang.value}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error("Server error. Please try again.");
    }

    const data = await response.json();

    if (data.responseStatus === 429 || data.quotaFinished) {
      throw new Error("Daily translation limit reached. Try again later.");
    }

    const translated = data.responseData?.translatedText;
    if (!translated) {
      throw new Error("Could not translate this text.");
    }

    outputText.value = translated;
    statusBadge.textContent = "Ready";
    statusBadge.className = "status-badge";

    if (saveHistory) {
      addToHistory(text, translated, sourceLang.value, targetLang.value);
    }
  } catch (error) {
    statusBadge.textContent = "Error";
    statusBadge.className = "status-badge offline";
    errorMsg.textContent = error.message || "Network error occurred.";
  } finally {
    translateBtn.disabled = false;
    updateInputUI();
  }
}

// 4. Swap source & target languages and text
function swapLanguages() {
  const tempLang = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = tempLang;

  const tempText = inputText.value;
  inputText.value = outputText.value;
  outputText.value = tempText;

  updateInputUI();
  if (inputText.value.trim()) {
    translateText(true);
  }
}

// 5. Copy text to clipboard with green checkmark feedback
async function copyToClipboard(text, buttonElement) {
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);
    const icon = buttonElement.querySelector("i");
    const originalClass = icon.className;

    buttonElement.classList.add("copied");
    icon.className = "fa-solid fa-check";

    setTimeout(() => {
      buttonElement.classList.remove("copied");
      icon.className = originalClass;
    }, 2000);
  } catch (err) {
    errorMsg.textContent = "Failed to copy text.";
  }
}

// 6. Text-to-Speech using browser SpeechSynthesis API
function speakText(text, langCode) {
  if (!text.trim()) return;

  if (!("speechSynthesis" in window)) {
    errorMsg.textContent = "Speech not supported in this browser.";
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  window.speechSynthesis.speak(utterance);
}

// 7. Save and render recent translations using localStorage
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function addToHistory(source, translated, fromLang, toLang) {
  let history = getHistory();

  // Remove existing duplicate if same text was already saved
  history = history.filter(
    (item) => !(item.source.toLowerCase() === source.toLowerCase() && item.fromLang === fromLang && item.toLang === toLang)
  );

  history.unshift({ source, translated, fromLang, toLang });

  // Keep only the last 8 translations
  history = history.slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-history";
    emptyItem.textContent = "No recent translations yet.";
    historyList.appendChild(emptyItem);
    clearHistoryBtn.style.display = "none";
    return;
  }

  clearHistoryBtn.style.display = "inline-block";

  history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const langsDiv = document.createElement("div");
    langsDiv.className = "history-langs";
    langsDiv.textContent = `${languages[item.fromLang] || item.fromLang} → ${languages[item.toLang] || item.toLang}`;

    const textsDiv = document.createElement("div");
    textsDiv.className = "history-texts";
    const sourceSpan = document.createElement("span");
    sourceSpan.textContent = `${item.source} — `;
    const translatedStrong = document.createElement("strong");
    translatedStrong.textContent = item.translated;

    textsDiv.appendChild(sourceSpan);
    textsDiv.appendChild(translatedStrong);

    li.appendChild(langsDiv);
    li.appendChild(textsDiv);

    // Click history item to load it back into the translator
    li.addEventListener("click", () => {
      sourceLang.value = item.fromLang;
      targetLang.value = item.toLang;
      inputText.value = item.source;
      outputText.value = item.translated;
      updateInputUI();
    });

    historyList.appendChild(li);
  });
}

// 8. Event Listeners
inputText.addEventListener("input", () => {
  updateInputUI();

  // Auto-translate after user pauses typing for 800ms
  clearTimeout(debounceTimer);
  if (!inputText.value.trim()) {
    outputText.value = "";
    errorMsg.textContent = "";
    return;
  }

  debounceTimer = setTimeout(() => {
    translateText(true);
  }, 800);
});

translateBtn.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  if (!inputText.value.trim()) {
    errorMsg.textContent = "Please enter some text first.";
    inputText.focus();
    return;
  }
  translateText(true);
});

clearBtn.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  window.speechSynthesis?.cancel();
  inputText.value = "";
  outputText.value = "";
  errorMsg.textContent = "";
  updateInputUI();
  inputText.focus();
});

swapBtn.addEventListener("click", swapLanguages);

sourceLang.addEventListener("change", () => {
  if (inputText.value.trim()) translateText(true);
});

targetLang.addEventListener("change", () => {
  if (inputText.value.trim()) translateText(true);
});

copyInputBtn.addEventListener("click", () => copyToClipboard(inputText.value, copyInputBtn));
copyOutputBtn.addEventListener("click", () => copyToClipboard(outputText.value, copyOutputBtn));

speakInputBtn.addEventListener("click", () => speakText(inputText.value, sourceLang.value));
speakOutputBtn.addEventListener("click", () => speakText(outputText.value, targetLang.value));

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

themeToggleBtn.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  const nextTheme = isDark ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
});

window.addEventListener("online", () => {
  statusBadge.textContent = "Ready";
  statusBadge.className = "status-badge";
});

window.addEventListener("offline", () => {
  statusBadge.textContent = "Offline";
  statusBadge.className = "status-badge offline";
});

// Initialize app
loadSavedTheme();
populateLanguages();
updateInputUI();
renderHistory();
