/**
 * Smart Vehicle Monitoring & Traffic Rule Enforcement System
 * Core Engine & Interactive UI Logic
 */

// Mock RTO Registration and Vehicle Database
const vehicleDB = {
  "MH12QW9087": { owner: "Rajesh Kumar", make: "Bajaj Pulsar 220", rcStatus: "Active", insurance: "Expired (2025-12-10)", fitness: "Valid (2029-04-18)", address: "Baner Road, Pune, MH", type: "Motorcycle" },
  "DL3CAY5521": { owner: "Priya Sharma", make: "Honda Activa 6G", rcStatus: "Active", insurance: "Active (2027-02-14)", fitness: "Valid (2031-10-05)", address: "Saket, New Delhi, DL", type: "Motorcycle" },
  "KA03MM8892": { owner: "Amit Patel", make: "KTM RC 390", rcStatus: "Suspended", insurance: "Active (2026-08-30)", fitness: "Expired (2025-11-22)", address: "Indiranagar, Bengaluru, KA", type: "Motorcycle" },
  "HR26CL0981": { owner: "Sandeep Singh", make: "Hyundai i20", rcStatus: "Active", insurance: "Active (2026-11-15)", fitness: "Valid (2028-06-20)", address: "DLF Phase 3, Gurugram, HR", type: "Car" },
  "KA51MB4321": { owner: "Vikram Reddy", make: "Tesla Model 3", rcStatus: "Active", insurance: "Expired (2026-01-20)", fitness: "Valid (2034-03-12)", address: "Whitefield, Bengaluru, KA", type: "Car" },
  "MH14EU7788": { owner: "Sneha Patil", make: "Maruti Swift", rcStatus: "Active", insurance: "Active (2027-07-09)", fitness: "Valid (2030-05-15)", address: "Pimpri, Pune, MH", type: "Car" },
  "UP16BZ9900": { owner: "Anil Verma", make: "Royal Enfield Classic 350", rcStatus: "Active", insurance: "Expired (2025-09-04)", fitness: "Expired (2025-05-10)", address: "Sector 62, Noida, UP", type: "Motorcycle" }
};

// Simulation State
let currentState = {
  activeView: 'dashboard',
  activeCamera: 'intersection', // intersection, speedtrap, signal, custom, violation_sample
  isPlaying: true,
  logs: [],
  challans: [
    {
      id: "CH-8902",
      timestamp: "2026-05-27 15:42:10",
      camera: "Highway Speed Trap-02",
      plate: "KA51MB4321",
      type: "Speeding",
      value: "92 km/h (Limit: 80)",
      fine: 2000,
      status: "Unpaid"
    },
    {
      id: "CH-8901",
      timestamp: "2026-05-27 14:15:33",
      camera: "Signal Cam-04",
      plate: "KA03MM8892",
      type: "Signal Jumping",
      value: "Red Light Jump (1.8s delay)",
      fine: 5000,
      status: "Unpaid"
    }
  ],
  customVideoFile: null,
  customPreset: 'helmet', // helmet, speed, signal
  
  // Speed Sandbox Calibration Parameters
  sandbox: {
    height: 6.0,       // Camera height (meters)
    pitch: 25,         // Camera pitch angle (degrees)
    roiDistance: 30,   // Tracking ROI Distance (meters)
    fps: 30,           // Framerate (FPS)
    displacement: 120  // Pixel displacement (pixels)
  }
};

// Canvas rendering elements
let monitorCanvas, monitorCtx, monitorVideo;
let animFrameId = null;
let simTime = 0;

// Setup navigation and global listeners
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLogConsole();
  initStats();
  initCameraSelector();
  initCanvasSimulator();
  initSpeedSandbox();
  initChallanTable();
  initUploadWizard();
  
  // Add initial logs
  addLog("SYS", "Smart Traffic Enforcement System v1.1.0 Initialized.");
  addLog("SYS", "Object Detection Engine (YOLOv10) connected [GPU active].");
  addLog("SYS", "ANPR Engine (PaddleOCR) initialized [OCR active].");
  addLog("SYS", "RTO Central Database Link: ACTIVE.");
});

// Navigation Engine
function initNavigation() {
  const menuItems = document.querySelectorAll(".menu-item");
  const pages = document.querySelectorAll(".page-view");
  
  menuItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetView = item.getAttribute("data-target");
      if (!targetView) return;
      
      // Update sidebar visual state
      menuItems.forEach(mi => mi.classList.remove("active"));
      item.classList.add("active");
      
      // Update page view visibility
      pages.forEach(p => p.classList.remove("active"));
      document.getElementById(`${targetView}-page`).classList.add("active");
      
      currentState.activeView = targetView;
      
      // Trigger canvas adjustments or redraws on navigation
      if (targetView === 'monitor') {
        resizeMonitorCanvas();
        startSimulation();
      } else {
        stopSimulation();
      }
      
      if (targetView === 'sandbox') {
        drawSandboxRoad();
      }
    });
  });
}

// Log Console Engine
function initLogConsole() {
  const container = document.getElementById("log-console-container");
  if (!container) return;
  renderLogs();
}

// Add log entry
function addLog(topic, msg, type = 'normal') {
  const timestamp = new Date().toLocaleTimeString();
  currentState.logs.push({ timestamp, topic, msg, type });
  if (currentState.logs.length > 50) currentState.logs.shift();
  renderLogs();
}

