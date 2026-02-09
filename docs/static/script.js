const API_BASE = "https://intelligent-excuse-generator-xqx0.onrender.com";

(function initializeStyles() {
    const loadingStyle = document.createElement('style');
    loadingStyle.textContent = `
        .screenshot-loading {
          opacity: 0.7 !important;
          pointer-events: none;
          position: relative;
        }
        
        .screenshot-loading::after {
          content: '';
          display: inline-block;
          width: 16px;
          height: 16px;
          margin-left: 8px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: buttonSpinner 1s linear infinite;
          vertical-align: middle;
        }
        
        @keyframes buttonSpinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .bouncing {
          animation: bounceEffect 0.25s ease-out;
        }
        
        @keyframes bounceEffect {
          0% { transform: scale(1); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        
        .toggle-box {
          transition: all 0.3s ease;
        }
        
        .fadeSlideIn {
          animation: fadeSlideIn 0.4s ease-out;
        }
        
        .fadeOut {
          animation: fadeOut 0.3s ease-in;
        }
        
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
      `;
    document.head.appendChild(loadingStyle);
})();

// Global variables
let prevRanks = [];
let prevApologyRanks = [];

// Utility function to safely play click sound
function playClickSound() {
    const sound = document.getElementById('clickSound');
    if (sound) {
        sound.play().catch(() => { }); // Silently ignore audio errors
    }
}

