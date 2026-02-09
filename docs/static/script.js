// --- CONFIGURATION ---
const API_BASE = "https://intelligent-excuse-generator-xqx0.onrender.com";

// --- 1. CENTRALIZED API CALLER (The Fix for "Failed to generate") ---
async function callApi(endpoint, body = null) {
    const options = { headers: { "Content-Type": "application/json" } };
    if (body) {
        options.method = "POST";
        options.body = JSON.stringify(body);
    }

    try {
        // This automatically connects to Render for every request
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        return await res.json();
    } catch (err) {
        console.error(`API Error (${endpoint}):`, err);
        return null;
    }
}

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Inject required styles for JS animations
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

    // Load Theme
    const isDark = localStorage.getItem("darkMode") === "enabled";
    document.getElementById("themeToggle").checked = isDark;
    if (isDark) toggleDarkModeSwitch();

    // Set Date
    const ts = document.getElementById("timestamp");
    if (ts) ts.textContent = "📅 " + new Date().toLocaleString();

    // Load Lists
    loadRankings();
    loadTopApologies();

    // Setup Input Listeners
    const input = document.getElementById('scenario');
    if (input) input.addEventListener("input", handleScenarioInput);
});

// --- 3. GENERATORS ---

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
        const trans = document.getElementById('translatedOut');
        if (trans) trans.innerText = els.language !== "en" ? "Translation: " + data.translated : "";
    } else {
        document.getElementById('excuseOut').innerHTML = "❌ Connection failed. Backend offline?";
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

// --- 4. TONE & COMPLETION ---

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

// --- 5. SCREENSHOTS (Consolidated Logic) ---

async function generateScreenshot(type) {
    const btn = event.target;
    const theme = document.getElementById("screenshotTheme").value;

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
                const blob = await (await fetch(data.url)).blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${type}_proof.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (e) { alert("Download failed, try right-clicking image."); }
        };
        window.screenshotUrl = data.url;
    } else {
        alert("Screenshot failed.");
    }
    btn.classList.remove("screenshot-loading");
    btn.disabled = false;
}

// --- 6. LIST LOADERS (Consolidated Logic) ---

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
        return isHistory
            ? `<li><strong>${item.time}</strong><br>${item.text}</li>`
            : `<li>${item}</li>`;
    }).join("");
}

// Short wrappers for specific lists
const loadHistory = () => loadList('/api/history', 'historyList', true);
const loadFavorites = () => loadList('/api/favorites', 'favoritesList');
const loadRankings = () => loadList('/api/rankings', 'rankingsList');
const loadApologyHistory = () => loadList('/api/apology-history', 'apolHistoryList', true);
const loadApologyFavorites = () => loadList('/api/apology-favorites', 'apolFavList');
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

// --- 7. UTILITIES (Save, Audio, UI) ---

function saveApologyToAllSystems(text) {
    callApi('/api/save-apology-history', { text, time: new Date().toLocaleString() });
    callApi('/api/update-latest-apology', { text });
}

function saveFavorite(type = 'excuse') {
    const endpoint = type === 'excuse' ? '/api/favorite' : '/api/apology-favorite';
    callApi(endpoint, {}).then(d => d && alert(d.message));
}

// Explicit wrappers for HTML buttons
function saveApologyFavorite() { saveFavorite('apology'); }
function clearTopExcuses() { if (confirm("Erase?")) callApi('/api/clear-rankings', {}).then(loadRankings); }
function clearTopApologies() { if (confirm("Erase?")) callApi('/api/clear-apology-rankings', {}).then(loadTopApologies); }

function playVoice(targetId) {
    const text = document.getElementById(targetId)?.innerText;
    if (text) speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
function playApologyVoice() { playVoice('apologyOut'); }
function playClickSound() {
    const s = document.getElementById('clickSound');
    if (s) s.play().catch(() => { });
}

function toggleBox(id, btn) {
    const target = document.getElementById(id);
    const isVisible = target.style.display === "block";
    playClickSound();

    document.querySelectorAll(".toggle-box").forEach(b => b.style.display = 'none');

    if (!isVisible) {
        target.style.display = "block";
        target.classList.add('fadeSlideIn');

        // Refresh Data
        if (id.includes('history')) id.includes('apol') ? loadApologyHistory() : loadHistory();
        else if (id.includes('fav')) id.includes('apol') ? loadApologyFavorites() : loadFavorites();
        else if (id.includes('rank') || id.includes('Top')) id.includes('apol') ? loadTopApologies() : loadRankings();
        else if (id.includes('cal')) id.includes('apol') ? loadApologyCalendar() : loadCalendar();
    }

    btn.classList.remove('bouncing');
    void btn.offsetWidth;
    btn.classList.add('bouncing');
}

function toggleDarkModeSwitch() {
    const isDark = document.getElementById("themeToggle").checked;
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");

    const lbl = document.getElementById("themeLabel");
    if (lbl) lbl.textContent = isDark ? "🌙 Dark Mode" : "🌞 Light Mode";

    const vid = document.getElementById("video-source");
    const vidWebm = document.getElementById("video-source-webm");
    if (vid) vid.src = `static/background-${isDark ? 'dark' : 'light'}.mp4`;
    if (vidWebm) vidWebm.src = `static/background-${isDark ? 'dark' : 'light'}.webm`;

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