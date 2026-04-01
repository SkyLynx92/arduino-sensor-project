const SUPABASE_URL = "https://xubpyvplopdcuhlngrxh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YnB5dnBsb3BkY3VobG5ncnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjQ4OTEsImV4cCI6MjA4ODcwMDg5MX0.wfnigqncwBmckraRazS9BO8iBnKM7ucX6600SrrY8fU";

const STORAGE_KEYS = {
  tempThreshold: "sensor_dashboard_temp_threshold",
  humidityThreshold: "sensor_dashboard_humidity_threshold",
  pollSeconds: "sensor_dashboard_poll_seconds"
};

const DEFAULTS = {
  tempThreshold: 35,
  humidityThreshold: 80,
  pollSeconds: 10
};

const els = {
  refreshBtn: document.getElementById("refresh-btn"),
  status: document.getElementById("status"),
  tempValue: document.getElementById("temp-value"),
  humidityValue: document.getElementById("humidity-value"),
  tempTime: document.getElementById("temp-time"),
  humidityTime: document.getElementById("humidity-time"),
  chartCanvas: document.getElementById("readings-chart"),
  tempThreshold: document.getElementById("temp-threshold"),
  humidityThreshold: document.getElementById("humidity-threshold"),
  tempThresholdValue: document.getElementById("temp-threshold-value"),
  humidityThresholdValue: document.getElementById("humidity-threshold-value"),
  alertStatus: document.getElementById("alert-status"),
  pollSlider: document.getElementById("poll-seconds"),
  pollValue: document.getElementById("poll-value")
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let chart = null;
let pollIntervalId = null;
let latestReading = null;
let lastAlertSignature = "";
let lastAlertAt = 0;

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#ffd6d6" : "#80ed99";
}

function savePreferences() {
  localStorage.setItem(STORAGE_KEYS.tempThreshold, els.tempThreshold.value);
  localStorage.setItem(STORAGE_KEYS.humidityThreshold, els.humidityThreshold.value);
  localStorage.setItem(STORAGE_KEYS.pollSeconds, els.pollSlider.value);
}

function loadPreferences() {
  els.tempThreshold.value = localStorage.getItem(STORAGE_KEYS.tempThreshold) || String(DEFAULTS.tempThreshold);
  els.humidityThreshold.value =
    localStorage.getItem(STORAGE_KEYS.humidityThreshold) || String(DEFAULTS.humidityThreshold);
  els.pollSlider.value = localStorage.getItem(STORAGE_KEYS.pollSeconds) || String(DEFAULTS.pollSeconds);
  syncPreferenceLabels();
}

function syncPreferenceLabels() {
  els.tempThresholdValue.textContent = els.tempThreshold.value;
  els.humidityThresholdValue.textContent = els.humidityThreshold.value;
  els.pollValue.textContent = els.pollSlider.value;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function updateSummary(readings) {
  if (!readings.length) {
    latestReading = null;
    els.tempValue.textContent = "--";
    els.humidityValue.textContent = "--";
    els.tempTime.textContent = "No data yet.";
    els.humidityTime.textContent = "No data yet.";
    evaluateAlerts();
    return;
  }

  latestReading = readings[0];
  els.tempValue.textContent = Number(latestReading.temperature_c ?? 0).toFixed(1);
  els.humidityValue.textContent = Number(latestReading.humidity ?? 0).toFixed(1);
  const time = `Updated: ${formatTime(latestReading.created_at)}`;
  els.tempTime.textContent = time;
  els.humidityTime.textContent = time;
  evaluateAlerts();
}

function updateChart(readings) {
  const ordered = [...readings].reverse();
  const labels = ordered.map((row) => formatTime(row.created_at));
  const tempData = ordered.map((row) => row.temperature_c);
  const humidityData = ordered.map((row) => row.humidity);

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = tempData;
    chart.data.datasets[1].data = humidityData;
    chart.update();
    return;
  }

  chart = new Chart(els.chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: tempData,
          borderColor: "#ffbe0b",
          backgroundColor: "rgba(255,190,11,0.25)",
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4
        },
        {
          label: "Humidity (%)",
          data: humidityData,
          borderColor: "#43dde6",
          backgroundColor: "rgba(67,221,230,0.22)",
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: "easeOutQuart"
      },
      transitions: {
        active: {
          animation: {
            duration: 450
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#e5fff2", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,0.15)" }
        },
        y: {
          ticks: { color: "#e5fff2" },
          grid: { color: "rgba(255,255,255,0.1)" }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#f5fff8" }
        }
      }
    }
  });
}

function canNotify() {
  return "Notification" in window;
}

async function maybeRequestNotificationPermission() {
  if (!canNotify() || Notification.permission !== "default") {
    return;
  }

  try {
    await Notification.requestPermission();
  } catch (_err) {
    // Permission prompt can fail silently in some browsers.
  }
}

function pushBrowserAlert(message) {
  if (!canNotify()) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification("Sensor Alert", { body: message });
  }
}

function evaluateAlerts() {
  if (!latestReading) {
    els.alertStatus.textContent = "No active alerts.";
    els.alertStatus.classList.remove("danger");
    return;
  }

  const tempThreshold = Number(els.tempThreshold.value);
  const humidityThreshold = Number(els.humidityThreshold.value);

  const temp = Number(latestReading.temperature_c ?? 0);
  const humidity = Number(latestReading.humidity ?? 0);

  const alerts = [];
  if (temp > tempThreshold) {
    alerts.push(`Temperature ${temp.toFixed(1)}°C > ${tempThreshold}°C`);
  }
  if (humidity > humidityThreshold) {
    alerts.push(`Humidity ${humidity.toFixed(1)}% > ${humidityThreshold}%`);
  }

  if (!alerts.length) {
    els.alertStatus.textContent = "No active alerts.";
    els.alertStatus.classList.remove("danger");
    lastAlertSignature = "";
    return;
  }

  const message = alerts.join(" | ");
  els.alertStatus.textContent = `Alert: ${message}`;
  els.alertStatus.classList.add("danger");

  const signature = `${Math.round(temp)}-${Math.round(humidity)}-${tempThreshold}-${humidityThreshold}`;
  const now = Date.now();
  const minIntervalMs = 60000;
  if (signature !== lastAlertSignature || now - lastAlertAt > minIntervalMs) {
    pushBrowserAlert(message);
    lastAlertSignature = signature;
    lastAlertAt = now;
  }
}

function startPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
  }

  const seconds = Number(els.pollSlider.value);
  pollIntervalId = setInterval(fetchReadings, seconds * 1000);
}

async function fetchReadings() {
  setStatus(`Fetching readings every ${els.pollSlider.value}s...`);
  const { data, error } = await supabaseClient
    .from("sensor_data")
    .select("temperature_c,humidity,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
    return;
  }

  updateSummary(data);
  updateChart(data);
  setStatus(`Loaded ${data.length} reading(s). Next refresh in ${els.pollSlider.value}s.`);
}

els.refreshBtn.addEventListener("click", fetchReadings);
els.tempThreshold.addEventListener("input", () => {
  syncPreferenceLabels();
  savePreferences();
  evaluateAlerts();
});
els.humidityThreshold.addEventListener("input", () => {
  syncPreferenceLabels();
  savePreferences();
  evaluateAlerts();
});
els.pollSlider.addEventListener("input", () => {
  syncPreferenceLabels();
  savePreferences();
  startPolling();
});

loadPreferences();
maybeRequestNotificationPermission();
startPolling();
fetchReadings();
