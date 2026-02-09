// --- CONFIGURATION ---
const API_BASE = "https://intelligent-excuse-generator-xqx0.onrender.com";

// --- 1. CENTRALIZED API CALLER (The Magic Fix) ---
// This automatically adds the URL to every single request
async function callApi(endpoint, body = null) {
    const options = { headers: { "Content-Type": "application/json" } };
    if (body) {
        options.method = "POST";
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        return await res.json();
    } catch (err) {
        console.error(`API Error (${endpoint}):`, err);
        return null;
    }
}

// --- 2. INITIALIZATION (Styles & Event Listeners) ---
document.addEventListener('DOMContentLoaded', () => {
    // Inject Loading Styles dynamically
    const style = document.createElement('style');
    style.textContent = `
    .screenshot-loading { opacity: 0.7; pointer-events: none; }
    .bouncing { animation: bounce 0.25s; }
    @keyframes bounce { 0% {transform:scale(1)} 50% {transform:scale(0.95)} 100% {transform:scale(1)} }
    .toggle-box { transition: all 0.3s ease; }
    .fadeSlideIn { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  `;
    document.head.appendChild(style);

    // Initialize Theme
    const isDark = localStorage.getItem("darkMode") === "enabled";
    document.getElementById("themeToggle").checked = isDark;
    if (isDark) toggleDarkModeSwitch();

    // Set Timestamp
    document.getElementById("timestamp").textContent = "📅 " + new Date().toLocaleString();

    // Load Initial Data
    loadRankings();
    loadTopApologies();

    // Setup Memory Suggestions
    const input = document.getElementById('scenario');
    if (input) input.addEventListener("input", handleScenarioInput);
});

// --- 3. CORE FEATURES ---

async function getExcuse() {
    const els = {
        scenario: document.getElementById('scenario').value,
        urgency: document.getElementById('urgency').value,
        language: document.getElementById('language').value,
        style: document.getElementById('excuseStyle').value
    };

    if (!els.scenario) return alert("Please enter a scenario.");

    const data = await callApi('/api/excuse', els);

    if (data) {
        document.getElementById('excuseOut').innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.english}`;
        document.getElementById('translatedOut').innerText = els.language !== "en" ? "Translation: " + data.translated : "";
        playVoice('excuseOut');
    } else {
        document.getElementById('excuseOut').innerHTML = "❌ Connection failed. Is the backend running?";
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

    if (!body.context) return alert("Please enter context.");

    const data = await callApi('/api/apology', body);
    if (data) {
        document.getElementById('apologyOut').innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.message}`;
    }
}

async function applyTone() {
    const tone = document.getElementById("adjustTone").value;
    const sentence = document.getElementById("apologyOut").innerText;
    if (!tone || !sentence) return alert("Generate an apology first.");

    const btn = event.target;
    const original = btn.innerText;
    btn.innerText = "⏳ Adjusting...";
    btn.disabled = true;

    const data = await callApi('/api/adjust-tone', { tone, sentence });
    if (data?.adjusted) {
        document.getElementById("apologyOut").innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.adjusted}`;
        saveApologyToAllSystems(data.adjusted);
    }

    btn.innerText = original;
    btn.disabled = false;
}

async function completeApology() {
    const start = document.getElementById("startApology").value;
    const tone = document.getElementById("adjustTone").value || "formal";
    if (!start) return alert("Enter start text.");

    const data = await callApi('/api/complete-apology', { start, tone });
    if (data?.completed) {
        document.getElementById("apologyOut").innerHTML = `<strong>${new Date().toLocaleString()}</strong><br>${data.completed}`;
        saveApologyToAllSystems(data.completed);
    }
}

async function showGuiltScore() {
    const text = document.getElementById('apologyOut').innerText;
    if (!text) return alert("No apology found.");
    const data = await callApi('/api/guilt-score', { text });
    if (data) alert("🧠 Guilt Level:\n\n" + (data.feedback || "Error analyzing text"));
}

// --- 4. SCREENSHOTS ---

async function generateScreenshot(type) {
    const btn = event.target;
    const theme = document.getElementById("screenshotTheme").value;

    btn.classList.add("screenshot-loading");
    btn.disabled = true;

    // Uses the Helper to call correct endpoint: /api/screenshot-excuse OR /api/screenshot-apology
    const data = await callApi(`/api/screenshot-${type}`, { theme });

    if (data?.url) {
        const img = document.getElementById("proofImg");
        const dlBtn = document.getElementById("downloadBtn");

        img.src = data.url;
        img.style.display = "block";
        dlBtn.style.display = "inline-block";

        dlBtn.onclick = async () => {
            const blob = await (await fetch(data.url)).blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${type}_proof.png`;
            a.click();
        };
    } else {
        alert("Screenshot generation failed.");
    }

    btn.classList.remove("screenshot-loading");
    btn.disabled = false;
}

// --- 5. DATA & HISTORY LISTS ---

async function loadList(endpoint, elementId, isHistory = false) {
    const data = await callApi(endpoint);
    const list = document.getElementById(elementId);
    if (!data || !list) return;

    const array = data.history || data.favorites || data;
    if (!array.length) {
        list.innerHTML = "<li style='text-align:center;color:#666'>No items.</li>";
        return;
    }

    list.innerHTML = array.map((item, idx) => {
        if (elementId.includes('rankings') || elementId.includes('Top')) {
            return `<li><span class="count-badge">🧠${item.score || 0}</span> ${["🥇", "🥈", "🥉"][idx] || "🎖"} ${item.text}</li>`;
        }
        return isHistory
            ? `<li><strong>${item.time}</strong><br>${item.text}</li>`
            : `<li>${item}</li>`;
    }).join("");
}

