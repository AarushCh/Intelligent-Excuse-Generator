// --- CONFIGURATION ---
const API_BASE = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" || window.location.protocol === "file:")
    ? "http://127.0.0.1:8000"
    : "https://auc6-intelligent-excuse-generator.hf.space";

// --- 1. TOAST NOTIFICATIONS (Replaces native alerts) ---
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast - ${type} `;
    toast.innerHTML = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Override native alert globally for minimal refactoring
window.alert = (msg) => showToast(msg, 'info');

// --- 2. CENTRALIZED API CALLER ---
async function callApi(endpoint, body = null) {
    const options = { headers: { "Content-Type": "application/json" } };
    if (body) {
        options.method = "POST";
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint} `, options);
        if (!res.ok) { throw new Error(`HTTP error! status: ${res.status} `); }
        return await res.json();
    } catch (err) {
        console.error(`API Error(${endpoint}): `, err);
        return null;
    }
}

// --- 3. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Inject required styles for JS animations and toasts
    const style = document.createElement('style');
    style.textContent = `
    .screenshot - loading { opacity: 0.7; pointer - events: none; }
/* Toast Styles */
#toast - container { position: fixed; bottom: 30px; right: 30px; z - index: 9999; display: flex; flex - direction: column; gap: 12px; }
`;
    document.head.appendChild(style);

    // Load Theme
    const isDark = localStorage.getItem("darkMode") === "enabled";
    document.getElementById("themeToggle").checked = isDark;
    if (isDark) toggleDarkModeSwitch();

    // Set Date
    const ts = document.getElementById("timestamp");
    if (ts) ts.textContent = "📅 " + new Date().toLocaleString();

    // Setup Input Listeners
    const input = document.getElementById('scenario');
    if (input) input.addEventListener("input", handleScenarioInput);
});

// --- SPA NAV ROUTING ---
function switchPage(pageId, btnElement) {
    // Hide all pages
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    // Activate target
    document.getElementById(pageId).classList.add('active');
    btnElement.classList.add('active');

    // Play a tiny audio cue if desired
    playClickSound();
}

// --- 4. GENERATORS ---

async function getExcuse() {
    const els = {
        scenario: document.getElementById('scenario').value,
        urgency: document.getElementById('urgency').value,
        language: document.getElementById('language').value,
        style: document.getElementById('excuseStyle').value
    };

    if (!els.scenario) return showToast("Please enter a scenario.", "error");

    const data = await callApi('/api/excuse', els);

    if (data) {
        const out = document.getElementById('excuseOut');
        out.classList.remove('placeholder');
        out.innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.english}`;
        const trans = document.getElementById('translatedOut');
        if (trans) trans.innerText = els.language !== "en" ? "Translation: " + data.translated : "";
        showToast("Excuse generated successfully!", "success");
    } else {
        document.getElementById('excuseOut').innerHTML = "❌ Connection failed. Backend offline?";
        showToast("Backend connection failed.", "error");
    }
}

async function generateApology() {
    const body = {
        context: document.getElementById('apologyContext').value,
        tone: document.getElementById('tone').value,
        type: document.getElementById('messageType').value,
        style: document.getElementById('apologyStyle').value,
        language: document.getElementById('language').value
    };

    if (!body.context) return showToast("Please enter context.", "error");

    const data = await callApi('/api/apology', body);
    if (data) {
        const out = document.getElementById('apologyOut');
        out.classList.remove('placeholder');
        out.innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.message}`;
        showToast("Apology generated successfully!", "success");
    } else {
        showToast("Backend connection failed.", "error");
    }
}

// --- 5. TONE & COMPLETION ---