function renderLogs() {
  const container = document.getElementById("log-console-container");
  if (!container) return;
  
  container.innerHTML = currentState.logs.map(log => `
    <div class="log-entry">
      <span class="log-time">[${log.timestamp}]</span>
      <span class="log-topic">[${log.topic}]</span>
      <span class="log-msg ${log.type}">${log.msg}</span>
    </div>
  `).join('');
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Stats & Dashboard Dashboard Update
function initStats() {
  updateDashboardCounters();
}

function updateDashboardCounters() {
  const challanCountEl = document.getElementById("stat-challans");
  const unpaidFineEl = document.getElementById("stat-fines");
  const complianceEl = document.getElementById("stat-compliance");
  const activeCamsEl = document.getElementById("stat-cams");
  
  if (!challanCountEl) return;
  
  const totalChallans = currentState.challans.length;
  const totalFines = currentState.challans.reduce((sum, item) => sum + item.fine, 0);
  
  challanCountEl.innerText = totalChallans;
  unpaidFineEl.innerText = `₹${totalFines.toLocaleString('en-IN')}`;
  
  // Compliance Rate Simulation
  const complianceRate = 96.4; // constant demo
  complianceEl.innerText = `${complianceRate}%`;
  
  activeCamsEl.innerText = "14 / 16";
}

// Camera Feeds Selection
function initCameraSelector() {
  const dropdown = document.getElementById("camera-select");
  if (!dropdown) return;
  
  dropdown.addEventListener("change", (e) => {
    switchCamera(e.target.value);
  });
}

function switchCamera(camId) {
  currentState.activeCamera = camId;
  addLog("CAMERA", `Switched live feed to: ${camId.toUpperCase()}`);
  
  // Reset simulation timers and states
  simTime = 0;
  
  const videoInputSection = document.getElementById("custom-video-input-section");
  const presetSelector = document.getElementById("custom-preset-selector");
  const mainVideoContainer = document.getElementById("monitor-video-container");
  
  if (camId === 'custom') {
    videoInputSection.style.display = 'block';
    presetSelector.style.display = 'block';
    mainVideoContainer.style.display = 'none';
  } else if (camId === 'violation_sample') {
    videoInputSection.style.display = 'none';
    presetSelector.style.display = 'block';
    mainVideoContainer.style.display = 'block';
    if (monitorVideo) {
      monitorVideo.src = 'violation_sample.mp4';
      monitorVideo.play().catch(e => console.log("Video playback error: ", e));
      monitorVideo.loop = true;
      monitorVideo.muted = true;
    }
    currentState.customPreset = 'helmet'; // Default preset to helmet
    customViolationTriggered = false;
    addLog("SYS", "Loaded pre-loaded traffic violation sample: violation_sample.mp4");
  } else {
    videoInputSection.style.display = 'none';
    presetSelector.style.display = 'none';
    mainVideoContainer.style.display = 'block';
    // Clear custom video
    if (monitorVideo) {
      monitorVideo.src = '';
    }
  }
  
  resizeMonitorCanvas();
}

// Interactive Simulation Canvas Drawing Loop
function initCanvasSimulator() {
  monitorCanvas = document.getElementById("monitor-canvas");
  monitorVideo = document.getElementById("monitor-video");
  
  if (!monitorCanvas) return;
  monitorCtx = monitorCanvas.getContext("2d");
  
  window.addEventListener("resize", resizeMonitorCanvas);
  resizeMonitorCanvas();
}

function resizeMonitorCanvas() {
  if (!monitorCanvas) return;
  const rect = monitorCanvas.getBoundingClientRect();
  monitorCanvas.width = rect.width;
  monitorCanvas.height = rect.height;
}

function startSimulation() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  currentState.isPlaying = true;
  simLoop();
}

function stopSimulation() {
  currentState.isPlaying = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
}

function simLoop() {
  if (!currentState.isPlaying) return;
  
  simTime += 1;
  renderSimulatedOverlays();
  
  animFrameId = requestAnimationFrame(simLoop);
}

// Core Simulated Rendering Logic for each active Feed
function renderSimulatedOverlays() {
  if (!monitorCtx) return;
  
  const ctx = monitorCtx;
  const w = monitorCanvas.width;
  const h = monitorCanvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, w, h);
  
  // HUD Elements
  drawHUD(ctx, w, h);
  
  // Active Camera Simulation logic
  if (currentState.activeCamera === 'intersection') {
    drawIntersectionSimulation(ctx, w, h);
  } else if (currentState.activeCamera === 'speedtrap') {
    drawSpeedTrapSimulation(ctx, w, h);
  } else if (currentState.activeCamera === 'signal') {
    drawSignalSimulation(ctx, w, h);
  } else if (currentState.activeCamera === 'custom' || currentState.activeCamera === 'violation_sample') {
    drawCustomVideoSimulation(ctx, w, h);
  }
}

function drawHUD(ctx, w, h) {
  // Border corners
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 2;
  const len = 30;
  
  // Top-Left corner
  ctx.beginPath(); ctx.moveTo(20, 20 + len); ctx.lineTo(20, 20); ctx.lineTo(20 + len, 20); ctx.stroke();
  // Top-Right
  ctx.beginPath(); ctx.moveTo(w - 20, 20 + len); ctx.lineTo(w - 20, 20); ctx.lineTo(w - 20 - len, 20); ctx.stroke();
  // Bottom-Left
  ctx.beginPath(); ctx.moveTo(20, h - 20 - len); ctx.lineTo(20, h - 20); ctx.lineTo(20 + len, h - 20); ctx.stroke();
  // Bottom-Right
  ctx.beginPath(); ctx.moveTo(w - 20, h - 20 - len); ctx.lineTo(w - 20, h - 20); ctx.lineTo(w - 20 - len, h - 20); ctx.stroke();
  
  // Scanning line scrolling
  const lineY = (simTime * 2.5) % (h - 40) + 20;
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, lineY);
  ctx.lineTo(w - 20, lineY);
  ctx.stroke();
}