function triggerScreenshot(type) {
    const theme = document.getElementById("screenshotTheme").value || "light";
    const btnId = type === 'excuse' ? 'btnExcuseShot' : 'btnApologyShot';
    const btn = document.getElementById(btnId);

    btn.classList.add('screenshot-loading');
    btn.disabled = true;

    fetch(`/api/screenshot-${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme })
    })
        .then(async res => {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            document.getElementById("proofImg").src = url;
            document.getElementById("proofImg").style.display = "block";
            document.getElementById("downloadBtn").style.display = "inline-block";
            window.screenshotUrl = url;
        })
        .catch(() => alert("❌ Failed to capture screenshot."))
        .finally(() => {
            btn.classList.remove('screenshot-loading');
            btn.disabled = false;
        });
}

// Enhanced toggle box function with proper animation handling

let toggleLock = false;

function toggleBox(id, btn) {
    if (toggleLock) return; // Prevent double-trigger
    toggleLock = true;

    const el = document.getElementById(id);
    if (!el || !btn) {
        toggleLock = false;
        return;
    }

    // Play click sound
    playClickSound();

    // Button bounce animation
    btn.classList.remove('bouncing');
    setTimeout(() => btn.classList.add('bouncing'), 10);
    setTimeout(() => btn.classList.remove('bouncing'), 260);

    // Hide all other toggle boxes
    document.querySelectorAll(".toggle-box").forEach((box) => {
        if (box.id !== id && box.style.display === "block") {
            box.classList.add('fadeOut');
            setTimeout(() => {
                box.style.display = "none";
                box.classList.remove('fadeOut');
            }, 300);
        }
    });

    // Toggle selected box
    if (el.style.display === "block") {
        el.classList.add('fadeOut');
        setTimeout(() => {
            el.style.display = "none";
            el.classList.remove('fadeOut');
            toggleLock = false;
        }, 300);
    } else {
        el.style.display = "block";
        el.classList.add('fadeSlideIn');

        const loaderMap = {
            "historyBox": loadHistory,
            "favoritesBox": loadFavorites,
            "rankingsBox": loadRankings,
            "calendarBox": loadCalendar,
            "apolHistoryBox": loadApologyHistory,
            "apolFavBox": loadApologyFavorites,
            "apolCalBox": loadApologyCalendar,
            "apolTopBox": loadTopApologies
        };

        if (loaderMap[id]) loaderMap[id]();

        setTimeout(() => {
            el.classList.remove('fadeSlideIn');
            toggleLock = false; // Release lock after animation
        }, 400);
    }
}

// Screenshot preparation function
function prepareForScreenshot() {
    const personalElements = document.querySelectorAll('.proof-watermark');
    personalElements.forEach(el => {
        el.style.display = 'none';
    });

    const genericWatermark = document.createElement('div');
    genericWatermark.className = 'demo-watermark';
    genericWatermark.textContent = 'Intelligent Excuse Generator';
    genericWatermark.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 20px;
        padding: 6px 16px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: bold;
        background: rgba(255,255,255,0.8);
        color: rgba(0,0,0,0.7);
        z-index: 1000;
        pointer-events: none;
      `;
    document.body.appendChild(genericWatermark);
}

if (navigator.userAgent.includes('Screenshot') ||
    window.location.search.includes('screenshot=true')) {
    prepareForScreenshot();
}

function generateScreenshot(type) {
    const theme = document.getElementById("screenshotTheme").value || "light";
    fetch(`/api/screenshot/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme })
    })
        .then(async res => {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            document.getElementById("proofImg").src = url;
            document.getElementById("proofImg").style.display = "block";
            document.getElementById("downloadBtn").style.display = "inline-block";
            window.screenshotUrl = url;
        });
}

function getExcuse() {
    const scenarioEl = document.getElementById('scenario');
    const urgencyEl = document.getElementById('urgency');
    const languageEl = document.getElementById('language');
    const excuseStyleEl = document.getElementById('excuseStyle');

    if (!scenarioEl || !urgencyEl || !languageEl || !excuseStyleEl) {
        alert("Form elements not found");
        return;
    }

    const body = {
        scenario: scenarioEl.value,
        urgency: urgencyEl.value,
        language: languageEl.value,
        style: excuseStyleEl.value,
    };

    fetch("/api/excuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
        .then((r) => r.json())
        .then((o) => {
            const now = new Date().toLocaleString();
            const excuseOut = document.getElementById('excuseOut');
            const translatedOut = document.getElementById('translatedOut');

            if (excuseOut && o.english) {
                excuseOut.innerHTML = `<strong>${now}</strong><br>${o.english}`;
            } else {
                excuseOut.innerHTML = "❌ Failed to generate excuse.";
            }

            if (translatedOut) {
                translatedOut.innerText =
                    languageEl.value !== "en" ? "Translation: " + o.translated : "";
            }
        })
        .catch((error) => {
            console.error("Excuse generation error:", error);
            alert("Failed to generate excuse");
        });
}

// Voice playback function
function playVoice() {
    const excuseOut = document.getElementById('excuseOut');
    if (excuseOut && excuseOut.innerText.trim()) {
        const utterance = new SpeechSynthesisUtterance(excuseOut.innerText);
        speechSynthesis.speak(utterance);
    }
}

// Apology generation function
function generateApology() {
    const contextEl = document.getElementById('apologyContext');
    const toneEl = document.getElementById('tone');
    const typeEl = document.getElementById('messageType');
    const styleEl = document.getElementById('apologyStyle');
    const languageEl = document.getElementById('language');

    if (!contextEl || !toneEl || !typeEl || !styleEl || !languageEl) {
        alert("Form elements not found");
        return;
    }

    const body = {
        context: contextEl.value,
        tone: toneEl.value,
        type: typeEl.value,
        style: styleEl.value,
        language: languageEl.value,
    };

    fetch("/api/apology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
        .then((r) => r.json())
        .then((o) => {
            const now = new Date().toLocaleString();
            const apologyOut = document.getElementById('apologyOut');
            const translatedOut = document.getElementById('translatedOut');

            if (apologyOut) {
                apologyOut.innerHTML = `<strong>${now}</strong><br>${o.message}`;
            }
            if (translatedOut) {
                translatedOut.innerText = languageEl.value !== "en" ? "Translation: " + o.translated : "";
            }
        })
        .catch((error) => {
            console.error('Apology generation error:', error);
            alert("Failed to generate apology");
        });
}

async function generateScreenshot(mode) {
    const btn = document.querySelector('.action-btn[onclick^="generateScreenshot"]');
    if (btn) {
        btn.classList.add('screenshot-loading');
        btn.disabled = true;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.screenshotUrl = url;

    const theme = document.getElementById("screenshotTheme").value || "light";

    fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme })
    })
        .then(async (response) => {
            if (!response.ok) throw new Error("Screenshot failed");

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const proofImg = document.getElementById("proofImg");
            const dl = document.getElementById("downloadBtn");

            if (proofImg) {
                proofImg.src = objectUrl;
                proofImg.style.display = "block";
            }

            if (dl) {
                dl.style.display = "inline-block";
                window.screenshotUrl = objectUrl;
            }
        })
        .catch(e => alert("❌ Screenshot error: " + e.message))
        .finally(() => {
            // Always clear loading state, even if an error occurs
            if (btn) {
                btn.classList.remove('screenshot-loading');
                btn.disabled = false;
            }
        });
}

async function downloadImage(url, filename = 'excuse.png') {
    if (!window.screenshotUrl) {
        alert("❌ No screenshot found.");
        return;
    }

    // Fetch the image and convert to blob
    const res = await fetch(window.screenshotUrl);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    // Create a hidden link to download it
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "excuse_screenshot.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(blobUrl);
}

async function generateScreenshot(type) {
    const res = await fetch(`/api/screenshot-${type}`, {
        method: "POST",
    });
    const data = await res.json();

    if (data.url) {
        window.screenshotUrl = data.url;
        alert("✅ Screenshot ready! Now click Download Image.");
    } else {
        alert("❌ Screenshot generation failed.");
    }
}

function applyTone() {
    const toneSelect = document.getElementById("adjustTone");
    const apologyOut = document.getElementById("apologyOut");

    if (!toneSelect || !apologyOut) {
        alert("Required elements not found");
        return;
    }

    const tone = toneSelect.value.trim();
    const sentence = apologyOut.innerText.trim();

    if (!tone || !sentence) {
        alert("Select tone and generate apology first!");
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Adjusting...';
    btn.disabled = true;

    fetch("/api/adjust-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, sentence })
    })
        .then((r) => r.json())
        .then((d) => {
            const final = d.adjusted || d.revised || "❌ Error";
            const now = new Date().toLocaleString();

            apologyOut.innerHTML = `<strong>${now}</strong><br>${final}`;
            saveApologyToAllSystems(final);
        })
        .catch((error) => {
            console.error("Tone adjustment error:", error);
            alert("❌ Tone API crashed!");
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

async function screenshotExcuse() {
    await screenshotRequest('excuse');
}

async function screenshotApology() {
    await screenshotRequest('apology');
}

async function screenshotRequest(type) {
    const theme = document.getElementById("themeSelect").value;
    const button = type === "excuse" ? document.querySelector(".btn-excuse") : document.querySelector(".btn-apology");

    const original = button.innerHTML;
    button.innerHTML = "⏳ Generating...";
    button.disabled = true;

    try {
        const res = await fetch(`/api/screenshot-${type}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme })
        });

        const data = await res.json();
        if (data.image_url) {
            const link = document.getElementById("downloadLink");
            link.href = data.image_url;
            link.style.display = "inline-block";
        } else {
            alert("Failed to generate screenshot.");
        }
    } catch (err) {
        alert("Error capturing screenshot");
        console.error(err);
    } finally {
        button.innerHTML = original;
        button.disabled = false;
    }
}


