// --- DYNAMIC USER AUTH TRACKING STATE SYSTEM ---
let USER_ID = localStorage.getItem("grabit_tracked_user") || "guest_user";
let USER_EMAIL = localStorage.getItem("grabit_user_email") || "Not Logged In";

const BACKEND_NGROK_DOMAIN = "cringing-niece-playpen.ngrok-free.dev";
const httpApiBase = `https://${BACKEND_NGROK_DOMAIN}`;
const wsUrl = `wss://${BACKEND_NGROK_DOMAIN}/api/live-fix/${USER_ID}`;

// DOM Interface Elements Map
const videoEl = document.getElementById('camera-feed');
const canvasEl = document.getElementById('hidden-canvas');
const ctx = canvasEl.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const flipBtn = document.getElementById('flip-btn');
const startScreen = document.getElementById('start-screen');
const callBar = document.getElementById('call-bar');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const tokenDisplay = document.getElementById('token-display');
const errorMsg = document.getElementById('error-message');
const skillSelectEl = document.getElementById('skill-select');

// Target Error Banner UI Context Node
const tokenErrorBanner = document.getElementById('token-error-banner');
const tokenWarning = document.getElementById('token-warning');

// New Auth DOM Hooks
const authProfileBtn = document.getElementById('auth-profile-btn');
const authDropdown = document.getElementById('auth-dropdown');
const displayUser = document.getElementById('display-user');
const loginUsernameInput = document.getElementById('login-username');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const logoutBtn = document.getElementById('logout-btn');
const loggedOutView = document.getElementById('auth-logged-out-view');
const loggedInView = document.getElementById('auth-logged-in-view');

// New Safety Disclaimer DOM Hooks
const disclaimerOverlay = document.getElementById('disclaimer-overlay');
const disclaimerCheckbox = document.getElementById('disclaimer-checkbox');
const disclaimerAccept = document.getElementById('disclaimer-accept');
const disclaimerCancel = document.getElementById('disclaimer-cancel');

// Core Execution State
let currentFacingMode = 'environment';
let ws = null;
let mediaStream = null;
let sendInterval = null;
let currentSessionTranscript = []; // Active conversation session logging history store
let isSessionStopping = false;

// Audio Pipelines
let playbackAudioContext = null;
let recordAudioContext = null;
let gainNode = null;
let nextAudioStartTime = 0;
let audioInputProcessor = null;
let audioInputSource = null;

// ── AUTH MANAGER ACTIONS ───────────────────
function syncAuthUI() {
    displayUser.innerText = USER_ID === "guest_user" ? "Guest" : USER_EMAIL;
    if (USER_ID === "guest_user") {
        loggedOutView.style.display = "block";
        loggedInView.style.display = "none";
    } else {
        loggedOutView.style.display = "none";
        loggedInView.style.display = "block";
    }
    fetchBalance();
}

authProfileBtn.addEventListener('click', () => {
    authDropdown.style.display = authDropdown.style.display === 'none' ? 'block' : 'none';
});

logoutBtn.addEventListener('click', () => {
    USER_ID = "guest_user";
    localStorage.removeItem("grabit_tracked_user");
    authDropdown.style.display = 'none';
    syncAuthUI();
    window.location.reload()
});

// ── SAFETY INTERCEPT ENGINE ───────────────
startBtn.addEventListener('click', () => {
    // Intercept action loop to display legal terms and force physical checkbox interaction
    disclaimerCheckbox.checked = false;
    disclaimerAccept.disabled = true;
    disclaimerOverlay.style.display = 'flex';
});

disclaimerCheckbox.addEventListener('change', (e) => {
    disclaimerAccept.disabled = !e.target.checked;
});

disclaimerCancel.addEventListener('click', () => {
    disclaimerOverlay.style.display = 'none';
});

disclaimerAccept.addEventListener('click', () => {
    disclaimerOverlay.style.display = 'none';
    startSession(); // Trigger safe pipeline init upon active acceptance signature
});