// 1. Intersection Simulation (Helmet detection demonstration)
let lastHelmetViolationLogged = 0;
function drawIntersectionSimulation(ctx, w, h) {
  // Background Road drawing (since there's no real camera video)
  drawRoadIntersectionBackground(ctx, w, h);
  
  // Cycle Motorcycle Rider
  const cyclePeriod = 360; // frames
  const cycle = simTime % cyclePeriod;
  
  // Bike starts at bottom right, goes top left
  const t = cycle / cyclePeriod;
  const startX = w * 0.9;
  const startY = h * 0.85;
  const endX = w * 0.1;
  const endY = h * 0.4;
  
  const bikeX = startX + (endX - startX) * t;
  const bikeY = startY + (endY - startY) * t;
  const bikeScale = 1.0 - t * 0.5; // perspective scaling
  
  // Draw motorcycle
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(bikeX, bikeY, 15 * bikeScale, 0, Math.PI * 2);
  ctx.fill();
  
  // Bounding box for vehicle
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
  ctx.lineWidth = 2;
  const boxW = 80 * bikeScale;
  const boxH = 110 * bikeScale;
  ctx.strokeRect(bikeX - boxW/2, bikeY - boxH + 15*bikeScale, boxW, boxH);
  
  // Bounding Box Label
  ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
  ctx.fillRect(bikeX - boxW/2, bikeY - boxH - 12*bikeScale, 90 * bikeScale, 18 * bikeScale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${10 * bikeScale}px 'JetBrains Mono'`;
  ctx.fillText("MOTORCYCLE 94%", bikeX - boxW/2 + 4, bikeY - boxH);
  
  // Plate scan indicator
  const plateX = bikeX;
  const plateY = bikeY - 20 * bikeScale;
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1;
  ctx.strokeRect(plateX - 25*bikeScale, plateY - 10*bikeScale, 50*bikeScale, 20*bikeScale);
  
  // Plate label
  ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
  ctx.fillRect(plateX - 25*bikeScale, plateY - 25*bikeScale, 65*bikeScale, 14*bikeScale);
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${8 * bikeScale}px 'JetBrains Mono'`;
  ctx.fillText("MH12QW9087", plateX - 22*bikeScale, plateY - 15*bikeScale);
  
  // Helmet Bounding Box (No Helmet!)
  const headX = bikeX - 5 * bikeScale;
  const headY = bikeY - 80 * bikeScale;
  const headR = 12 * bikeScale;
  
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(headX - headR, headY - headR, headR*2, headR*2);
  
  // Label for violation
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(headX - headR, headY - headR - 15*bikeScale, 100 * bikeScale, 15 * bikeScale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${8 * bikeScale}px 'Space Grotesk'`;
  ctx.fillText("NO HELMET: 98%", headX - headR + 3, headY - headR - 4);
  
  // Active Alert Overlay on screen
  if (t > 0.3 && t < 0.7) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.fillRect(20, 20, w - 40, h - 40);
    
    // Draw red warning frame around helmet
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    
    // Warning text
    ctx.fillStyle = '#ef4444';
    ctx.font = "bold 20px 'Space Grotesk'";
    ctx.fillText("VIOLATION: RIDING WITHOUT HELMET DETECTED", 40, 50);
    ctx.font = "14px 'JetBrains Mono'";
    ctx.fillStyle = '#ffffff';
    ctx.fillText("PLATE: MH12QW9087 | CLASS: TWO-WHEELER | CONF: 98.7%", 40, 75);
    
    // Issue Challan automatically (once per cycle)
    const currentTick = Math.floor(simTime / cyclePeriod);
    if (currentTick !== lastHelmetViolationLogged) {
      lastHelmetViolationLogged = currentTick;
      triggerHelmetViolationChallan();
    }
  }
  
  // Update Steps in Pipeline
  updatePipelineVisuals('intersection', t);
}

function drawRoadIntersectionBackground(ctx, w, h) {
  // Slate background
  ctx.fillStyle = '#11121d';
  ctx.fillRect(0, 0, w, h);
  
  // Diagonal Road lanes
  ctx.fillStyle = '#1b1d2d';
  ctx.beginPath();
  ctx.moveTo(w * 0.4, 0);
  ctx.lineTo(w * 0.6, 0);
  ctx.lineTo(w * 1.0, h * 0.7);
  ctx.lineTo(w * 1.0, h * 1.0);
  ctx.lineTo(w * 0.7, h * 1.0);
  ctx.lineTo(0, h * 0.4);
  ctx.lineTo(0, h * 0.25);
  ctx.closePath();
  ctx.fill();
  
  // Lane markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 4;
  ctx.setLineDash([15, 15]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.55, h * 0.3);
  ctx.lineTo(w * 0.4, h * 0.7);
  ctx.lineTo(w * 0.15, h * 0.33);
  ctx.stroke();
  ctx.setLineDash([]);
}

function triggerHelmetViolationChallan() {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const challanId = "CH-" + Math.floor(1000 + Math.random() * 9000);
  
  const challan = {
    id: challanId,
    timestamp: timestamp,
    camera: "Intersection Cam-04",
    plate: "MH12QW9087",
    type: "No Helmet",
    value: "Rider Helmet Violation (98.7% Conf)",
    fine: 1000,
    status: "Unpaid"
  };
  
  // Avoid duplicate entries
  if (!currentState.challans.find(c => c.plate === 'MH12QW9087' && c.type === 'No Helmet')) {
    currentState.challans.unshift(challan);
    updateDashboardCounters();
    initChallanTable();
    
    // Add logs
    addLog("YOLO", "Motorcycle rider detected without helmet.", "error");
    addLog("OCR", "ANPR Read Plate: MH12QW9087 (Confidence: 99.1%)", "normal");
    addLog("API", "RTO API: Verified MH12QW9087 -> Rajesh Kumar (Bajaj Pulsar 220)", "success");
    addLog("RULE", "Rule Broken: Motor Vehicles Act Sec 129 (No Helmet).", "error");
    addLog("CHALLAN", `E-Challan ${challanId} Issued for ₹1,000 to Rajesh Kumar.`, "error");
    addLog("MQTT", `Published JSON payload to iot/enforcement/challans/${challanId}`, "success");
    
    // UI Notification toast or alert
    showViolationToast(challan);
  }
}

function showViolationToast(challan) {
  const container = document.getElementById("monitor-page");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = "alert-banner";
  toast.style.position = "absolute";
  toast.style.bottom = "80px";
  toast.style.left = "40px";
  toast.style.zIndex = "100";
  toast.style.width = "400px";
  toast.style.boxShadow = "0 8px 30px rgba(239, 68, 68, 0.4)";
  
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
    <div>
      <div style="font-weight: 700;">HELMET VIOLATION DETECTED!</div>
      <div style="font-size:0.75rem; opacity:0.8;">E-Challan ${challan.id} created for ${challan.plate} (Fine: ₹1,000)</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// 2. Highway Speed Trap Simulation
let lastSpeedViolationLogged = 0;
function drawSpeedTrapSimulation(ctx, w, h) {
  // Road
  drawHighwayRoadBackground(ctx, w, h);
  
  // Track multiple vehicles moving down lanes
  const cyclePeriod = 420;
  const cycle = simTime % cyclePeriod;
  
  // Car 1 (Normal Speed): Left Lane
  const t1 = (cycle / cyclePeriod);
  const c1X = w * 0.35 + (w * 0.15 - w * 0.35) * t1;
  const c1Y = h * 0.3 + (h * 0.95 - h * 0.3) * t1;
  const scale1 = 0.2 + t1 * 0.8;
  const speed1 = 74; // normal
  
  // Car 2 (Speeding!): Right Lane (Offset started)
  const t2 = ((cycle + 200) % cyclePeriod) / cyclePeriod;
  const c2X = w * 0.65 + (w * 0.85 - w * 0.65) * t2;
  const c2Y = h * 0.3 + (h * 0.95 - h * 0.3) * t2;
  const scale2 = 0.2 + t2 * 0.8;
  const speed2 = 92; // Speeding!
  
  // Draw ROI Gates (Speed traps lines)
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 3;
  
  // Line A (Entry gate)
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.45);
  ctx.lineTo(w * 0.7, h * 0.45);
  ctx.stroke();
  ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
  ctx.font = "bold 9px 'JetBrains Mono'";
  ctx.fillText("ROI ENTRY GATE (A)", w * 0.3, h * 0.43);
  
  // Line B (Exit gate)
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.75);
  ctx.lineTo(w * 0.82, h * 0.75);
  ctx.stroke();
  ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
  ctx.fillText("ROI EXIT GATE (B)", w * 0.18, h * 0.73);
  
  // Draw Car 1
  drawSimulatedCar(ctx, c1X, c1Y, scale1, speed1, "HR26CL0981", false);
  
  // Draw Car 2 (Speeding!)
  const isSpeeding = speed2 > 80;
  drawSimulatedCar(ctx, c2X, c2Y, scale2, speed2, "KA51MB4321", isSpeeding);
  
  // If speeding car crosses Line B (around t2 = 0.6 to 0.7), log violation
  if (t2 > 0.65 && t2 < 0.8) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.fillRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    
    ctx.fillStyle = '#ef4444';
    ctx.font = "bold 20px 'Space Grotesk'";
    ctx.fillText("VIOLATION: SPEED LIMIT EXCEEDED DETECTED", 40, 50);
    ctx.font = "14px 'JetBrains Mono'";
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`VEHICLE: KA51MB4321 | VELOCITY: ${speed2} km/h (LIMIT: 80 km/h) | STATUS: EXCEEDED`, 40, 75);
    
    const currentTick = Math.floor(simTime / cyclePeriod);
    if (currentTick !== lastSpeedViolationLogged) {
      lastSpeedViolationLogged = currentTick;
      triggerSpeedViolationChallan();
    }
  }
  
  // Update pipeline
  updatePipelineVisuals('speedtrap', t2);
}

function drawHighwayRoadBackground(ctx, w, h) {
  ctx.fillStyle = '#10111a';
  ctx.fillRect(0, 0, w, h);
  
  // Perspective highway
  ctx.fillStyle = '#191b28';
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 0.2);
  ctx.lineTo(w * 0.55, h * 0.2);
  ctx.lineTo(w * 0.95, h * 1.0);
  ctx.lineTo(w * 0.05, h * 1.0);
  ctx.closePath();
  ctx.fill();
  
  // Lanes center divider
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.2);
  ctx.lineTo(w * 0.5, h * 1.0);
  ctx.stroke();
}

function drawSimulatedCar(ctx, x, y, scale, speed, plate, isViolation) {
  const color = isViolation ? '#ef4444' : '#10b981';
  
  // Car body bounding box
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const boxW = 100 * scale;
  const boxH = 75 * scale;
  ctx.strokeRect(x - boxW/2, y - boxH, boxW, boxH);
  
  // Car dot/centroid
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - boxH/2, 4, 0, Math.PI*2);
  ctx.fill();
  
  // Bounding Label with Speed Telemetry
  ctx.fillStyle = color;
  ctx.fillRect(x - boxW/2, y - boxH - 15*scale, boxW, 16*scale);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${8 * scale}px 'JetBrains Mono'`;
  ctx.fillText(`${speed} km/h`, x - boxW/2 + 4, y - boxH - 4);
  
  // Plate scan label
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 30*scale, y - 25*scale, 60*scale, 15*scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${7 * scale}px 'JetBrains Mono'`;
  ctx.fillText(plate, x - 25*scale, y - 14*scale);
}

function triggerSpeedViolationChallan() {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const challanId = "CH-8902"; // Override or new
  
  const challan = {
    id: "CH-" + Math.floor(1000 + Math.random() * 9000),
    timestamp: timestamp,
    camera: "Highway Speed Trap-02",
    plate: "KA51MB4321",
    type: "Speeding",
    value: "92 km/h (Limit: 80 km/h)",
    fine: 2000,
    status: "Unpaid"
  };
  
  if (!currentState.challans.find(c => c.plate === 'KA51MB4321' && c.type === 'Speeding')) {
    currentState.challans.unshift(challan);
    updateDashboardCounters();
    initChallanTable();
    
    addLog("YOLO", "Vehicle KA51MB4321 tracking: ROI Gate A Entry to ROI Gate B Exit.", "normal");
    addLog("SPEED", "Calculating displacement: dy=120px over 14 frames. Velocity: 92.4 km/h.", "error");
    addLog("OCR", "ANPR Read Plate: KA51MB4321 (Confidence: 98.4%)", "normal");
    addLog("API", "RTO API: Verified KA51MB4321 -> Vikram Reddy (Tesla Model 3)", "success");
    addLog("RULE", "Rule Broken: Speed limits section 112 (Speeding). Limit: 80 km/h.", "error");
    addLog("CHALLAN", `E-Challan ${challan.id} Issued for ₹2,000 to Vikram Reddy.`, "error");
    addLog("MQTT", `Published Speeding JSON payload to iot/enforcement/challans/${challan.id}`, "success");
  }
}

// 3. Signal Jump Simulation
let lastSignalViolationLogged = 0;
function drawSignalSimulation(ctx, w, h) {
  // Road
  drawSignalRoadBackground(ctx, w, h);
  
  // Traffic Light controller
  const signalCycle = 400;
  const cycleVal = simTime % signalCycle;
  
  let signalColor = 'green';
  if (cycleVal > 180 && cycleVal <= 240) {
    signalColor = 'yellow';
  } else if (cycleVal > 240) {
    signalColor = 'red';
  }
  
  // Draw Traffic Light post
  ctx.fillStyle = '#222';
  ctx.fillRect(w * 0.8, h * 0.1, 10, h * 0.6);
  ctx.fillRect(w * 0.77, h * 0.1, 70, 160);
  
  // Red Light
  ctx.fillStyle = signalColor === 'red' ? '#ef4444' : '#301010';
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 20, 0, Math.PI*2); ctx.fill();
  if (signalColor === 'red') {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 15, 0, Math.PI*2); ctx.fillStyle = '#ff7070'; ctx.fill();
    ctx.shadowBlur = 0; // reset
  }
  
  // Yellow Light
  ctx.fillStyle = signalColor === 'yellow' ? '#f59e0b' : '#302010';
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.24, 20, 0, Math.PI*2); ctx.fill();
  if (signalColor === 'yellow') {
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.24, 15, 0, Math.PI*2); ctx.fillStyle = '#ffdf80'; ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  // Green Light
  ctx.fillStyle = signalColor === 'green' ? '#10b981' : '#103020';
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.32, 20, 0, Math.PI*2); ctx.fill();
  if (signalColor === 'green') {
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.32, 15, 0, Math.PI*2); ctx.fillStyle = '#a0ffd0'; ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  // Stop Zebra Line
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w * 0.1, h * 0.65, w * 0.7, 12);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.1, h * 0.65, w * 0.7, 12);
  
  // Car cycle
  const t = cycleVal / signalCycle;
  
  // Car starts from top of road, goes down
  // If red light is on (t > 0.6), car jumps signal!
  let carY = h * 0.1 + (h * 0.9 - h * 0.1) * t;
  let carX = w * 0.38 + (w * 0.34 - w * 0.38) * t;
  let carScale = 0.3 + t * 0.7;
  
  // Bounding box
  ctx.strokeStyle = (signalColor === 'red' && carY > h * 0.6) ? '#ef4444' : '#6366f1';
  ctx.lineWidth = 2;
  const boxW = 120 * carScale;
  const boxH = 90 * carScale;
  ctx.strokeRect(carX - boxW/2, carY - boxH, boxW, boxH);
  
  ctx.fillStyle = 'rgba(99,102,241,0.9)';
  if (signalColor === 'red' && carY > h * 0.6) {
    ctx.fillStyle = '#ef4444';
  }
  ctx.fillRect(carX - boxW/2, carY - boxH - 16*carScale, boxW, 16*carScale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${8 * carScale}px 'JetBrains Mono'`;
  ctx.fillText("CAR: KA03MM8892", carX - boxW/2 + 4, carY - boxH - 4);
  
  // Signal violation trigger
  if (signalColor === 'red' && carY > h * 0.62 && carY < h * 0.8) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.fillRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    
    ctx.fillStyle = '#ef4444';
    ctx.font = "bold 20px 'Space Grotesk'";
    ctx.fillText("VIOLATION: SIGNAL JUMPING DETECTED", 40, 50);
    ctx.font = "14px 'JetBrains Mono'";
    ctx.fillStyle = '#ffffff';
    ctx.fillText("VEHICLE: KA03MM8892 | OFFENSE: CROSSING AFTER RED (1.4s delay) | CLASS: TWO-WHEELER", 40, 75);
    
    const currentTick = Math.floor(simTime / signalCycle);
    if (currentTick !== lastSignalViolationLogged) {
      lastSignalViolationLogged = currentTick;
      triggerSignalViolationChallan();
    }
  }
  
  // Update pipeline
  updatePipelineVisuals('signal', t);
}

function drawSignalRoadBackground(ctx, w, h) {
  ctx.fillStyle = '#10111a';
  ctx.fillRect(0, 0, w, h);
  
  // Road lanes vertical
  ctx.fillStyle = '#191b28';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, 0);
  ctx.lineTo(w * 0.65, 0);
  ctx.lineTo(w * 0.8, h);
  ctx.lineTo(w * 0.1, h);
  ctx.closePath();
  ctx.fill();
}