// Complete apology function
function completeApology() {
    const start = document.getElementById("startApology").value.trim();
    const tone = document.getElementById("adjustTone").value.trim() || "formal";

    if (!start) {
        alert("Please enter starting text for apology");
        return;
    }

    fetch("/api/complete-apology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, tone })
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.completed) {
                const now = new Date().toLocaleString();
                const fullApology = `${data.completed}`;
                const apologyOut = document.getElementById("apologyOut");
                apologyOut.innerHTML = `<strong>${now}</strong><br>${fullApology}`;
                saveApologyToAllSystems(fullApology);
                alert("✅ Apology completed!");
            } else {
                alert("❌ Completion API crashed!");
            }
        })
        .catch((e) => {
            console.error("Completion error:", e);
            alert("❌ Completion API crashed!");
        });
}



// Save apology to all systems
function saveApologyToAllSystems(apologyText) {
    if (!apologyText) return;

    const timeString = new Date().toLocaleString();

    // Save to history
    fetch("/api/save-apology-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: apologyText,
            time: timeString
        })
    }).catch(console.error);

    // Update latest apology
    fetch("/api/update-latest-apology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: apologyText })
    }).catch(console.error);
}

// Save favorite excuse
function saveFavorite() {
    fetch("/api/favorite", { method: "POST" })
        .then((r) => r.json())
        .then((d) => alert(d.message))
        .catch((error) => {
            console.error('Save favorite error:', error);
            alert("Failed to save favorite");
        });
}

