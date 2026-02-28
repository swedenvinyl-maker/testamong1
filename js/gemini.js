// gemini.js — Multi-provider AI wrapper (OpenRouter, Puter, Groq)

// Current provider: 'openrouter', 'puter', 'groq', or null
window.AI_PROVIDER = null;
window.GEMINI_API_KEY = null;   // OpenRouter key
window.GROQ_API_KEY = null;     // Groq key

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const PUTER_MODEL = 'gpt-4o-mini';

function isAIConnected() {
    return !!window.AI_PROVIDER;
}

function getProviderName() {
    switch (window.AI_PROVIDER) {
        case 'openrouter': return 'OpenRouter';
        case 'puter': return 'Puter';
        case 'groq': return 'Groq';
        default: return 'Offline';
    }
}

function disconnectAI() {
    window.AI_PROVIDER = null;
    window.GEMINI_API_KEY = null;
    window.GROQ_API_KEY = null;
}

/**
 * Get personality-specific instructions.
 */
function getPersonalityPrompt() {
    const personality = window.AI_PERSONALITY || 'average';
    switch (personality) {
        case 'pro':
            return "\nPERSONALITY: You are a professional, high-level Among Us player. You are extremely tactical, analyze movement patterns, remember where people were, and use advanced deduction. You are objective and efficient.";
        case 'interesting':
            return "\nPERSONALITY: You are a very interesting and slightly chaotic Among Us player. Use colorful language, be dramatic, and sometimes bring up weird theories or personal 'lore' about other crewmates. Make the game feel like a soap opera.";
        case 'average':
        default:
            return "\nPERSONALITY: You are an average Among Us player. Your logic is sound but basic. You don't overthink things.";
    }
}

// ─── Provider-specific chat calls ────────────────────────────────

async function _chatOpenRouter(messages, maxTokens, temperature, topP) {
    const body = {
        model: OPENROUTER_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP
    };
    const response = await fetch(OPENROUTER_API_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.GEMINI_API_KEY}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Among Us Ghost Observer'
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.text();
        let errorMessage = err;
        try { const parsed = JSON.parse(err); errorMessage = parsed?.error?.message || err; } catch (e) { }
        console.error(`[OpenRouter] API error ${response.status}:`, errorMessage);
        return null;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
}

async function _chatGroq(messages, maxTokens, temperature, topP) {
    const body = {
        model: GROQ_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP
    };
    const response = await fetch(GROQ_API_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.text();
        let errorMessage = err;
        try { const parsed = JSON.parse(err); errorMessage = parsed?.error?.message || err; } catch (e) { }
        console.error(`[Groq] API error ${response.status}:`, errorMessage);
        return null;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
}

async function _chatPuter(prompt, systemPrompt) {
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await puter.ai.chat(messages, { model: PUTER_MODEL });
        // puter.ai.chat returns { message: { content: "..." } } or a string
        if (typeof response === 'string') return response.trim();
        const text = response?.message?.content || response?.toString();
        return text ? text.trim() : null;
    } catch (err) {
        console.error('[Puter] AI chat error:', err);
        return null;
    }
}

// ─── Unified chat functions ──────────────────────────────────────

/**
 * Send a chat message to the active AI provider and get a text response.
 * @param {string} prompt - The user/game prompt
 * @param {string} systemPrompt - Optional system instruction
 * @returns {Promise<string|null>} The response text, or null on failure
 */
async function geminiChat(prompt, systemPrompt) {
    if (!isAIConnected()) return null;

    const fullSystemPrompt = (systemPrompt || "") + getPersonalityPrompt();

    // Puter uses its own API shape
    if (window.AI_PROVIDER === 'puter') {
        return _chatPuter(prompt, fullSystemPrompt);
    }

    // OpenRouter & Groq use OpenAI-compatible messages
    const messages = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: prompt }
    ];

    try {
        if (window.AI_PROVIDER === 'groq') {
            return await _chatGroq(messages, 60, 1.0, 0.95);
        }
        return await _chatOpenRouter(messages, 60, 1.0, 0.95);
    } catch (err) {
        console.error(`[${getProviderName()}] Fetch error:`, err);
        return null;
    }
}