function triggerSignalViolationChallan() {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const challanId = "CH-8901"; // Override
  
  const challan = {
    id: "CH-" + Math.floor(1000 + Math.random() * 9000),
    timestamp: timestamp,
    camera: "Signal Cam-04",
    plate: "KA03MM8892",
    type: "Signal Jumping",
    value: "Red Light Jump (1.4s delay)",
    fine: 5000,
    status: "Unpaid"
  };
  
  if (!currentState.challans.find(c => c.plate === 'KA03MM8892' && c.type === 'Signal Jumping')) {
    currentState.challans.unshift(challan);
    updateDashboardCounters();
    initChallanTable();
    
    addLog("YOLO", "Vehicle KA03MM8892 tracking centroid across intersection intersection zone.", "normal");
    addLog("SIGNAL", "Signal sensor RED: true. Centroid crossing threshold at 1.4s.", "error");
    addLog("OCR", "ANPR Read Plate: KA03MM8892 (Confidence: 97.8%)", "normal");
    addLog("API", "RTO API: Verified KA03MM8892 -> Amit Patel (KTM RC 390)", "success");
    addLog("RULE", "Rule Broken: Traffic Signal Section 119 (Disobeying Signals). Fine: ₹5,000.", "error");
    addLog("CHALLAN", `E-Challan ${challan.id} Issued for ₹5,000 to Amit Patel.`, "error");
    addLog("MQTT", `Published Red Light Jump JSON payload to iot/enforcement/challans/${challan.id}`, "success");
  }
}