window.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('grabit_tracked_user') || localStorage.getItem('user_id');
    const appContainer = document.getElementById('app-container');
    const greetingHeader = document.getElementById('dynamic-greeting');
    const nameModal = document.getElementById('name-modal');
    const nameInput = document.getElementById('modal-name-input');
    const nameSubmit = document.getElementById('modal-name-submit');
    const displayUserSpan = document.getElementById('display-user');

    if (!userId || userId === 'guest_user') {
        return;
    }

    if (appContainer) {
        appContainer.style.display = 'block';
    }

    async function persistNickname(nickname) {
        try {
            const response = await fetch(`${httpApiBase}/api/users/update-profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, nickname })
            });

            if (!response.ok) {
                const text = await response.text();
                console.warn('Profile sync failed:', text);
            }
        } catch (err) {
            console.warn('Profile sync failed:', err);
        }
    }

    async function fetchStoredNickname() {
        try {
            const response = await fetch(`${httpApiBase}/api/users/profile/${encodeURIComponent(userId)}`);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.nickname || null;
        } catch (err) {
            console.warn('Could not fetch profile nickname:', err);
            return null;
        }
    }

    function updateGreeting(name, isReturningUser) {
        if (greetingHeader) {
            greetingHeader.innerText = isReturningUser
                ? `${name} is back!`
                : `Welcome, ${name}, what are we building today!`;
        }
        if (displayUserSpan) {
            displayUserSpan.innerText = name;
        }
    }

    const dbName = await fetchStoredNickname();
    if (dbName) {
        localStorage.setItem('grabit_user_nickname', dbName);
        updateGreeting(dbName, true);
        return;
    }

    const cachedName = localStorage.getItem('grabit_user_nickname')?.trim();
    if (cachedName) {
        updateGreeting(cachedName, true);
        return;
    }

    if (nameModal) {
        nameModal.style.display = 'flex';
        window.setTimeout(() => {
            nameInput?.focus();
            nameInput?.select();
        }, 50);
    }

    if (nameInput && !nameInput.dataset.bound) {
        nameInput.dataset.bound = 'true';
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                nameSubmit?.click();
            }
        });
    }

    if (nameSubmit && !nameSubmit.dataset.bound) {
        nameSubmit.dataset.bound = 'true';
        nameSubmit.addEventListener('click', async () => {
            const enteredName = nameInput?.value.trim() || '';
            if (!enteredName) {
                alert('Please specify an identity name.');
                return;
            }

            localStorage.setItem('grabit_user_nickname', enteredName);
            if (nameModal) {
                nameModal.style.display = 'none';
            }
            updateGreeting(enteredName, false);
            await persistNickname(enteredName);
        });
    }
});

// ── CORE AUDIO SYSTEMS ─────────────────────
async function initAudioSystems() {
    if (!playbackAudioContext) {
        playbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = playbackAudioContext.createGain();
        gainNode.gain.setValueAtTime(1.0, playbackAudioContext.currentTime);
        gainNode.connect(playbackAudioContext.destination);
        nextAudioStartTime = playbackAudioContext.currentTime;
    }
    if (playbackAudioContext.state === 'suspended') await playbackAudioContext.resume();

    if (!recordAudioContext) {
        recordAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (recordAudioContext.state === 'suspended') await recordAudioContext.resume();
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function playPCM16(buffer) {
    if (!playbackAudioContext || !gainNode) return;
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }
    const audioBuffer = playbackAudioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = playbackAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    const currentTime = playbackAudioContext.currentTime;
    if (nextAudioStartTime < currentTime) nextAudioStartTime = currentTime;
    source.start(nextAudioStartTime);
    nextAudioStartTime += audioBuffer.duration;
}

async function fetchBalance() {
    try {
        const res = await fetch(`${httpApiBase}/api/balance/${USER_ID}`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (res.ok) {
            const data = await res.json();
            tokenDisplay.innerText = data.balance.toLocaleString();
            if (data.balance < 1000) {
                tokenWarning.innerText = "Low token balance. Consider purchasing more tokens to avoid interruptions.";
                tokenWarning.style.display = 'block';
            } else {
                tokenWarning.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Could not fetch balance", e);
    }
}

function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('payment') === 'success') {
        alert("🎉 Payment successful! Your tokens have been credited.");
        if (typeof fetchBalance === "function") {
            fetchBalance();
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Initialize status check
checkPaymentStatus();

// ── WEBSOCKET PIPELINE WITH TRANSCRIPT TRACKING ──
async function startSession() {
    errorMsg.style.display = 'none';
    isSessionStopping = false;
    if (tokenErrorBanner) tokenErrorBanner.style.display = 'none'; // Clear any residual error visual layouts
    currentSessionTranscript = []; // Reset transcript data log for new telemetry entry
    await initAudioSystems();

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: currentFacingMode },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        videoEl.srcObject = mediaStream;
        canvasEl.width = 640;
        canvasEl.height = 480;
        const selectedSkill = skillSelectEl ? skillSelectEl.value : 'general';

        // Modify your WebSocket instantiation line to carry the chosen track:
        ws = new WebSocket(`${wsUrl}?user_id=${encodeURIComponent(USER_ID)}&skill=${encodeURIComponent(selectedSkill)}`);


        ws.onopen = () => {
            statusIndicator.className = 'status-indicator connected';
            statusText.innerText = 'Connected';
            startScreen.style.display = 'none';
            callBar.style.display = 'flex';

            sendInterval = setInterval(captureAndSendFrame, 500);
            startAudioCapture();
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.error) {
                errorMsg.innerText = msg.error;
                errorMsg.style.display = 'block';
                setTimeout(() => { errorMsg.style.display = 'none'; }, 5000);
                
                if (msg.error.includes("Refill") || msg.error.includes("tokens") || msg.error.includes("Insufficient")) {
                    void stopSession(4002);
                } else {
                    void stopSession();
                }
            } else if (msg.type === "terminated" && msg.reason) {
                const terminatedMessage = msg.reason.includes("token") || msg.reason.includes("balance")
                    ? "Insufficient tokens. Please purchase a top-up package to continue."
                    : msg.reason;
                errorMsg.innerText = terminatedMessage;
                errorMsg.style.display = 'block';
                void stopSession(4002);
            } else if (msg.type === "audio") {
                const arrayBuffer = base64ToArrayBuffer(msg.data);
                playPCM16(arrayBuffer);
            }

            if (msg.type === "text" || msg.transcript) {
                const speechContent = msg.text || msg.transcript;
                const speakerId = msg.speaker || "AI_Agent";
                currentSessionTranscript.push({
                    timestamp: new Date().toISOString(),
                    speaker: speakerId,
                    text: speechContent
                });
            }

            if (Math.random() < 0.2) fetchBalance();
        };

        ws.onclose = (event) => { 
            console.log("[WS CLOSE EVENT DETECTED] Code:", event.code);
            if (!isSessionStopping) {
                void stopSession(event.code);
            }
        };

    } catch (err) {
        console.error("Error starting session", err);
        errorMsg.innerText = "Camera/Mic access denied or WebSocket connection failed.";
        errorMsg.style.display = 'block';
    }
}

function startAudioCapture() {
    audioInputSource = recordAudioContext.createMediaStreamSource(mediaStream);
    audioInputProcessor = recordAudioContext.createScriptProcessor(512, 1, 1);
    const targetSampleRate = 16000;
    const srcSampleRate = recordAudioContext.sampleRate;

    audioInputProcessor.onaudioprocess = (e) => {
        // HARD ENFORCEMENT: Stop collecting microphone blocks immediately if socket drops
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        const resampleRatio = srcSampleRate / targetSampleRate;
        const targetLength = Math.round(inputData.length / resampleRatio);
        const int16Buffer = new Int16Array(targetLength);

        for (let i = 0; i < targetLength; i++) {
            const srcIndex = Math.round(i * resampleRatio);
            if (srcIndex < inputData.length) {
                let sample = inputData[srcIndex];
                sample = Math.max(-1, Math.min(1, sample));
                int16Buffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            }
        }

        const binaryString = String.fromCharCode.apply(null, new Uint8Array(int16Buffer.buffer));
        const base64Audio = window.btoa(binaryString);

        try {
            ws.send(JSON.stringify({ type: "audio", data: base64Audio }));
        } catch (err) {
            console.warn("[Stream] Blocked audio frame write on closing socket.");
        }
    };

    audioInputSource.connect(audioInputProcessor);
    audioInputProcessor.connect(recordAudioContext.destination);
}

function captureAndSendFrame() {
    // Hard gate: If socket is missing, closing, or closed, clear the interval loop instantly
    if (!ws || ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        console.log("[Stream] Socket dead or closing. Short-circuiting frame capture interval loop.");
        if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
        }
        return;
    }

    // Additional check: Ensure it's explicitly OPEN before attempting a send
    if (ws.readyState !== WebSocket.OPEN) return;

    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.6);
    const b64Data = dataUrl.split(',')[1];

    try {
        ws.send(JSON.stringify({ type: "video", data: b64Data }));
    } catch (err) {
        console.warn("[Stream] Blocked video frame write on closing socket.");
        // Double-safety backup clearing
        if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
        }
    }
}

async function stopSession(closeCode) {
    if (isSessionStopping) {
        console.log("[TEARDOWN] Stop already in progress; skipping duplicate teardown.");
        return;
    }
    isSessionStopping = true;

    console.log("[TEARDOWN] Initializing hard stop sequence. Code:", closeCode);

    // 1. Kill the frame transmission loop immediately
    if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
    }

    // 2. Shut down microphone tracking processor callbacks dead in their tracks
    if (audioInputProcessor) {
        audioInputProcessor.onaudioprocess = null; // Instantly stops audio thread evaluation
        audioInputProcessor.disconnect();
        audioInputProcessor = null;
    }
    if (audioInputSource) {
        audioInputSource.disconnect();
        audioInputSource = null;
    }

    // 3. Kill webcam/microphone hardware states instantly
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
            track.stop();
            console.log(`[Hardware] Track ${track.kind} killed successfully.`);
        });
        mediaStream = null;
    }
    if (videoEl) {
        videoEl.srcObject = null;
    }

    // 4. Force disconnect and drop the WebSocket pipeline wrapper
    if (ws) {
        // Prevent recursive loop execution checks
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }

    // 5. Instantly bounce UI Panels back to safety viewports
    statusIndicator.className = 'status-indicator error';
    statusText.innerText = 'Disconnected';
    startScreen.style.display = 'flex';
    callBar.style.display = 'none';

    // 6. Evaluate wallet exhaustion warning states
    if (closeCode === 4002) {
        if (tokenErrorBanner) {
            tokenErrorBanner.innerText = "Insufficient tokens. Please purchase more tokens to continue.";
            tokenErrorBanner.style.display = 'block';
        }
    } else {
        if (tokenErrorBanner) tokenErrorBanner.style.display = 'none';
    }

    // Refresh balance widget
    fetchBalance();

    // 7. Fire and Forget Telemetry Archive payload down to backend (Does not block UI)
    if (currentSessionTranscript.length > 0) {
        const transcriptCopy = [...currentSessionTranscript];
        currentSessionTranscript = []; // Wipe immediately to avoid duplication states
        
        try {
            await shipTranscriptToBackend(transcriptCopy);
        } catch (err) {
            console.error("Delayed transcript archive step failed:", err);
        }
    }
}

// REST Client Dispatch Loop to archive conversation transcripts for regulatory compliance
async function shipTranscriptToBackend(transcriptLog) {
    try {
        await fetch(`${httpApiBase}/api/transcripts/archive`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            body: JSON.stringify({
                user_id: USER_ID,
                session_id: `sess_${Date.now()}`,
                logged_at: new Date().toISOString(),
                data: transcriptLog
            })
        });
        console.log("Session logs archived successfully.");
    } catch (err) {
        console.error("Failed executing transaction upload log protocol:", err);
    }
}

async function flipCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    if (audioInputProcessor && audioInputSource) {
        audioInputProcessor.disconnect();
        audioInputSource.disconnect();
        audioInputProcessor = null;
        audioInputSource = null;
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: currentFacingMode },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    videoEl.srcObject = mediaStream;
    startAudioCapture();
}

// Hook up event handlers explicitly ensuring no code param passes for a clean user hang-up
stopBtn.addEventListener('click', () => stopSession());
flipBtn.addEventListener('click', flipCamera);

// Run initial system state loop execution
syncAuthUI();