async function applyTone() {
    const tone = document.getElementById("adjustTone").value;
    const sentence = document.getElementById("apologyOut").innerText;
    if (!tone || !sentence) return showToast("Generate an apology first.", "error");

    const btn = event.target;
    const original = btn.innerText;
    btn.innerText = "⏳ Adjusting...";
    btn.disabled = true;

    const data = await callApi('/api/adjust-tone', { tone, sentence });
    if (data?.adjusted) {
        const out = document.getElementById("apologyOut");
        out.classList.remove('placeholder');
        out.innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.adjusted}`;
        saveApologyToAllSystems(data.adjusted);
        showToast("Tone adjusted successfully!", "success");
    } else {
        showToast("Failed to adjust tone.", "error");
    }
    btn.innerText = original;
    btn.disabled = false;
}

async function completeApology() {
    const start = document.getElementById("startApology").value;
    const tone = document.getElementById("adjustTone").value || "formal";
    if (!start) return showToast("Enter start text.", "error");

    const data = await callApi('/api/complete-apology', { start, tone });
    if (data?.completed) {
        const out = document.getElementById("apologyOut")
        out.classList.remove('placeholder');
        out.innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.completed}`;
        saveApologyToAllSystems(data.completed);
        showToast("Apology completed successfully!", "success");
    } else {
        showToast("Failed to complete apology.", "error");
    }
}

async function showGuiltScore() {
    const text = document.getElementById('apologyOut').innerText;
    if (!text) return showToast("No apology found.", "error");
    const data = await callApi('/api/guilt-score', { text });
    if (data && data.feedback) {
        showToast(`🧠 Guilt Level:\n\n${data.feedback}`, "info");
    } else {
        showToast("Error analyzing text.", "error");
    }
}

// --- 6. SCREENSHOTS (Consolidated Logic) ---