// Save favorite apology
function saveApologyFavorite() {
    const apologyOut = document.getElementById('apologyOut');
    if (!apologyOut) {
        alert("Apology element not found");
        return;
    }

    const cur = apologyOut.innerText.trim();
    if (!cur) {
        alert("Nothing to save");
        return;
    }

    fetch("/api/apology-favorite", { method: "POST" })
        .then(r => r.json())
        .then(d => alert(d.message || "Done"))
        .catch((error) => {
            console.error('Save apology favorite error:', error);
            alert("Failed to save favorite apology");
        });
}

// Load history function
const loadHistory = () => {
    fetch("/api/history")
        .then((r) => r.json())
        .then((d) => {
            const historyList = document.getElementById('historyList');
            if (historyList) {
                historyList.innerHTML = d.history
                    .map((i) => `<li><strong>${i.time}</strong><br>${i.text}</li>`)
                    .join("");
            }
        })
        .catch(console.error);
};

// Load favorites function
const loadFavorites = () => {
    fetch("/api/favorites")
        .then((r) => r.json())
        .then((d) => {
            const favoritesList = document.getElementById('favoritesList');
            if (favoritesList) {
                favoritesList.innerHTML = d.favorites
                    .map((t) => `<li>${t}</li>`)
                    .join("");
            }
        })
        .catch(console.error);
};

// Load rankings function
function loadRankings() {
    fetch("/api/rankings")
        .then((r) => r.json())
        .then((data) => {
            const rankingsList = document.getElementById('rankingsList');
            if (!rankingsList) return;

            if (!data.length) {
                rankingsList.innerHTML =
                    "<p style='text-align:center;color:#666;font-style:italic'>No top excuses yet.</p>";
                return;
            }

            rankingsList.innerHTML = "";
            data.forEach((item, idx) => {
                const li = document.createElement("li");
                li.innerHTML = `<span class="count-badge">🧠${item.score}</span> ${["🥇", "🥈", "🥉"][idx] || "🎖"
                    } ${item.text}`;

                const prevIndex = prevRanks.findIndex((p) => p.text === item.text);
                if (prevIndex !== -1 && idx < prevIndex) {
                    li.classList.add("rank-up");
                }
                rankingsList.appendChild(li);
            });
            prevRanks = data;
        })
        .catch(console.error);
}

// Load apology history
function loadApologyHistory() {
    fetch("/api/apology-history")
        .then((r) => r.json())
        .then((d) => {
            const apolHistoryList = document.getElementById('apolHistoryList');
            if (apolHistoryList) {
                apolHistoryList.innerHTML = d.history
                    .map((i) => `<li><strong>${i.time}</strong><br>${i.text}</li>`)
                    .join("");
            }
        })
        .catch(console.error);
}

// Load apology favorites
function loadApologyFavorites() {
    fetch("/api/apology-favorites")
        .then((r) => r.json())
        .then((d) => {
            const apolFavList = document.getElementById('apolFavList');
            if (apolFavList) {
                apolFavList.innerHTML = d.favorites
                    .map((t) => `<li>${t}</li>`)
                    .join("");
            }
        })
        .catch(console.error);
}