// 4. Custom Upload Video Simulation Overlay
let customViolationTriggered = false;
function drawCustomVideoSimulation(ctx, w, h) {
  // If a real video file is loaded, browser draws it underneath on the <video> tag
  // We draw the bounding boxes on the overlay canvas
  
  if (currentState.activeCamera === 'custom' && !currentState.customVideoFile) {
    // If no video is uploaded, draw a nice loading overlay
    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = varColor('text-secondary');
    ctx.font = "14px 'Inter'";
    ctx.textAlign = 'center';
    ctx.fillText("Please upload or drag & drop a video in the workspace.", w/2, h/2 - 10);
    ctx.fillText("The AI Engine will automatically simulate overlay bounding boxes based on the selected preset.", w/2, h/2 + 15);
    ctx.textAlign = 'left'; // reset
    return;
  }
  
  // Custom video is playing. Draw AI tracks!
  const cycleVal = simTime % 300;
  const t = cycleVal / 300;
  
  // Position bounding box in center of screen representing detected target
  const tarX = w * 0.4 + Math.sin(simTime * 0.05) * 30;
  const tarY = h * 0.5 + Math.cos(simTime * 0.03) * 15;
  const boxW = 120;
  const boxH = 160;
  
  const preset = currentState.customPreset;
  
  if (preset === 'helmet') {
    // Draw Motorcycle Bounding box
    ctx.strokeStyle = '#ef4444'; // Red for violation
    ctx.lineWidth = 2;
    ctx.strokeRect(tarX - boxW/2, tarY - boxH/2, boxW, boxH);
    
    // Label Motorcycle
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tarX - boxW/2, tarY - boxH/2 - 20, 140, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 9px 'JetBrains Mono'";
    ctx.fillText("RIDER: NO HELMET (98%)", tarX - boxW/2 + 5, tarY - boxH/2 - 6);
    
    // License Plate
    ctx.strokeStyle = '#06b6d4';
    ctx.strokeRect(tarX - 40, tarY + 40, 80, 22);
    ctx.fillStyle = '#000000';
    ctx.fillRect(tarX - 40, tarY + 22, 65, 14);
    ctx.fillStyle = '#06b6d4';
    ctx.font = "bold 8px 'JetBrains Mono'";
    ctx.fillText("MH12QW9087", tarX - 35, tarY + 32);
    
    // Trigger Challan
    if (t > 0.5 && !customViolationTriggered) {
      customViolationTriggered = true;
      triggerHelmetViolationChallan();
    }
  } else if (preset === 'speed') {
    // Draw Speed tracking bounding box
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(tarX - boxW/2, tarY - boxH/2, boxW, boxH - 40);
    
    // Track Line
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.beginPath();
    ctx.moveTo(tarX - 100, tarY + 40);
    ctx.lineTo(tarX + 100, tarY + 40);
    ctx.stroke();
    
    // Speed display
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(tarX - boxW/2, tarY - boxH/2 - 20, 110, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 9px 'JetBrains Mono'";
    ctx.fillText("SPEED: 94 km/h", tarX - boxW/2 + 5, tarY - boxH/2 - 6);
    
    // Plate
    ctx.strokeStyle = '#06b6d4';
    ctx.strokeRect(tarX - 40, tarY + 10, 80, 22);
    
    if (t > 0.5 && !customViolationTriggered) {
      customViolationTriggered = true;
      triggerSpeedViolationChallan();
    }
  } else if (preset === 'signal') {
    // Signal Jumper Bounding Box
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(tarX - boxW/2, tarY - boxH/2, boxW, boxH);
    
    // Red Light indicator in corner
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(w - 50, 50, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 10px 'Space Grotesk'";
    ctx.fillText("SIGNAL: RED", w - 140, 54);
    
    // Label Jumper
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(tarX - boxW/2, tarY - boxH/2 - 20, 150, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 9px 'JetBrains Mono'";
    ctx.fillText("SIGNAL VIOLATION (96%)", tarX - boxW/2 + 5, tarY - boxH/2 - 6);
    
    if (t > 0.5 && !customViolationTriggered) {
      customViolationTriggered = true;
      triggerSignalViolationChallan();
    }
  }
  
  if (t < 0.1) {
    customViolationTriggered = false; // Reset trigger for next loop cycle
  }
  
  updatePipelineVisuals('custom', t);
}

// Helper to pull colors
function varColor(cssVar) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${cssVar}`).trim();
}

// Update Pipeline Step UI list
function updatePipelineVisuals(camType, progress) {
  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
    document.getElementById("step-4"),
    document.getElementById("step-5")
  ];
  
  if (!steps[0]) return;
  
  // Helper to set state
  const setStepState = (idx, status, text, detail) => {
    const s = steps[idx];
    if (!s) return;
    
    // Reset all status classes
    s.className = "pipeline-step";
    
    const statusEl = s.querySelector(".step-status");
    const detailEl = s.querySelector(".step-details");
    
    if (status === 'running') {
      s.classList.add("active");
      statusEl.className = "step-status status-running";
      statusEl.innerText = "Processing";
    } else if (status === 'done') {
      statusEl.className = "step-status status-done";
      statusEl.innerText = "Done";
    } else if (status === 'violation') {
      statusEl.className = "step-status status-violation";
      statusEl.innerText = "Violation!";
    } else {
      statusEl.className = "step-status status-waiting";
      statusEl.innerText = "Waiting";
    }
    
    if (detail) detailEl.innerText = detail;
  };
  
  // Progression Logic based on vehicle transition cycle (progress is 0 to 1)
  if (progress < 0.15) {
    setStepState(0, 'running', "Object Detection", "YOLOv10 scanning frame...");
    setStepState(1, 'waiting', "ANPR OCR", "Pending localization...");
    setStepState(2, 'waiting', "RTO Database Check", "Pending API query...");
    setStepState(3, 'waiting', "Rule Violation Engine", "Checking constraints...");
    setStepState(4, 'waiting', "Cloud MQTT Output", "Pending transmission...");
  } else if (progress >= 0.15 && progress < 0.35) {
    setStepState(0, 'done', "Object Detection", camType === 'intersection' ? "Motorcycle Detected (94%)" : "Tesla Model 3 Detected (97%)");
    setStepState(1, 'running', "ANPR OCR", "PaddleOCR parsing plate bounds...");
    setStepState(2, 'waiting', "RTO Database Check", "Pending...");
    setStepState(3, 'waiting', "Rule Violation Engine", "Pending...");
    setStepState(4, 'waiting', "Cloud MQTT Output", "Pending...");
  } else if (progress >= 0.35 && progress < 0.55) {
    setStepState(0, 'done', "Object Detection");
    setStepState(1, 'done', "ANPR OCR", camType === 'intersection' ? "Plate: MH12QW9087" : "Plate: KA51MB4321");
    setStepState(2, 'running', "RTO Database Check", "HTTP GET requesting central RTO registry...");
    setStepState(3, 'waiting', "Rule Violation Engine", "Pending...");
    setStepState(4, 'waiting', "Cloud MQTT Output", "Pending...");
  } else if (progress >= 0.55 && progress < 0.8) {
    setStepState(0, 'done', "Object Detection");
    setStepState(1, 'done', "ANPR OCR");
    setStepState(2, 'done', "RTO Database Check", camType === 'intersection' ? "Owner: Rajesh Kumar | Insurance: EXPIRED" : "Owner: Vikram Reddy | RC: ACTIVE");
    setStepState(3, 'running', "Rule Violation Engine", "Running safety & speed validation checks...");
    setStepState(4, 'waiting', "Cloud MQTT Output", "Pending...");
  } else {
    // Violation identified or clear
    const hasViolation = camType === 'intersection' || camType === 'speedtrap' || camType === 'signal' || (camType === 'custom' && customViolationTriggered);
    
    setStepState(0, 'done', "Object Detection");
    setStepState(1, 'done', "ANPR OCR");
    setStepState(2, 'done', "RTO Database Check");
    setStepState(3, hasViolation ? 'violation' : 'done', "Rule Violation Engine", hasViolation ? "VIOLATION TRIGGERED! CHALLAN ISSUED" : "No rules broken. Clear.");
    setStepState(4, 'done', "Cloud MQTT Output", "JSON packet dispatched to AWS IoT Core (Topic: /challans)");
  }
}

// 5. Challans Table Management
function initChallanTable() {
  const tbody = document.getElementById("challans-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = currentState.challans.map(c => {
    let typeClass = 'helmet';
    if (c.type === 'Speeding') typeClass = 'speed';
    if (c.type === 'Signal Jumping') typeClass = 'signal';
    
    return `
      <tr>
        <td style="font-weight: 700; color: var(--primary); font-family: var(--font-mono);">${c.id}</td>
        <td><span class="plate-badge">${c.plate}</span></td>
        <td><span class="violation-badge ${typeClass}">${c.type}</span></td>
        <td style="font-family: var(--font-mono); font-size:0.8rem;">${c.value}</td>
        <td style="font-family: var(--font-mono); font-weight:700; color: var(--danger);">₹${c.fine}</td>
        <td style="color: var(--text-secondary); font-size:0.8rem;">${c.timestamp}</td>
        <td>
          <button class="btn" style="padding: 6px 12px; font-size:0.75rem;" onclick="viewChallanTicket('${c.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-receipt"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M6 12h12.5"/><path d="M6 8h12.5"/><path d="M6 16h12.5"/></svg>
            Receipt
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// View official Challan Ticket Modal
window.viewChallanTicket = function(challanId) {
  const modal = document.getElementById("challan-modal");
  const c = currentState.challans.find(item => item.id === challanId);
  if (!c || !modal) return;
  
  // Look up owner info
  const dbRecord = vehicleDB[c.plate] || { owner: "Unknown Owner", make: "Unknown Make/Model", rcStatus: "Unknown", insurance: "Unknown", fitness: "Unknown", address: "Not Available" };
  
  // Update Modal DOM
  document.getElementById("modal-challan-id").innerText = c.id;
  document.getElementById("modal-timestamp").innerText = c.timestamp;
  document.getElementById("modal-owner").innerText = dbRecord.owner;
  document.getElementById("modal-vehicle").innerText = dbRecord.make;
  document.getElementById("modal-plate").innerText = c.plate;
  document.getElementById("modal-type").innerText = c.type;
  document.getElementById("modal-details").innerText = c.value;
  document.getElementById("modal-camera").innerText = c.camera;
  document.getElementById("modal-fine").innerText = `₹${c.fine.toLocaleString('en-IN')}`;
  
  document.getElementById("modal-rc").innerText = dbRecord.rcStatus;
  document.getElementById("modal-rc").className = "meta-field-value " + (dbRecord.rcStatus === 'Active' ? 'trend-up' : 'trend-down');
  
  document.getElementById("modal-ins").innerText = dbRecord.insurance;
  document.getElementById("modal-ins").className = "meta-field-value " + (dbRecord.insurance.includes('Active') ? 'trend-up' : 'trend-down');
  
  document.getElementById("modal-fit").innerText = dbRecord.fitness;
  document.getElementById("modal-fit").className = "meta-field-value " + (dbRecord.fitness.includes('Valid') ? 'trend-up' : 'trend-down');
  
  document.getElementById("modal-address").innerText = dbRecord.address;
  
  // Draw Evidence Canvas Zoom
  const evCanvas = document.getElementById("evidence-canvas");
  if (evCanvas) {
    const ctx = evCanvas.getContext("2d");
    const cw = evCanvas.width = 300;
    const ch = evCanvas.height = 180;
    
    ctx.fillStyle = '#0c0d15';
    ctx.fillRect(0,0,cw,ch);
    
    // Draw grid
    ctx.strokeStyle = '#1a1d2e';
    ctx.lineWidth = 1;
    for(let i=0; i<cw; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,ch); ctx.stroke(); }
    for(let j=0; j<ch; j+=20) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(cw,j); ctx.stroke(); }
    
    // Draw Plate License Crop
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cw/2 - 60, ch/2 - 20, 120, 40);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(cw/2 - 60, ch/2 - 20, 120, 40);
    
    ctx.fillStyle = '#000000';
    ctx.font = "bold 18px 'JetBrains Mono'";
    ctx.textAlign = 'center';
    ctx.fillText(c.plate, cw/2, ch/2 + 7);
    ctx.textAlign = 'left'; // reset
    
    // Target indicators
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    // Top-Left crop mark
    ctx.beginPath(); ctx.moveTo(cw/2 - 80, ch/2 - 40); ctx.lineTo(cw/2 - 80, ch/2 - 30); ctx.moveTo(cw/2 - 80, ch/2 - 40); ctx.lineTo(cw/2 - 70, ch/2 - 40); ctx.stroke();
    // Bottom-Right crop mark
    ctx.beginPath(); ctx.moveTo(cw/2 + 80, ch/2 + 40); ctx.lineTo(cw/2 + 80, ch/2 + 30); ctx.moveTo(cw/2 + 80, ch/2 + 40); ctx.lineTo(cw/2 + 70, ch/2 + 40); ctx.stroke();
  }
  
  // Show Modal
  modal.classList.add("active");
};