/**
 * Send a chat message requesting a short/structured answer.
 * @param {string} prompt - The prompt
 * @param {string} systemPrompt - Optional system instruction
 * @returns {Promise<string|null>} The response text, or null on failure
 */
async function geminiChatStructured(prompt, systemPrompt) {
    if (!isAIConnected()) return null;

    const fullSystemPrompt = (systemPrompt || "") + getPersonalityPrompt();

    if (window.AI_PROVIDER === 'puter') {
        return _chatPuter(prompt, fullSystemPrompt);
    }

    const messages = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: prompt }
    ];

    try {
        if (window.AI_PROVIDER === 'groq') {
            return await _chatGroq(messages, 30, 0.4, 0.9);
        }
        return await _chatOpenRouter(messages, 30, 0.4, 0.9);
    } catch (err) {
        console.error(`[${getProviderName()}] Structured fetch error:`, err);
        return null;
    }
}

/**
 * Show the API key modal and return a promise that resolves with the key.
 * @param {string} provider - 'openrouter' or 'groq'
 */
function showAPIKeyModal(provider) {
    return new Promise((resolve) => {
        const modal = document.getElementById('api-key-modal');
        const input = document.getElementById('api-key-input');
        const submitBtn = document.getElementById('api-key-submit');
        const cancelBtn = document.getElementById('api-key-cancel');
        const modalTitle = document.getElementById('api-key-title');
        const modalDesc = document.getElementById('api-key-desc');
        const modalHint = document.getElementById('api-key-hint');

        // Update modal text based on provider
        if (provider === 'groq') {
            if (modalTitle) modalTitle.textContent = '🔑 Connect to Groq';
            if (modalDesc) modalDesc.textContent = 'Enter your Groq API key to enable AI-powered dialogue, impostor decisions, and meeting votes.';
            if (modalHint) modalHint.innerHTML = 'Get your key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>';
            if (input) input.placeholder = 'Paste your Groq API key here...';
        } else {
            if (modalTitle) modalTitle.textContent = '🔑 Connect to OpenRouter';
            if (modalDesc) modalDesc.textContent = 'Enter your OpenRouter API key to enable AI-powered dialogue, impostor decisions, and meeting votes.';
            if (modalHint) modalHint.innerHTML = 'Get your key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>';
            if (input) input.placeholder = 'Paste your OpenRouter API key here...';
        }

        if (!modal || !input || !submitBtn) {
            const key = prompt(`Enter your ${provider === 'groq' ? 'Groq' : 'OpenRouter'} API Key:`);
            resolve(key || null);
            return;
        }

        modal.classList.remove('hidden');
        input.value = '';
        input.focus();

        function cleanup() {
            modal.classList.add('hidden');
            submitBtn.removeEventListener('click', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
        }

        function onSubmit() {
            const key = input.value.trim();
            cleanup();
            resolve(key || null);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKey(e) {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
        }

        submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    });
}

/**
 * Asks the AI who should speak next in the meeting.
 * @param {string} chatHistory - The current transcript of the meeting
 * @param {Array} bots - List of all bots (to check who is alive)
 * @returns {Promise<string>} The name of the next speaker or 'skip'
 */
async function geminiChatOrchestrator(chatHistory, bots) {
    if (!isAIConnected()) return 'skip';

    const aliveBots = bots.filter(b => b.alive).map(b => b.name).join(', ');
    const systemPrompt = `You are a meeting orchestrator for Among Us. 
Given the chat history and the list of alive players, decide who should speak next.
If the conversation has naturally reached a pause or no one has anything relevant to add, return 'skip'.
If someone was just asked a question or accused, they should probably speak next.
Return ONLY the name of the player who should speak next, or 'skip'.
Alive Players: ${aliveBots}`;

    const prompt = `Chat History:\n${chatHistory}\n\nWho should speak next?`;

    try {
        const response = await geminiChatStructured(prompt, systemPrompt);
        return response ? response.trim() : 'skip';
    } catch (err) {
        console.error(`[${getProviderName()}] Orchestrator error:`, err);
        return 'skip';
    }
}