function displayResults(excuse, apology, showExcuse, showApology) {
    const resultSection = document.getElementById('results-container');
    const excuseDiv = document.getElementById('excuse-output');
    const apologyDiv = document.getElementById('apology-output');

    // Reset
    excuseDiv.style.display = 'none';
    apologyDiv.style.display = 'none';

    if (showExcuse && excuse) {
        excuseDiv.textContent = excuse;
        excuseDiv.style.display = 'block';
    }

    if (showApology && apology) {
        apologyDiv.textContent = apology;
        apologyDiv.style.display = 'block';
    }

    // Show results container if at least one is shown
    resultSection.style.display = (showExcuse || showApology) ? 'flex' : 'none';
}

async function handleSubmit() {
    const res = await fetch("/generate", {
        method: "POST",
        body: new FormData(document.getElementById("excuseForm"))
    });
    const data = await res.json();

    const excuse = data.excuse?.trim() || "";
    const apology = data.apology?.trim() || "";
    const showExcuse = !!excuse;
    const showApology = !!apology;

    displayResults(excuse, apology, showExcuse, showApology);
}

async function generateScreenshot(type) {
    const btn = event.target;
    const img = document.getElementById("proofImg");
    const downloadBtn = document.getElementById("downloadBtn");

    // Add loading class for animation
    btn.classList.add("screenshot-loading");
    btn.disabled = true;
    btn.innerHTML = "📸 Loading...";

    // Optional: Add timestamp to display somewhere or log
    const timestamp = new Date().toLocaleString();

    try {
        const res = await fetch(`/api/screenshot-${type}`, {
            method: "POST",
        });

        const data = await res.json();
        if (data.url) {
            img.src = data.url;
            img.style.display = "block";

            downloadBtn.style.display = "inline-block";
            downloadBtn.onclick = async () => {
                try {
                    const response = await fetch(data.url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    const link = document.createElement("a");
                    link.href = blobUrl;
                    link.download = `${type}_proof_${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error("Download failed:", err);
                    alert("❌ Could not download image.");
                }
            };
        } else {
            console.error("Screenshot failed:", data.error || "No URL returned");
            alert("❌ Screenshot failed.");
        }
    } catch (err) {
        console.error("Screenshot Error:", err);
        alert("❌ Screenshot error.");
    } finally {
        btn.classList.remove("screenshot-loading");
        btn.disabled = false;
        btn.innerHTML = type === "excuse" ? "📸 Screenshot Excuse" : "📸 Screenshot Apology";
    }
}

// Build calendar markup
function buildCalendarMarkup(target, data) {
    if (!target) return;

    const grouped = {};
    data.forEach((i) => (grouped[i.date] ??= []).push(i));

    target.innerHTML = Object.keys(grouped).length
        ? Object.keys(grouped)
            .map((d) =>
                `<h4>${d}</h4><ul>${grouped[d]
                    .map((i) => `<li><strong>${i.time}</strong> – ${i.text}</li>`)
                    .join("")}</ul>`
            )
            .join("")
        : "<p style='text-align:center;color:#666;font-style:italic'>No records yet.</p>";
}

// Load calendar functions
const loadCalendar = () => {
    fetch("/api/calendar")
        .then((r) => r.json())
        .then((d) => buildCalendarMarkup(document.getElementById('calendarList'), d))
        .catch(console.error);
};

const loadApologyCalendar = () => {
    fetch("/api/apology-calendar")
        .then((r) => r.json())
        .then((d) => buildCalendarMarkup(document.getElementById('apolCalList'), d))
        .catch(console.error);
};

// Save to apology history
function saveToApologyHistory(text) {
    if (!text.trim()) return;

    fetch("/api/save-apology-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    })
        .then(() => loadApologyHistory())
        .catch(console.error);
}

// Show guilt score
function showGuiltScore() {
    const apologyOut = document.getElementById('apologyOut');
    if (!apologyOut) {
        alert("Apology element not found");
        return;
    }

    const txt = apologyOut.innerText.trim();
    if (!txt) {
        alert("No apology found!");
        return;
    }

    fetch("/api/guilt-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: txt })
    })
        .then((r) => r.json())
        .then((d) => {
            if (d.error) {
                alert("❌ Error: " + d.error);
                return;
            }
            if (!d.feedback) {
                alert("No feedback received.");
                return;
            }
            alert("🧠 Guilt Level:\n\n" + d.feedback);
        })
        .catch((error) => {
            console.error('Guilt score error:', error);
            alert("❌ Server error");
        });
}

// Load top apologies
function loadTopApologies() {
    fetch("/api/top-apologies")
        .then((r) => r.json())
        .then((d) => {
            const apolTopList = document.getElementById('apolTopList');
            if (!apolTopList) return;

            if (!d.length) {
                apolTopList.innerHTML =
                    "<p style='text-align:center;color:#666;font-style:italic'>No top apologies yet.</p>";
                return;
            }

            apolTopList.innerHTML = "";
            d.forEach((item, idx) => {
                const li = document.createElement("li");
                li.innerHTML = `<span class="count-badge">🧠 ${item.score}</span> ${["🥇", "🥈", "🥉"][idx] || "🎖"
                    } ${item.text}`;

                const prevIndex = prevApologyRanks.findIndex((p) => p.text === item.text);
                if (prevIndex !== -1 && idx < prevIndex) {
                    li.classList.add("rank-up");
                }
                apolTopList.appendChild(li);
            });
            prevApologyRanks = d;
        })
        .catch(console.error);
}

// Clear functions
function clearTopExcuses() {
    if (!confirm("Erase all top excuses?")) return;

    fetch("/api/clear-rankings", { method: "POST" })
        .then(loadRankings)
        .catch(console.error);
}

function clearTopApologies() {
    if (!confirm("Erase all top apologies?")) return;

    fetch("/api/clear-apology-rankings", { method: "POST" })
        .then(loadTopApologies)
        .catch(console.error);
}

// Collect destinations for email
function collectDestinations() {
    const recipientEmail = document.getElementById('recipientEmail');
    const scheduleRecipients = document.getElementById('scheduleRecipients');

    return {
        email: ((recipientEmail ? recipientEmail.value : '') ||
            (scheduleRecipients ? scheduleRecipients.value : '') || '').trim(),
    };
}

// Trigger emergency
function triggerEmergency() {
    fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectDestinations()),
    })
        .then(() => alert("🚨 Emergency Triggered"))
        .catch((error) => {
            console.error('Emergency trigger error:', error);
            alert("Failed to trigger emergency");
        });
}

// Schedule emergency
function scheduleEmergency() {
    const scheduleDate = document.getElementById('scheduleDate');
    const scheduleTime = document.getElementById('scheduleTime');

    if (!scheduleDate || !scheduleTime || !scheduleDate.value || !scheduleTime.value) {
        alert("Pick date & time");
        return;
    }

    fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            date: scheduleDate.value,
            time: scheduleTime.value,
            ...collectDestinations(),
        }),
    })
        .then((r) => r.json())
        .then((d) => alert(d.message))
        .catch((error) => {
            console.error('Schedule emergency error:', error);
            alert("Failed to schedule emergency");
        });
}

// Download screenshot function
function downloadScreenshot() {
    if (window.screenshotUrl) {
        const link = document.createElement('a');
        link.href = window.screenshotUrl;
        link.download = `excuse-generator-${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("No screenshot available. Please generate a screenshot first.");
    }
}

// Dark mode toggle function
function toggleDarkModeSwitch() {
    const themeToggle = document.getElementById("themeToggle");
    const themeLabel = document.getElementById("themeLabel");
    const videoSource = document.getElementById("video-source");
    const videoSourceWebm = document.getElementById("video-source-webm");
    const backgroundVideo = document.getElementById("background-video");

    if (!themeToggle || !themeLabel || !videoSource || !backgroundVideo) {
        console.warn('Theme toggle elements not found');
        return;
    }

    const isDark = themeToggle.checked;
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
    themeLabel.textContent = isDark ? "🌙 Dark Mode" : "🌞 Light Mode";

    // Fix relative paths here:
    videoSource.src = isDark ? "static/background-dark.mp4" : "static/background-light.mp4";
    if (videoSourceWebm)
        videoSourceWebm.src = isDark ? "static/background-dark.webm" : "static/background-light.webm";

    backgroundVideo.load();
    document.getElementById("screenshotTheme").value = isDark ? "dark" : "light";
}

// Initialize theme and setup event listeners
function initializeApp() {
    // Initialize theme
    const themeToggle = document.getElementById("themeToggle");
    const themeLabel = document.getElementById("themeLabel");
    const timestamp = document.getElementById("timestamp");
    const videoSource = document.getElementById("video-source");
    const videoSourceWebm = document.getElementById("video-source-webm");
    const backgroundVideo = document.getElementById("background-video");

    const isDarkMode = localStorage.getItem("darkMode") === "enabled";

    if (themeToggle && themeLabel) {
        themeToggle.checked = isDarkMode;
        themeLabel.textContent = isDarkMode ? "🌙 Dark Mode" : "🌞 Light Mode";
    }

    if (isDarkMode) {
        document.body.classList.add("dark");
        if (videoSource) videoSource.src = "/static/background-dark.mp4";
        if (videoSourceWebm) videoSourceWebm.src = "/static/background-dark.webm";
        if (backgroundVideo) backgroundVideo.load();
    }

    if (timestamp) {
        timestamp.textContent = "📅 " + new Date().toLocaleString();
    }

    // Setup scenario input listener for memory suggestions
    const scenarioInput = document.getElementById('scenario');
    if (scenarioInput) {
        scenarioInput.addEventListener("input", handleScenarioInput);
    }

    // Setup video event listeners
    if (backgroundVideo) {
        backgroundVideo.addEventListener('loadeddata', function () {
            if (backgroundVideo.paused) {
                backgroundVideo.play().catch(e => console.log('Video autoplay prevented:', e));
            }
        });

        backgroundVideo.addEventListener('error', function () {
            console.warn('Video failed to load, switching to fallback');
            const videoBackground = document.querySelector('.video-background');
            if (videoBackground) {
                videoBackground.classList.add('fallback-active');
            }
        });
    }

    // Load initial data
    loadRankings();
    loadTopApologies();
}

// Handle scenario input for memory suggestions
function handleScenarioInput() {
    const scenarioInput = document.getElementById('scenario');
    const memorySuggest = document.getElementById('memorySuggest');

    if (!scenarioInput || !memorySuggest) return;

    const q = scenarioInput.value.trim();

    if (!q) {
        memorySuggest.style.display = "none";
        return;
    }

    fetch("/api/memory?q=" + encodeURIComponent(q))
        .then((r) => r.json())
        .then((d) => {
            if (!d.matches.length) {
                memorySuggest.style.display = "none";
                return;
            }

            memorySuggest.innerHTML = d.matches
                .map((txt) => `<li style="cursor:pointer;padding:2px 0">${txt}</li>`)
                .join("");
            memorySuggest.style.display = "block";

            // Add click handlers to suggestions
            [...memorySuggest.children].forEach((li) => {
                li.onclick = () => {
                    const excuseOut = document.getElementById('excuseOut');
                    if (excuseOut) {
                        excuseOut.innerText = li.textContent;
                    }
                    memorySuggest.style.display = "none";
                };
            });
        })
        .catch((error) => {
            console.error('Memory suggestion error:', error);
            memorySuggest.style.display = "none";
        });
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Legacy window.onload for compatibility
window.onload = () => {
    loadRankings();
    loadTopApologies();
    document.getElementById("screenshotTheme").value =
        document.body.classList.contains("dark") ? "dark" : "light";
};