window.closeChallanTicket = function() {
  const modal = document.getElementById("challan-modal");
  if (modal) modal.classList.remove("active");
};

// 6. Speed Calibration Sandbox Physics Sandbox Engine
function initSpeedSandbox() {
  const heightSlider = document.getElementById("param-height");
  const pitchSlider = document.getElementById("param-pitch");
  const roiSlider = document.getElementById("param-roi");
  const fpsSlider = document.getElementById("param-fps");
  const dispSlider = document.getElementById("param-disp");
  
  if (!heightSlider) return;
  
  const sliders = [heightSlider, pitchSlider, roiSlider, fpsSlider, dispSlider];
  sliders.forEach(slider => {
    slider.addEventListener("input", (e) => {
      const field = e.target.id.replace("param-", "");
      currentState.sandbox[field] = parseFloat(e.target.value);
      
      // Update label value display
      document.getElementById(`val-${field}`).innerText = e.target.value;
      
      // Re-calculate speed and redraw sandbox UI
      calculateSandboxSpeed();
      drawSandboxRoad();
    });
  });
  
  calculateSandboxSpeed();
  drawSandboxRoad();
}

function calculateSandboxSpeed() {
  const s = currentState.sandbox;
  
  // Formula details:
  // Speed = Distance / Time
  // Pixel displacement corresponds to ground displacement based on ground calibration scale
  // Height and pitch affect ground length projection scale factor.
  // Pitch angle translates pixels to horizontal offset via: Distance = Height * Tan(Angle)
  // Scale factor (meters per pixel) on ground plane at ROI:
  // Homography scaling ratio roughly modeled as:
  const pitchRadians = s.pitch * Math.PI / 180;
  
  // Theoretical Field of View ROI ground distance length
  const PhysicalROIDist = s.roiDistance; // length of tracking zone (meters)
  const FrameTime = s.displacement / 300; // simulated frame tracking scale
  
  // Simple elegant calibration speed translation:
  // Base scale: 100 pixels displacement in 1080p road represents PhysicalROIDist / 4
  const physicalDisplacement = (s.displacement / 300) * PhysicalROIDist; 
  const deltaTime = 10 / s.fps; // 10 frames tracking window
  
  const speedMetersPerSecond = physicalDisplacement / deltaTime;
  const speedKmh = speedMetersPerSecond * 3.6;
  
  // Round
  const roundedSpeed = Math.round(speedKmh * 10) / 10;
  
  // Update Equation DOM values
  document.getElementById("calc-scale").innerText = (PhysicalROIDist / 300).toFixed(4) + " m/px";
  document.getElementById("calc-dist").innerText = physicalDisplacement.toFixed(2) + " meters";
  document.getElementById("calc-time").innerText = deltaTime.toFixed(3) + " seconds";
  document.getElementById("calc-speed").innerText = roundedSpeed.toFixed(1) + " km/h";
  
  // Draw speed limits alerts
  const speedWarn = document.getElementById("sandbox-warning");
  if (roundedSpeed > 80) {
    speedWarn.style.display = 'block';
    speedWarn.innerText = `WARNING: Velocity exceeds limit of 80 km/h. Issuing E-Challan.`;
  } else {
    speedWarn.style.display = 'none';
  }
}

