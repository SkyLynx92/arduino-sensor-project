const STORAGE_KEYS = {
  url: "sensor_dashboard_supabase_url",
  key: "sensor_dashboard_supabase_key"
};

const els = {
  urlInput: document.getElementById("supabase-url"),
  keyInput: document.getElementById("supabase-anon-key"),
  connectBtn: document.getElementById("connect-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  status: document.getElementById("status"),
  tempValue: document.getElementById("temp-value"),
  humidityValue: document.getElementById("humidity-value"),
  tempTime: document.getElementById("temp-time"),
  humidityTime: document.getElementById("humidity-time"),
  chartCanvas: document.getElementById("readings-chart")
};

let supabaseClient = null;
let chart = null;

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#ffd6d6" : "#80ed99";
}

function saveCredentials() {
  localStorage.setItem(STORAGE_KEYS.url, els.urlInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.key, els.keyInput.value.trim());
}

function loadCredentials() {
  els.urlInput.value = localStorage.getItem(STORAGE_KEYS.url) || "";
  els.keyInput.value = localStorage.getItem(STORAGE_KEYS.key) || "";
}

function connect() {
  const supabaseUrl = els.urlInput.value.trim();
  const supabaseAnonKey = els.keyInput.value.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    setStatus("Please provide both Supabase URL and anon key.", true);
    return;
  }

  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  saveCredentials();
  setStatus("Connected. Loading latest readings...");
  fetchReadings();
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function updateSummary(readings) {
  if (!readings.length) {
    els.tempValue.textContent = "--";
    els.humidityValue.textContent = "--";
    els.tempTime.textContent = "No data yet.";
    els.humidityTime.textContent = "No data yet.";
    return;
  }

  const latest = readings[0];
  els.tempValue.textContent = Number(latest.temperature_c ?? 0).toFixed(1);
  els.humidityValue.textContent = Number(latest.humidity ?? 0).toFixed(1);
  const time = `Updated: ${formatTime(latest.created_at)}`;
  els.tempTime.textContent = time;
  els.humidityTime.textContent = time;
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
          backgroundColor: "rgba(255,190,11,0.2)",
          tension: 0.35
        },
        {
          label: "Humidity (%)",
          data: humidityData,
          borderColor: "#43dde6",
          backgroundColor: "rgba(67,221,230,0.2)",
          tension: 0.35
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
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

async function fetchReadings() {
  if (!supabaseClient) {
    setStatus("Connect first to fetch readings.", true);
    return;
  }

  setStatus("Fetching readings...");
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
  setStatus(`Loaded ${data.length} reading(s).`);
}

els.connectBtn.addEventListener("click", connect);
els.refreshBtn.addEventListener("click", fetchReadings);

loadCredentials();
if (els.urlInput.value && els.keyInput.value) {
  connect();
}
