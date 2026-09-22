// script.js

// ==========================================
// 1. CONSTANTS & DOM ELEMENTS
// ==========================================
const API_BASE = 'http://localhost:5000/api';

const algoSelect = document.getElementById('algo-select');
const rpsSlider = document.getElementById('rps-slider');
const rpsVal = document.getElementById('rps-val');
const trafficSlider = document.getElementById('traffic-slider');
const trafficVal = document.getElementById('traffic-val');
const startBtn = document.getElementById('start-btn');

const statTotal = document.getElementById('stat-total');
const statAllowed = document.getElementById('stat-allowed');
const statBlocked = document.getElementById('stat-blocked');
const liveFeed = document.getElementById('live-feed');

// State variables
let isTrafficRunning = false;
let trafficInterval;
let metricsInterval;

// ==========================================
// 2. CHART.JS SETUP
// ==========================================
const ctx = document.getElementById('trafficChart').getContext('2d');

const gradientAllowed = ctx.createLinearGradient(0, 0, 0, 400);
gradientAllowed.addColorStop(0, 'rgba(0, 255, 136, 0.5)'); // Neon green
gradientAllowed.addColorStop(1, 'rgba(0, 255, 136, 0.0)');

const gradientBlocked = ctx.createLinearGradient(0, 0, 0, 400);
gradientBlocked.addColorStop(0, 'rgba(255, 51, 102, 0.5)'); // Neon red
gradientBlocked.addColorStop(1, 'rgba(255, 51, 102, 0.0)');

const chartConfig = {
    type: 'line',
    data: {
        labels: Array(20).fill(''),
        datasets: [
            {
                label: 'Allowed Requests',
                borderColor: '#00ff88',
                backgroundColor: gradientAllowed,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                data: Array(20).fill(0)
            },
            {
                label: 'Blocked Requests',
                borderColor: '#ff3366',
                backgroundColor: gradientBlocked,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                data: Array(20).fill(0)
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { legend: { labels: { color: '#ffffff' } } },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#8b8b9b' } },
            x: { grid: { display: false } }
        }
    }
};
const trafficChart = new Chart(ctx, chartConfig);

// ==========================================
// 3. GSAP ANIMATIONS (UI MAGIC)
// ==========================================

// Page load hote hi elements ko stagger reveal karna
gsap.from("header h1", { opacity: 0, y: -50, duration: 1, ease: "power3.out" });
gsap.from("header p", { opacity: 0, y: -20, duration: 1, delay: 0.3, ease: "power3.out" });

gsap.from(".glass-card", {
    opacity: 0,
    y: 50,
    duration: 0.8,
    stagger: 0.15,
    ease: "back.out(1.7)",
    delay: 0.5
});

// 3D Hover Tilt Effects har glass card par
const allGlassCards = document.querySelectorAll('.glass-card');
allGlassCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;

        gsap.to(card, {
            duration: 0.4,
            rotationX: rotateX,
            rotationY: rotateY,
            transformPerspective: 1000,
            ease: "power1.out",
            overwrite: "auto"
        });
    });

    card.addEventListener('mouseleave', () => {
        gsap.to(card, {
            duration: 0.6,
            rotationX: 0,
            rotationY: 0,
            ease: "power3.out",
            overwrite: "auto"
        });
    });
});

// Button par infinite neon pulse effect
gsap.to("#start-btn", {
    boxShadow: "0px 0px 20px rgba(0, 212, 255, 0.6)",
    repeat: -1,
    yoyo: true,
    duration: 1.5,
    ease: "sine.inOut"
});

// Number Counter smoothly badhane ke liye helper function
function animateNumber(elementId, newValue) {
    const el = document.getElementById(elementId);
    const currentValue = parseInt(el.innerText) || 0;

    if (currentValue !== newValue) {
        gsap.to(el, {
            innerHTML: newValue,
            duration: 0.5,
            snap: { innerHTML: 1 },
            ease: "power1.out"
        });
    }
}

