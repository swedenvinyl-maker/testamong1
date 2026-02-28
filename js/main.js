// main.js — Entry point, game loop, initialization
// v3.0 - 2026-02-14

let canvas, renderer, gameState;
let lastTime = 0;

function init(mode = 'spectate', role = null, extraRoles = false, extendedColors = false, forcedExtra = null) {
    canvas = document.getElementById('gameCanvas');

    // Set up renderer
    renderer = new Renderer(canvas);
    renderer.resize();

    // Set up game state
    gameState = new GameState();
    gameState.init(mode, role, extraRoles, extendedColors, forcedExtra);

    // Input handlers
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        if (gameState.ghost) gameState.ghost.handleKeyDown(e);
    });
    window.addEventListener('keyup', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        if (gameState.ghost) gameState.ghost.handleKeyUp(e);
    });

    // Handle click for restart
    canvas.addEventListener('click', (e) => {
        if (gameState.phase === 'gameover') {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            // Calculate button Y matching renderer's drawGameOver (roles list + offset)
            const baseY = canvas.height / 2 + 50; // "Roles:" y
            const rolesHeight = 25 + gameState.bots.length * 22;
            const btnY = baseY + rolesHeight + 20;
            const btnX = canvas.width / 2 - 80;
            if (mx >= btnX && mx <= btnX + 160 && my >= btnY && my <= btnY + 40) {
                gameState.restart();
            }
        }
    });

    // Handle resize
    window.addEventListener('resize', () => {
        renderer.resize();
    });

    // Start game loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // Cap delta time to avoid spiral of death
    const cappedDt = Math.min(dt, 50);

    // Update
    gameState.update(cappedDt);

    // Camera follows ghost
    if (gameState.ghost) {
        renderer.updateCamera(gameState.ghost);
    }

    // Render
    renderer.render(gameState, timestamp);

    requestAnimationFrame(gameLoop);
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    setupStartScreen();
});