async function generateScreenshot(type) {
    const btn = event.target;
    const theme = document.getElementById("screenshotTheme") ? document.getElementById("screenshotTheme").value : (localStorage.getItem("darkMode") === "enabled" ? "dark" : "light");

    btn.classList.add("screenshot-loading");
    btn.disabled = true;

    const data = await callApi(`/api/screenshot-${type}`, { theme });

    if (data?.url) {
        const img = document.getElementById("proofImg");
        const dlBtn = document.getElementById("downloadBtn");

        img.src = data.url;
        img.style.display = "block";
        dlBtn.style.display = "inline-block";

        dlBtn.onclick = async () => {
            try {
                showToast("Downloading screenshot...", "info");
                const blob = await (await fetch(data.url)).blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${type}_proof.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (e) { showToast("Download failed, try right-clicking image.", "error"); }
        };
        window.screenshotUrl = data.url;
        showToast("Screenshot ready!", "success");
    } else {
        showToast("Screenshot failed.", "error");
    }
    btn.classList.remove("screenshot-loading");
    btn.disabled = false;
}

// --- 7. LIST LOADERS (Consolidated Logic) ---

async function loadList(endpoint, elementId, isHistory = false) {
    const data = await callApi(endpoint);
    const list = document.getElementById(elementId);
    if (!data || !list) return;

    const array = data.history || data.favorites || data;
    if (!array || !array.length) {
        list.innerHTML = "<li style='text-align:center;color:#666'>No items.</li>";
        return;
    }

    list.innerHTML = array.map((item, idx) => {
        if (elementId.includes('rankings') || elementId.includes('Top')) {
            return `<li><span class="count-badge">🧠${item.score || 0}</span> ${["🥇", "🥈", "🥉"][idx] || "🎖"} ${item.text}</li>`;
        }

        let removalEndpoint = "";
        if (elementId === 'favoritesList') removalEndpoint = '/api/favorite';
        if (elementId === 'apolFavoritesList') removalEndpoint = '/api/apology-favorite';

        if (!isHistory && removalEndpoint) {
            const escapedText = item.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            return `<li style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span>${item}</span>
                <button class="btn-action" style="padding:4px 8px; font-size:0.8rem; margin-left:10px;" onclick="removeFavorite('${removalEndpoint}', '${escapedText}', this)"><i class="fa-solid fa-trash"></i></button>
            </li>`;
        }

        return isHistory
            ? `<li><strong>${item.time}</strong><br>${item.text}</li>`
            : `<li>${item}</li>`;
    }).join("");
}

async function removeFavorite(endpoint, text, btnElement) {
    // Optimistic UI removal
    const li = btnElement.closest('li');
    if (li) li.style.display = 'none';

    const options = {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (res.ok) {
            showToast("Removed from favorites", "success");
            if (li) li.remove();
        } else {
            showToast("Failed to remove item", "error");
            if (li) li.style.display = 'flex'; // Restore if failed
        }
    } catch {
        showToast("Network error removing item", "error");
        if (li) li.style.display = 'flex'; // Restore if failed
    }
}

// Short wrappers for specific lists
// Short wrappers for specific lists
const loadHistory = () => loadList('/api/history', 'historyList', true);
const loadFavorites = () => loadList('/api/favorites', 'favoritesList');
const loadRankings = () => loadList('/api/rankings', 'rankingsList');
const loadApologyHistory = () => loadList('/api/apology-history', 'apolHistoryList', true);
const loadApologyFavorites = () => loadList('/api/apology-favorites', 'apolFavoritesList');
const loadTopApologies = () => loadList('/api/top-apologies', 'apolTopList');

// Calendars need special formatting
const loadCalendar = () => callApi('/api/calendar').then(d => buildCalendar(document.getElementById('calendarList'), d));
const loadApologyCalendar = () => callApi('/api/apology-calendar').then(d => buildCalendar(document.getElementById('apolCalList'), d));

function buildCalendar(target, data) {
    if (!target) return;
    if (!data || !data.length) { target.innerHTML = "<p style='text-align:center'>No records.</p>"; return; }
    const grouped = {};
    data.forEach(i => (grouped[i.date] ??= []).push(i));
    target.innerHTML = Object.keys(grouped).map(d => `<h4>${d}</h4><ul>${grouped[d].map(i => `<li><strong>${i.time}</strong> – ${i.text}</li>`).join("")}</ul>`).join("");
}

// --- 8. UTILITIES (Save, Audio, UI) ---

function saveApologyToAllSystems(text) {
    callApi('/api/save-apology-history', { text, time: new Date().toLocaleString() });
    callApi('/api/update-latest-apology', { text });
}

function saveFavorite(type = 'excuse', btnElement) {
    const endpoint = type === 'excuse' ? '/api/favorite' : '/api/apology-favorite';
    callApi(endpoint, {}).then(d => {
        if (d) {
            showToast(d.message, "success");
            if (btnElement) {
                btnElement.innerHTML = `<i class="fa-solid fa-heart" style="color:var(--primary);"></i>`;
            }
        }
    });
}

// Explicit wrappers for HTML buttons
function saveApologyFavorite(btnElement) { saveFavorite('apology', btnElement); }
function clearTopExcuses() { if (confirm("Erase?")) callApi('/api/clear-rankings', {}).then(() => { loadRankings(); showToast("Excuses cleared.", "info"); }); }
function clearTopApologies() { if (confirm("Erase?")) callApi('/api/clear-apology-rankings', {}).then(() => { loadTopApologies(); showToast("Apologies cleared.", "info"); }); }
function clearFavorites() { if (confirm("Erase all favorites?")) callApi('/api/clear-favorites', {}).then(d => { if (d) { loadFavorites(); showToast("Favorites cleared.", "info"); } else showToast("Failed to clear.", "error"); }); }
function clearApologyFavorites() { if (confirm("Erase all favorite apologies?")) callApi('/api/clear-apology-favorites', {}).then(d => { if (d) { loadApologyFavorites(); showToast("Favorites cleared.", "info"); } else showToast("Failed to clear.", "error"); }); }

function playVoice(targetId) {
    const text = document.getElementById(targetId)?.innerText;
    if (text) {
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = 0.3; // Reduce volume to 30%
        speechSynthesis.speak(utterance);
    }
}
function playApologyVoice() { playVoice('apologyOut'); }
function playClickSound() {
    const s = document.getElementById('clickSound');
    if (s) s.play().catch(() => { });
}

function toggleBox(id, btn) {
    const target = document.getElementById(id);
    const isVisible = !target.classList.contains('hidden');
    playClickSound();

    document.querySelectorAll(".toggle-box").forEach(b => b.classList.add('hidden'));

    if (!isVisible) {
        target.classList.remove('hidden');

        // Refresh Data
        if (id.includes('history')) id.includes('apol') ? loadApologyHistory() : loadHistory();
        else if (id.includes('fav')) id.includes('apol') ? loadApologyFavorites() : loadFavorites();
        else if (id.includes('rank') || id.includes('Top')) id.includes('apol') ? loadTopApologies() : loadRankings();
        else if (id.includes('cal')) id.includes('apol') ? loadApologyCalendar() : loadCalendar();
    }
}

function toggleDarkModeSwitch() {
    const isDark = document.getElementById("themeToggle").checked;
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");

    const lbl = document.getElementById("themeLabel");
    if (lbl) lbl.textContent = isDark ? "Dark Mode" : "Light Mode";

    const vid = document.getElementById("video-source");
    const vidWebm = document.getElementById("video-source-webm");
    if (vid) vid.src = `static/background-${isDark ? 'dark' : 'light'}.mp4`;
    if (vidWebm) vidWebm.src = `static/background-${isDark ? 'dark' : 'light'}.webm`;

    const bgVid = document.getElementById("background-video");
    if (bgVid) bgVid.load();

    const themeInput = document.getElementById("screenshotTheme");
    if (themeInput) themeInput.value = isDark ? "dark" : "light";
}

function handleScenarioInput() {
    const val = this.value.trim();
    const suggest = document.getElementById('memorySuggest');
    if (!val) { suggest.style.display = 'none'; return; }

    callApi(`/api/memory?q=${encodeURIComponent(val)}`).then(d => {
        if (!d || !d.matches || !d.matches.length) { suggest.style.display = 'none'; return; }
        suggest.innerHTML = d.matches.map(t => `<li style="cursor:pointer;padding:4px">${t}</li>`).join("");
        suggest.style.display = 'block';
        Array.from(suggest.children).forEach(li => {
            li.onclick = () => {
                this.value = li.innerText;
                suggest.style.display = 'none';
            }
        });
    });
}

// --- 9. CLIPBOARD LOGIC ---
function copyToClipboard(elementId, btnElement) {
    const textTarget = document.getElementById(elementId);
    if (!textTarget || textTarget.classList.contains('placeholder')) return showToast("Nothing to copy!", "error");

    const plainText = textTarget.innerHTML.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]*>?/gm, '').trim();

    const finishCopy = () => {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
        btnElement.style.color = "var(--primary)";
        btnElement.style.borderColor = "var(--primary)";
        showToast("Copied to clipboard!", "success");
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.style.color = "";
            btnElement.style.borderColor = "";
        }, 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(plainText).then(finishCopy).catch(() => fallbackCopyTextToClipboard(plainText, finishCopy));
    } else {
        fallbackCopyTextToClipboard(plainText, finishCopy);
    }
}

function fallbackCopyTextToClipboard(text, successCallback) {
    let textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        var successful = document.execCommand('copy');
        if (successful) successCallback();
        else showToast("Copy failed in your browser.", "error");
    } catch (err) {
        showToast("Copy not supported.", "error");
    }
    document.body.removeChild(textArea);
}

function collectDestinations() {
    return { email: document.getElementById('recipientEmail')?.value || "" };
}

function triggerEmergency() {
    callApi('/api/emergency', collectDestinations()).then(() => showToast("🚨 Emergency Triggered!", "error"));
}

function scheduleEmergency() {
    const date = document.getElementById('scheduleDate').value;
    const time = document.getElementById('scheduleTime').value;
    if (!date || !time) return showToast("Set date/time", "error");
    callApi('/api/schedule', { date, time, ...collectDestinations() }).then(d => d && showToast(d.message, "success"));
}