// ==========================================
// 4. API & TRAFFIC LOGIC
// ==========================================

// Config update karna (Backend call)
async function updateConfig() {
    const configData = {
        algorithm: algoSelect.value,
        rps: parseInt(rpsSlider.value),
        burstCapacity: parseInt(rpsSlider.value) * 2,
        windowSize: 10
    };

    await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
    });

    rpsVal.innerText = rpsSlider.value;
    liveFeed.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 20px;">Config updated. Metrics reset.</div>';
}

// Event Listeners for UI Controls
algoSelect.addEventListener('change', updateConfig);
rpsSlider.addEventListener('input', updateConfig);

trafficSlider.addEventListener('input', (e) => {
    trafficVal.innerText = e.target.value;
    if (isTrafficRunning) {
        stopTraffic();
        startTrafficEngine();
    }
});

// Live metrics lana backend se
async function fetchMetrics() {
    try {
        const res = await fetch(`${API_BASE}/metrics`);
        const data = await res.json();

        // GSAP animateNumber ka use kar rahe hain
        animateNumber('stat-total', data.total);
        animateNumber('stat-allowed', data.allowed);
        animateNumber('stat-blocked', data.blocked);

        // Chart Data Update
        const chartDataAllowed = trafficChart.data.datasets[0].data;
        const chartDataBlocked = trafficChart.data.datasets[1].data;

        chartDataAllowed.push(data.allowed);
        chartDataBlocked.push(data.blocked);

        if (chartDataAllowed.length > 20) {
            chartDataAllowed.shift();
            chartDataBlocked.shift();
        }

        trafficChart.update();
    } catch (err) {
        console.error("Backend offline ya connect nahi hua:", err);
    }
}

// API request marna (Simulate user hitting endpoint)
async function fireRequest() {
    try {
        const reqTime = new Date().toLocaleTimeString();
        const res = await fetch(`${API_BASE}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'demo_user' })
        });

        const feedItem = document.createElement('div');
        feedItem.className = 'feed-item';

        if (res.status === 200) {
            feedItem.innerHTML = `<span>[${reqTime}] req_demo_user</span> <span class="status-allowed">ALLOWED (200)</span>`;
        } else {
            feedItem.innerHTML = `<span>[${reqTime}] req_demo_user</span> <span class="status-blocked">BLOCKED (429)</span>`;
        }

        liveFeed.prepend(feedItem);

        if (liveFeed.children.length > 50) {
            liveFeed.removeChild(liveFeed.lastChild);
        }
    } catch (err) { }
}

function startTrafficEngine() {
    const reqsPerSecond = parseInt(trafficSlider.value);
    const intervalTime = 1000 / reqsPerSecond;
    trafficInterval = setInterval(fireRequest, intervalTime);
}

function stopTraffic() {
    clearInterval(trafficInterval);
}

// Start/Stop Engine Button
startBtn.addEventListener('click', () => {
    if (!isTrafficRunning) {
        startTrafficEngine();
        metricsInterval = setInterval(fetchMetrics, 500);
        startBtn.innerText = "🛑 Stop Traffic Engine";
        startBtn.style.background = "linear-gradient(45deg, #ff3366, #ff7b33)";
        isTrafficRunning = true;
    } else {
        stopTraffic();
        clearInterval(metricsInterval);
        startBtn.innerText = "Start Traffic Engine 🚀";
        startBtn.style.background = "linear-gradient(45deg, var(--neon-purple), var(--neon-blue))";
        isTrafficRunning = false;
    }
});

// App Initialize: Current backend config fetch karke UI pe show karo
fetch(`${API_BASE}/config`)
    .then(res => res.json())
    .then(data => {
        algoSelect.value = data.algorithm;
        rpsSlider.value = data.rps;
        rpsVal.innerText = data.rps;
    });