// Wrapper functions for lists
const loadHistory = () => loadList('/api/history', 'historyList', true);
const loadFavorites = () => loadList('/api/favorites', 'favoritesList');
const loadRankings = () => loadList('/api/rankings', 'rankingsList');
const loadApologyHistory = () => loadList('/api/apology-history', 'apolHistoryList', true);
const loadApologyFavorites = () => loadList('/api/apology-favorites', 'apolFavList');
const loadTopApologies = () => loadList('/api/top-apologies', 'apolTopList');

// Calendar specific loader
const loadCalendar = () => callApi('/api/calendar').then(d => buildCalendar(document.getElementById('calendarList'), d));
const loadApologyCalendar = () => callApi('/api/apology-calendar').then(d => buildCalendar(document.getElementById('apolCalList'), d));

function buildCalendar(target, data) {
    if (!target) return;
    if (!data || !data.length) {
        target.innerHTML = "<p style='text-align:center;color:#666'>No records.</p>";
        return;
    }
    const grouped = {};
    data.forEach(i => (grouped[i.date] ??= []).push(i));
    target.innerHTML = Object.keys(grouped).map(d =>
        `<h4>${d}</h4><ul>${grouped[d].map(i => `<li><strong>${i.time}</strong> – ${i.text}</li>`).join("")}</ul>`
    ).join("");
}

// --- 6. UTILITIES (Save, Audio, Theme, Etc) ---

function saveApologyToAllSystems(text) {
    callApi('/api/save-apology-history', { text, time: new Date().toLocaleString() });
    callApi('/api/update-latest-apology', { text });
}

function saveFavorite(type = 'excuse') {
    const endpoint = type === 'excuse' ? '/api/favorite' : '/api/apology-favorite';
    callApi(endpoint, {}).then(d => d && alert(d.message));
}

function clearData(endpoint, reloadFn) {
    if (confirm("Are you sure?")) callApi(endpoint, {}).then(reloadFn);
}

// Explicit wrappers for HTML onclicks
function clearTopExcuses() { clearData('/api/clear-rankings', loadRankings); }
function clearTopApologies() { clearData('/api/clear-apology-rankings', loadTopApologies); }
function saveApologyFavorite() { saveFavorite('apology'); }

function playVoice(targetId) {
    const text = document.getElementById(targetId)?.innerText;
    if (text) {
        const u = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(u);
    }
}
function playApologyVoice() { playVoice('apologyOut'); }

function toggleBox(id, btn) {
    const target = document.getElementById(id);
    const isVisible = target.style.display === "block";

    // Close all others
    document.querySelectorAll(".toggle-box").forEach(b => b.style.display = 'none');

    if (!isVisible) {
        target.style.display = "block";
        target.classList.add('fadeSlideIn');

        // Refresh data when opening
        if (id.includes('history')) id.includes('apol') ? loadApologyHistory() : loadHistory();
        else if (id.includes('favorites') || id.includes('Fav')) id.includes('apol') ? loadApologyFavorites() : loadFavorites();
        else if (id.includes('rank') || id.includes('Top')) id.includes('apol') ? loadTopApologies() : loadRankings();
        else if (id.includes('calendar') || id.includes('Cal')) id.includes('apol') ? loadApologyCalendar() : loadCalendar();
    }

    // Button Animation
    btn.classList.remove('bouncing');
    void btn.offsetWidth; // Trigger reflow
    btn.classList.add('bouncing');
}

function toggleDarkModeSwitch() {
    const isDark = document.getElementById("themeToggle").checked;
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
    document.getElementById("themeLabel").textContent = isDark ? "🌙 Dark Mode" : "🌞 Light Mode";

    // Update Video (Remove leading slash for GitHub Pages)
    const vid = document.getElementById("video-source");
    const vidWebm = document.getElementById("video-source-webm");
    vid.src = `static/background-${isDark ? 'dark' : 'light'}.mp4`;
    vidWebm.src = `static/background-${isDark ? 'dark' : 'light'}.webm`;
    document.getElementById("background-video").load();

    document.getElementById("screenshotTheme").value = isDark ? "dark" : "light";
}

function handleScenarioInput() {
    const val = this.value.trim();
    const suggest = document.getElementById('memorySuggest');
    if (!val) { suggest.style.display = 'none'; return; }

    callApi(`/api/memory?q=${encodeURIComponent(val)}`).then(d => {
        if (!d || !d.matches.length) { suggest.style.display = 'none'; return; }
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

function collectDestinations() {
    return { email: document.getElementById('recipientEmail')?.value || "" };
}

function triggerEmergency() {
    callApi('/api/emergency', collectDestinations()).then(() => alert("🚨 Triggered!"));
}

function scheduleEmergency() {
    const date = document.getElementById('scheduleDate').value;
    const time = document.getElementById('scheduleTime').value;
    if (!date || !time) return alert("Set date/time");
    callApi('/api/schedule', { date, time, ...collectDestinations() }).then(d => alert(d.message));
}