function drawSandboxRoad() {
  const canvas = document.getElementById("sandbox-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.parentElement.clientWidth;
  const h = canvas.height = canvas.parentElement.clientHeight || 260;
  
  const s = currentState.sandbox;
  
  ctx.fillStyle = '#020204';
  ctx.fillRect(0,0,w,h);
  
  // Draw Pole & Camera (Left side)
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, h);
  ctx.lineTo(40, h - 120); // Height pole
  ctx.stroke();
  
  // Adjust camera height visual scale
  const visualHeight = s.height * 15;
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, h);
  ctx.lineTo(40, h - visualHeight);
  ctx.stroke();
  
  // Draw Camera box
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(25, h - visualHeight - 10, 30, 15);
  
  // Draw Ground Road
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h - 20, w, 20);
  
  // Draw field of view sight lines based on Camera Pitch
  const pitchRad = s.pitch * Math.PI / 180;
  const fovRangeStart = 40 + (visualHeight) * Math.tan(pitchRad - 0.1);
  const fovRangeEnd = 40 + (visualHeight) * Math.tan(pitchRad + 0.3);
  
  // Draw sight lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, h - visualHeight); ctx.lineTo(fovRangeStart, h - 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40, h - visualHeight); ctx.lineTo(fovRangeEnd, h - 20); ctx.stroke();
  
  // Sight cone gradient fill
  ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
  ctx.beginPath();
  ctx.moveTo(40, h - visualHeight);
  ctx.lineTo(fovRangeStart, h - 20);
  ctx.lineTo(fovRangeEnd, h - 20);
  ctx.closePath();
  ctx.fill();
  
  // Draw ROI Tracking gates on ground
  const roiStartX = fovRangeStart + 10;
  const roiWidth = s.roiDistance * 4; // visual multiplier
  
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.fillRect(roiStartX, h - 20, roiWidth, 20);
  
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  // ROI Gate A
  ctx.beginPath(); ctx.moveTo(roiStartX, h - 35); ctx.lineTo(roiStartX, h); ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = "8px 'JetBrains Mono'";
  ctx.fillText("ROI LINE A", roiStartX - 10, h - 38);
  
  // ROI Gate B
  ctx.strokeStyle = '#a855f7';
  ctx.beginPath(); ctx.moveTo(roiStartX + roiWidth, h - 35); ctx.lineTo(roiStartX + roiWidth, h); ctx.stroke();
  ctx.fillStyle = '#a855f7';
  ctx.fillText("ROI LINE B", roiStartX + roiWidth - 10, h - 38);
  
  // Draw vehicle moving through ROI
  const cycleVal = (simTime * 2) % (roiWidth + 100);
  const vehX = roiStartX - 40 + cycleVal;
  
  if (vehX > 0 && vehX < w) {
    ctx.fillStyle = '#10b981';
    ctx.fillRect(vehX, h - 30, 25, 12);
    // wheels
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(vehX + 5, h - 18, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(vehX + 20, h - 18, 3, 0, Math.PI*2); ctx.fill();
    
    // Displacement arrow vector if inside ROI
    if (vehX >= roiStartX && vehX <= roiStartX + roiWidth) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(roiStartX, h - 8);
      ctx.lineTo(vehX, h - 8);
      ctx.stroke();
      
      ctx.fillStyle = '#06b6d4';
      ctx.font = "bold 9px 'JetBrains Mono'";
      ctx.fillText(`dy: ${Math.round((vehX - roiStartX)/2)}px`, roiStartX + 5, h - 12);
    }
  }
  
  // Formula Text details
  ctx.fillStyle = '#ffffff';
  ctx.font = "9px 'JetBrains Mono'";
  ctx.fillText(`Cam Height: ${s.height}m`, 45, h - visualHeight/2);
  ctx.fillText(`Pitch Angle: ${s.pitch}°`, fovRangeStart + 5, h - 50);
}