function setupStartScreen() {
    const startScreen = document.getElementById('start-screen');
    const btnPlay = document.getElementById('btn-play');
    const btnStart = document.getElementById('btn-start');
    const btnAI = document.getElementById('btn-ai');
    const btnAIPuter = document.getElementById('btn-ai-puter');
    const btnAIGroq = document.getElementById('btn-ai-groq');
    const aiStatus = document.getElementById('ai-status-text');

    const aiButtons = [btnAI, btnAIPuter, btnAIGroq];

    function updateAIUI() {
        if (isAIConnected()) {
            const name = getProviderName();
            aiStatus.textContent = `AI Status: Connected (${name})`;
            aiStatus.classList.add('connected');
            btnAI.textContent = "DISCONNECT AI";
            btnAIPuter.textContent = "DISCONNECT AI";
            btnAIGroq.textContent = "DISCONNECT AI";
            // Highlight active, dim others
            btnAI.classList.toggle('active-provider', window.AI_PROVIDER === 'openrouter');
            btnAIPuter.classList.toggle('active-provider', window.AI_PROVIDER === 'puter');
            btnAIGroq.classList.toggle('active-provider', window.AI_PROVIDER === 'groq');
        } else {
            aiStatus.textContent = "AI Status: Offline (Using Standard Behavior)";
            aiStatus.classList.remove('connected');
            btnAI.textContent = "CONNECT TO OPENROUTER";
            btnAIPuter.textContent = "CONNECT TO PUTER";
            btnAIGroq.textContent = "CONNECT TO GROQ";
            aiButtons.forEach(b => b.classList.remove('active-provider'));
        }
    }

    // Check if already connected on load
    updateAIUI();

    // --- OpenRouter ---
    btnAI.addEventListener('click', async () => {
        if (isAIConnected()) { disconnectAI(); updateAIUI(); return; }

        const key = await showAPIKeyModal('openrouter');
        if (!key) return;

        btnAI.textContent = "Verifying...";
        window.GEMINI_API_KEY = key;
        window.AI_PROVIDER = 'openrouter';
        try {
            const testResult = await geminiChat("Say 'connected' in one word.", "Respond with exactly one word.");
            if (testResult) {
                updateAIUI();
            } else {
                throw new Error("Empty response");
            }
        } catch (err) {
            console.error("OpenRouter verification failed:", err);
            disconnectAI();
            updateAIUI();
            aiStatus.textContent = "Connection Failed — Check API Key";
        }
    });

    // --- Puter (no API key) ---
    btnAIPuter.addEventListener('click', async () => {
        if (isAIConnected()) { disconnectAI(); updateAIUI(); return; }

        btnAIPuter.textContent = "Connecting...";
        window.AI_PROVIDER = 'puter';
        try {
            const testResult = await _chatPuter("Say 'connected' in one word.", "Respond with exactly one word.");
            if (testResult) {
                updateAIUI();
            } else {
                throw new Error("Empty response from Puter");
            }
        } catch (err) {
            console.error("Puter connection failed:", err);
            disconnectAI();
            updateAIUI();
            aiStatus.textContent = "Puter Connection Failed";
        }
    });

    // --- Groq ---
    btnAIGroq.addEventListener('click', async () => {
        if (isAIConnected()) { disconnectAI(); updateAIUI(); return; }

        const key = await showAPIKeyModal('groq');
        if (!key) return;

        btnAIGroq.textContent = "Verifying...";
        window.GROQ_API_KEY = key;
        window.AI_PROVIDER = 'groq';
        try {
            const testResult = await geminiChat("Say 'connected' in one word.", "Respond with exactly one word.");
            if (testResult) {
                updateAIUI();
            } else {
                throw new Error("Empty response");
            }
        } catch (err) {
            console.error("Groq verification failed:", err);
            disconnectAI();
            updateAIUI();
            aiStatus.textContent = "Connection Failed — Check API Key";
        }
    });

    const playOptions = document.getElementById('play-mode-options');
    const btnSelectCrew = document.getElementById('btn-select-crew');
    const btnSelectImp = document.getElementById('btn-select-imp');

    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            playOptions.classList.toggle('hidden');
        });
    }

    if (btnSelectCrew) {
        btnSelectCrew.addEventListener('click', () => {
            const extraRoles = document.getElementById('extra-roles-toggle').checked;
            const extendedColors = document.getElementById('extended-colors-toggle').checked;
            const forcedExtra = getForcedExtraRole();
            startScreen.classList.add('hidden');
            init('play', 'crewmate', extraRoles, extendedColors, forcedExtra);
        });
    }

    if (btnSelectImp) {
        btnSelectImp.addEventListener('click', () => {
            const extraRoles = document.getElementById('extra-roles-toggle').checked;
            const extendedColors = document.getElementById('extended-colors-toggle').checked;
            const forcedExtra = getForcedExtraRole();
            startScreen.classList.add('hidden');
            init('play', 'impostor', extraRoles, extendedColors, forcedExtra);
        });
    }

    btnStart.addEventListener('click', () => {
        const extraRoles = document.getElementById('extra-roles-toggle').checked;
        const extendedColors = document.getElementById('extended-colors-toggle').checked;
        const forcedExtra = getForcedExtraRole();
        startScreen.classList.add('hidden');
        init('spectate', null, extraRoles, extendedColors, forcedExtra);
    });

    const btnSettings = document.getElementById('btn-settings');
    const roleSettingsMenu = document.getElementById('role-settings-menu');
    const btnPersonality = document.getElementById('btn-personality');
    const aiPersonalityMenu = document.getElementById('ai-personality-menu');
    const personalityDesc = document.getElementById('personality-desc');
    const personalityRadios = document.querySelectorAll('input[name="ai-personality"]');

    window.AI_PERSONALITY = 'average';

    if (btnSettings && roleSettingsMenu) {
        btnSettings.addEventListener('click', () => {
            roleSettingsMenu.classList.toggle('hidden');
            if (!roleSettingsMenu.classList.contains('hidden')) {
                aiPersonalityMenu.classList.add('hidden');
            }
        });
    }

    if (btnPersonality && aiPersonalityMenu) {
        btnPersonality.addEventListener('click', () => {
            aiPersonalityMenu.classList.toggle('hidden');
            if (!aiPersonalityMenu.classList.contains('hidden')) {
                roleSettingsMenu.classList.add('hidden');
            }
        });
    }

    const descriptions = {
        'average': 'Average player intelligence.',
        'interesting': 'Colorful language and dramatic behavior.',
        'pro': 'Smartest, tactical, and efficient.'
    };

    personalityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                window.AI_PERSONALITY = radio.value;
                personalityDesc.textContent = descriptions[radio.value];
            }
        });
    });

    const forceScientist = document.getElementById('force-scientist');
    const forceDetective = document.getElementById('force-detective');
    const forceNoisemaker = document.getElementById('force-noisemaker');
    const forceTracker = document.getElementById('force-tracker');

    if (forceScientist && forceDetective && forceNoisemaker && forceTracker) {
        const toggles = [forceScientist, forceDetective, forceNoisemaker, forceTracker];
        toggles.forEach(t => {
            t.addEventListener('change', () => {
                if (t.checked) {
                    toggles.forEach(other => { if (other !== t) other.checked = false; });
                }
            });
        });
    }
}

function getForcedExtraRole() {
    if (document.getElementById('force-scientist')?.checked) return 'scientist';
    if (document.getElementById('force-detective')?.checked) return 'detective';
    if (document.getElementById('force-noisemaker')?.checked) return 'noisemaker';
    if (document.getElementById('force-tracker')?.checked) return 'tracker';
    return null;
}