// 7. Custom Video Upload Wizard Setup
function initUploadWizard() {
  const wizard = document.getElementById("upload-wizard");
  const fileInput = document.getElementById("hidden-video-input");
  
  if (!wizard || !fileInput) return;
  
  wizard.addEventListener("click", () => {
    fileInput.click();
  });
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      handleCustomUploadedVideo(file);
    }
  });
  
  // Presets Selector listeners
  const presetButtons = document.querySelectorAll(".preset-option-btn");
  presetButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      presetButtons.forEach(b => b.classList.remove("selected"));
      
      const targetBtn = e.currentTarget;
      targetBtn.classList.add("selected");
      
      const presetType = targetBtn.getAttribute("data-preset");
      currentState.customPreset = presetType;
      
      // Reset trigger violation
      customViolationTriggered = false;
      addLog("SIM", `Custom AI Model Preset toggled to: [${presetType.toUpperCase()}]`);
    });
  });
}

function handleCustomUploadedVideo(file) {
  currentState.customVideoFile = file;
  
  // Load file into video tag URL source
  const fileURL = URL.createObjectURL(file);
  monitorVideo.src = fileURL;
  monitorVideo.play();
  monitorVideo.loop = true;
  monitorVideo.muted = true;
  
  // Show main video container
  const mainVideoContainer = document.getElementById("monitor-video-container");
  mainVideoContainer.style.display = 'block';
  
  // Update state logs
  addLog("SYS", `Custom User Video loaded: ${file.name} (${(file.size / (1024*1024)).toFixed(1)} MB)`);
  addLog("YOLO", "Injected file stream into GPU analyzer frames. Running detections.");
  
  // Adjust sizing
  resizeMonitorCanvas();
}
