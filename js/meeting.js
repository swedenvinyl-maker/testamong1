// meeting.js — Emergency meeting & body report logic, voting UI (Hybrid AI support)
// v5.0 - Cache Buster: 2026-02-14-15-00 (PERSISTENT MEMORY + VOTE FIX + DETECTIVE FIX)

class MeetingSystem {
    constructor() {
        this.phase = 'none'; // none, splash, discussion, voting, results, ejection
        this.timer = 0;
        this.discussionTime = 60000; // 60s discussion
        this.votingTime = 15000;     // 15s voting
        this.splashTime = 3000;      // 3s splash screen
        this.resultsTime = 4000;     // 4s results
        this.ejectionTime = 5000;    // 5s ejection animation

        this.reportType = ''; // 'body' or 'emergency'
        this.reporter = null;
        this.victim = null;
        this.bodyRoom = '';

        this.chatMessages = [];
        this.currentMessageIndex = 0;
        this.messageTimer = 0;
        this.visibleMessages = [];

        this.votes = {};
        this.votingDone = false;
        this.ejectedPlayer = null;
        this.ejectionText = '';
        this.showResults = false;
        this.aiMessagesLoading = false;
        this.aiMessagesReady = false;
        this.isGeneratingNext = false;
        this.nextAITimer = 2000;
        this.chatLog = [];
        this.loadingDots = 0;

        this.timerPaused = false;
        this.timerPaused_PlayerBusy = false;
        this.triggerAIResponse = false;
        this.domInitialized = false;

        this.investigationCount = 3;
        this.investigatedPlayers = new Set();
        this.prioritySpeaker = null;
        this.gameStateRef = null;

        this.aiVotesGenerated = false;
        this.aiVotesLoading = false;

        // NEW: Persistent meeting memory across rounds
        this.meetingHistory = [];      // Array of past meeting summaries
        this.meetingNumber = 0;        // Track which meeting we're on
        this.ejectionHistory = [];     // Who was ejected and what they were
        this.accusationMemory = {};    // Per-bot memory of who accused whom across meetings
        this.suspicionCarryover = {};  // Lingering suspicions from past meetings
        this.trackTarget = null;
    }

    addVisibleMessage(msg) {
        if (!msg) return;
        if (!msg.id) msg.id = 'msg-' + Date.now() + '-' + Math.random();
        if (!this.visibleMessages.some(m => m.id === msg.id)) {
            this.visibleMessages.push(msg);
        }
    }

    initDOM() {
        if (this.domInitialized) return true;

        const sendBtn = document.getElementById('chat-send-btn');
        const chatInput = document.getElementById('chat-input-box');
        const container = document.getElementById('meeting-input-container');

        if (sendBtn && chatInput && container) {
            sendBtn.onclick = () => this.submitMessage();
            chatInput.onkeydown = (e) => {
                if (e.key === 'Enter') this.submitMessage();
            };
            chatInput.onfocus = () => {
                if (this.phase === 'discussion') this.timerPaused = true;
            };
            chatInput.onblur = () => {
                this.timerPaused = false;
            };

            this.domInitialized = true;
            console.log("%c[SUCCESS] Among Us AI - Persistent Memory v5.0 Powered up!", "color: #00ff00; font-weight: bold; font-size: 16px;");
            return true;
        }
        return false;
    }

    submitMessage() {
        const chatInput = document.getElementById('chat-input-box');
        if (!chatInput || !chatInput.value.trim() || !this.gameStateRef) return;

        if (this.phase !== 'discussion' || this.timerPaused_PlayerBusy) return;
        this.timerPaused_PlayerBusy = true;

        const text = chatInput.value.trim();
        chatInput.value = '';
        this.timerPaused = false;
        this.handlePlayerMessage(this.gameStateRef.player, text);
        chatInput.blur();

        setTimeout(() => { this.timerPaused_PlayerBusy = false; }, 800);
    }

    // NEW: Build a formatted history string for AI context
    buildMeetingHistoryPrompt() {
        if (this.meetingHistory.length === 0) return '';

        let history = '\n=== PREVIOUS MEETING HISTORY ===\n';

        for (const meeting of this.meetingHistory) {
            history += `\n--- Meeting #${meeting.number} (${meeting.type}) ---\n`;

            if (meeting.type === 'body_report') {
                history += `Reporter: ${meeting.reporter} found ${meeting.victim}'s body in ${meeting.bodyRoom}\n`;
            } else {
                history += `Called by: ${meeting.reporter} (Emergency Meeting)\n`;
            }

            history += `Key accusations:\n`;
            for (const accusation of meeting.accusations) {
                history += `  - ${accusation.accuser} accused ${accusation.target}: "${accusation.quote}"\n`;
            }

            history += `Vote result: ${meeting.voteResult}\n`;

            if (meeting.ejected) {
                history += `Ejected: ${meeting.ejected.name} — ${meeting.ejected.wasImpostor ? 'WAS the Impostor!' : 'was NOT the Impostor.'}\n`;
            } else {
                history += `No one was ejected.\n`;
            }

            if (meeting.keyEvents && meeting.keyEvents.length > 0) {
                history += `Notable events:\n`;
                for (const event of meeting.keyEvents) {
                    history += `  - ${event}\n`;
                }
            }
        }

        history += '\n=== END OF HISTORY ===\n';
        history += `\nThis is now Meeting #${this.meetingNumber}. Players should remember and reference what happened in previous meetings.\n`;
        history += `If someone was ejected and turned out to be innocent, whoever accused them heavily should be more suspicious now.\n`;
        history += `If someone was ejected and WAS the impostor, whoever correctly accused them should be more trusted.\n`;

        return history;
    }

    // NEW: Extract accusations from chat log for memory storage
    extractAccusationsFromChat(chatLog, aliveBots) {
        const accusations = [];
        const accusationKeywords = [
            'sus', 'suspicious', 'suspect', 'impostor', 'imposter',
            'vote', 'kill', 'killed', 'saw', 'venting', 'vent',
            'fake', 'faking', 'liar', 'lying', 'think', 'accuse',
            'blame', 'watched', 'caught', 'witnessed'
        ];

        for (const line of chatLog) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;

            const speaker = line.substring(0, colonIdx).trim();
            const message = line.substring(colonIdx + 1).trim().toLowerCase();

            if (!accusationKeywords.some(k => message.includes(k))) continue;

            // Find who is being accused in this message
            const allPlayers = aliveBots || [];
            for (const target of allPlayers) {
                if (target.name.toLowerCase() === speaker.toLowerCase()) continue;
                if (message.includes(target.name.toLowerCase()) || message.includes(target.color.toLowerCase())) {
                    accusations.push({
                        accuser: speaker,
                        target: target.name,
                        quote: line.substring(colonIdx + 1).trim()
                    });
                    break;
                }
            }
        }

        return accusations;
    }

    // NEW: Save current meeting to history before ending
    saveMeetingToHistory(bots) {
        const allBots = bots || [];
        const accusations = this.extractAccusationsFromChat(this.chatLog, allBots);

        // Detect key events
        const keyEvents = [];

        // Track who defended themselves
        for (const line of this.chatLog) {
            const lower = line.toLowerCase();
            const defenseKeywords = ['wasn\'t me', 'not me', 'i didn\'t', 'i was in', 'i swear', 'innocent', 'i promise', 'trust me'];
            if (defenseKeywords.some(k => lower.includes(k))) {
                const speaker = line.substring(0, line.indexOf(':')).trim();
                keyEvents.push(`${speaker} defended themselves`);
            }
        }

        // Track alibi claims
        for (const line of this.chatLog) {
            const lower = line.toLowerCase();
            if (lower.includes('i was in') || lower.includes('i was at') || lower.includes('doing tasks')) {
                const speaker = line.substring(0, line.indexOf(':')).trim();
                const claim = line.substring(line.indexOf(':') + 1).trim();
                keyEvents.push(`${speaker} claimed: "${claim}"`);
            }
        }

        // Build vote result string
        let voteResultStr = '';
        const tally = {};
        for (const [voter, voted] of Object.entries(this.votes)) {
            if (!tally[voted]) tally[voted] = [];
            const voterBot = allBots.find(b => b.color === voter);
            tally[voted].push(voterBot ? voterBot.name : voter);
        }

        for (const [target, voters] of Object.entries(tally)) {
            const targetBot = allBots.find(b => b.color === target);
            const targetName = target === 'skip' ? 'Skip' : (targetBot ? targetBot.name : target);
            voteResultStr += `${targetName}: ${voters.length} votes (from ${voters.join(', ')}); `;
        }

        const meetingRecord = {
            number: this.meetingNumber,
            type: this.reportType === 'body' ? 'body_report' : 'emergency',
            reporter: this.reporter ? this.reporter.name : 'Unknown',
            victim: this.victim ? this.victim.name : null,
            bodyRoom: this.bodyRoom || null,
            chatLog: [...this.chatLog],
            accusations: accusations,
            voteResult: voteResultStr.trim(),
            ejected: this.ejectedPlayer ? {
                name: this.ejectedPlayer.name,
                color: this.ejectedPlayer.color,
                wasImpostor: this.ejectedPlayer.role === 'impostor'
            } : null,
            keyEvents: keyEvents.slice(0, 10) // Cap at 10 events to keep prompt manageable
        };

        this.meetingHistory.push(meetingRecord);

        // Update accusation memory
        for (const acc of accusations) {
            if (!this.accusationMemory[acc.accuser]) {
                this.accusationMemory[acc.accuser] = [];
            }
            this.accusationMemory[acc.accuser].push({
                meeting: this.meetingNumber,
                target: acc.target,
                quote: acc.quote
            });
        }

        // Update suspicion carryover based on ejection result
        if (this.ejectedPlayer) {
            const wasImpostor = this.ejectedPlayer.role === 'impostor';
            for (const acc of accusations) {
                if (acc.target === this.ejectedPlayer.name) {
                    if (!this.suspicionCarryover[acc.accuser]) {
                        this.suspicionCarryover[acc.accuser] = { correctCalls: 0, wrongCalls: 0 };
                    }
                    if (wasImpostor) {
                        this.suspicionCarryover[acc.accuser].correctCalls++;
                    } else {
                        this.suspicionCarryover[acc.accuser].wrongCalls++;
                    }
                }
            }
        }

        // Add ejection to history
        if (this.ejectedPlayer) {
            this.ejectionHistory.push({
                meeting: this.meetingNumber,
                name: this.ejectedPlayer.name,
                color: this.ejectedPlayer.color,
                wasImpostor: this.ejectedPlayer.role === 'impostor'
            });
        }

        console.log(`[MEMORY] Saved Meeting #${this.meetingNumber} to history. Total meetings stored: ${this.meetingHistory.length}`);
    }

    // NEW: Build suspicion context for AI
    buildSuspicionContext() {
        if (Object.keys(this.suspicionCarryover).length === 0) return '';

        let context = '\n=== PLAYER TRUST LEVELS (based on past voting accuracy) ===\n';
        for (const [name, record] of Object.entries(this.suspicionCarryover)) {
            if (record.correctCalls > 0) {
                context += `${name} correctly identified ${record.correctCalls} impostor(s) in past meetings — MORE TRUSTWORTHY\n`;
            }
            if (record.wrongCalls > 0) {
                context += `${name} falsely accused ${record.wrongCalls} innocent player(s) in past meetings — MORE SUSPICIOUS (could be impostor trying to mislead)\n`;
            }
        }
        context += '=== END TRUST LEVELS ===\n';
        return context;
    }

    // NEW: Build ejection history context
    buildEjectionContext() {
        if (this.ejectionHistory.length === 0) return '';

        let context = '\n=== EJECTION HISTORY ===\n';
        for (const ej of this.ejectionHistory) {
            context += `Meeting #${ej.meeting}: ${ej.name} was ejected — ${ej.wasImpostor ? 'WAS the Impostor ✓' : 'was INNOCENT ✗'}\n`;
        }
        context += '=== END EJECTION HISTORY ===\n';
        return context;
    }

    startBodyReport(reporter, victim, bodyRoom) {
        this.meetingNumber++;
        this.phase = 'splash';
        this.timer = this.splashTime;
        this.reportType = 'body';
        this.reporter = reporter;
        this.victim = victim;
        this.bodyRoom = bodyRoom;
        this.chatMessages = [];
        this.visibleMessages = [];
        this.currentMessageIndex = 0;
        this.votes = {};
        this.votingDone = false;
        this.ejectedPlayer = null;
        this.showResults = false;
        this.aiMessagesLoading = false;
        this.aiMessagesReady = false;
        this.chatLog = []; // Reset current meeting chat log (history is preserved separately)
        this.isGeneratingNext = false;
        this.nextAITimer = 2000;
        this.prioritySpeaker = null;
        this.timerPaused = false;
        this.timerPaused_PlayerBusy = false;
        this.triggerAIResponse = false;
        this.votingUIPopulated = false;
        this.aiVotesGenerated = false;
        this.aiVotesLoading = false;

        if (this.gameStateRef) {
            this.gameStateRef.bots.forEach(b => b.snapshotAlibi());
            if (this.gameStateRef.player) this.gameStateRef.player.snapshotAlibi();
        }
    }

    startEmergencyMeeting(caller) {
        this.meetingNumber++;
        this.phase = 'splash';
        this.timer = this.splashTime;
        this.reportType = 'emergency';
        this.reporter = caller;
        this.victim = null;
        this.bodyRoom = '';
        this.chatMessages = [];
        this.visibleMessages = [];
        this.currentMessageIndex = 0;
        this.votes = {};
        this.votingDone = false;
        this.ejectedPlayer = null;
        this.showResults = false;
        this.aiMessagesLoading = false;
        this.aiMessagesReady = false;
        this.chatLog = [];
        this.isGeneratingNext = false;
        this.nextAITimer = 2000;
        this.prioritySpeaker = null;
        this.timerPaused = false;
        this.timerPaused_PlayerBusy = false;
        this.triggerAIResponse = false;
        this.votingUIPopulated = false;
        this.aiVotesGenerated = false;
        this.aiVotesLoading = false;

        this.investigationCount = 3;
        this.investigatedPlayers.clear();

        const info = document.getElementById('detective-info');
        if (info) info.classList.add('hidden');
        const results = document.getElementById('investigation-results');
        if (results) results.innerHTML = '';

        if (this.gameStateRef) {
            this.gameStateRef.bots.forEach(b => b.snapshotAlibi());
            if (this.gameStateRef.player) this.gameStateRef.player.snapshotAlibi();
        }
    }

    async generateAIMessages(bots, gameState) {
        if (this.aiMessagesLoading || this.aiMessagesReady) return;
        this.aiMessagesLoading = true;
        this.currentContext = {
            type: this.reportType === 'body' ? 'body_report' : 'emergency',
            reporter: this.reporter,
            victim: this.victim,
            bodyRoom: this.bodyRoom,
            caller: this.reporter,
            // NEW: Pass meeting history to AI context
            meetingHistory: this.buildMeetingHistoryPrompt(),
            suspicionContext: this.buildSuspicionContext(),
            ejectionContext: this.buildEjectionContext(),
            meetingNumber: this.meetingNumber,
            accusationMemory: this.accusationMemory
        };

        try {
            if (isAIConnected()) {
                // Reporter usually speaks first to report the body or call the meeting
                const reporterBot = this.reporter;
                if (reporterBot && reporterBot.alive) {
                    const response = await generateNextBotResponseAI(bots, this.chatLog, this.currentContext, gameState, reporterBot);
                    if (response) {
                        this.chatLog.push(`${response.bot.name}: ${response.text}`);
                        const msg = { id: 'ai-initial-' + Date.now(), bot: response.bot, text: response.text, delay: 0 };
                        this.chatMessages.push(msg);
                        this.addVisibleMessage(msg);
                        response.bot.currentSpeech = response.text;
                        response.bot.speechTimer = 4000;
                    }
                }
            }
        } catch (err) {
            console.warn('Initial AI message failed:', err);
        }

        this.aiMessagesReady = true;
        this.aiMessagesLoading = false;
        this.nextAITimer = 3000;
    }

    handlePlayerMessage(playerBot, text) {
        if (this.phase !== 'discussion') return;

        this.chatLog.push(`${playerBot ? playerBot.name : 'Unknown'}: ${text}`);
        this.nextAITimer = 1000 + Math.random() * 2000;

        const msg = {
            id: 'player-' + Date.now() + '-' + Math.random(),
            bot: playerBot,
            text: text,
            delay: 0
        };
        this.chatMessages.splice(this.currentMessageIndex, 0, msg);
        this.addVisibleMessage(msg);
        this.currentMessageIndex++;

        const bots = this.gameStateRef ? this.gameStateRef.bots : [];
        this.prioritySpeaker = this.extractMentionedBot(text, bots);
        if (this.prioritySpeaker) {
            console.log(`[AI] Player mentioned ${this.prioritySpeaker.name}, prioritizing them.`);
            this.nextAITimer = 500 + Math.random() * 1000;
        }

        if (playerBot) {
            playerBot.currentSpeech = text;
            playerBot.speechTimer = 4000;
        }

        this.timerPaused = false;

        const lowerText = text.toLowerCase();

        const followKeywords = ['follow', 'track', 'come with', 'stick to', 'tail'];
        if (followKeywords.some(k => lowerText.includes(k))) {
            let foundAny = false;
            bots.forEach(bot => {
                if (lowerText.includes(bot.color.toLowerCase()) || lowerText.includes(bot.name.toLowerCase())) {
                    if (lowerText.includes('me') || lowerText.includes('with me')) {
                        bot.isFollowingPlayer = true;
                        bot.followingBot = null;
                        bot.campRoom = null;
                        foundAny = true;
                    } else {
                        const targetBot = bots.find(b => b !== bot && (lowerText.includes(b.color.toLowerCase()) || lowerText.includes(b.name.toLowerCase())));
                        if (targetBot && lowerText.indexOf(targetBot.name.toLowerCase()) > lowerText.indexOf(bot.name.toLowerCase())) {
                            bot.followingBot = targetBot;
                            bot.isFollowingPlayer = false;
                            bot.campRoom = null;
                            foundAny = true;
                        }
                    }
                }
            });

            if (!foundAny && (lowerText.includes('me') || lowerText.includes('with me'))) {
                bots.forEach(bot => {
                    if (lowerText.includes(bot.color.toLowerCase()) || lowerText.includes(bot.name.toLowerCase())) {
                        bot.isFollowingPlayer = true;
                        bot.followingBot = null;
                        bot.campRoom = null;
                    }
                });
            }
        }

        const campKeywords = ['camp', 'go to', 'stay in', 'wait in', 'head to', 'stand in'];
        if (typeof ROOMS !== 'undefined') {
            const roomKeys = Object.keys(ROOMS);
            for (const roomKey of roomKeys) {
                const rName = ROOMS[roomKey].name.toLowerCase();
                if (lowerText.includes(roomKey.toLowerCase()) || lowerText.includes(rName)) {
                    if (campKeywords.some(k => lowerText.includes(k))) {
                        let targets = bots.filter(b => b.alive && b !== playerBot && (lowerText.includes(b.color.toLowerCase()) || lowerText.includes(b.name.toLowerCase())));
                        if (lowerText.includes('everyone')) targets = bots.filter(b => b.alive && b !== playerBot);

                        targets.forEach(targetBot => {
                            targetBot.campRoom = roomKey;
                            targetBot.isFollowingPlayer = false;
                            targetBot.followingBot = null;
                        });
                    }
                }
            }
        }

        this.timerPaused = false;
    }

    async generateAIVotes(bots, gameState) {
        if (this.aiVotesLoading || this.aiVotesGenerated) return;
        this.aiVotesLoading = true;

        const aliveBots = bots.filter(b => b.alive);
        const aliveNames = aliveBots.map(b => b.name);

        const nameToColor = {};
        aliveBots.forEach(b => {
            nameToColor[b.name.toLowerCase()] = b.color;
            nameToColor[b.color.toLowerCase()] = b.color;
        });

        // NEW: Include meeting history in vote prompt
        const historyContext = this.buildMeetingHistoryPrompt();
        const suspicionContext = this.buildSuspicionContext();
        const ejectionContext = this.buildEjectionContext();

        for (const bot of aliveBots) {
            if (gameState.player && bot.color === gameState.player.color) continue;

            try {
                if (isAIConnected()) {
                    const chatTranscript = this.chatLog.join('\n');

                    const prompt = `You are analyzing an Among Us meeting chat to determine how "${bot.name}" (${bot.color}) should vote.
${historyContext}
${ejectionContext}
${suspicionContext}

Here is the full chat transcript from THIS meeting (#${this.meetingNumber}):
---
${chatTranscript}
---

The alive players are: ${aliveNames.join(', ')}

Based on BOTH the current chat AND the meeting history above, determine who "${bot.name}" should vote for. Consider:
1. Direct accusations by ${bot.name} in THIS meeting (e.g., "${bot.name}: I think [someone] is the impostor")
2. ${bot.name} agreeing with someone else's accusation in THIS meeting
3. ${bot.name} expressing suspicion toward someone in THIS meeting
4. If ${bot.name} was accused by others and defended themselves, they might vote for their accuser
5. IMPORTANT: If a previous meeting resulted in an innocent player being ejected, ${bot.name} should be MORE suspicious of whoever pushed hardest for that wrong ejection
6. IMPORTANT: If a previous meeting correctly identified an impostor, ${bot.name} should TRUST whoever made that correct call
7. If someone was suspicious in a PREVIOUS meeting but wasn't voted out, that suspicion should carry over

If ${bot.name} never spoke or never accused anyone AND there's no relevant history, they should vote for whoever was accused the most by others.

If truly no one was accused at all in any meeting, respond with exactly: skip

IMPORTANT: Respond with ONLY the exact name of the player ${bot.name} should vote for, or "skip". Nothing else. No explanation. Just the name or "skip".`;

                    const voteResponse = await geminiChatStructured(prompt, 'Respond with ONLY a player name or "skip". No other text.');
                    let voteTarget = voteResponse ? voteResponse.replace(/[."']/g, '').trim().toLowerCase() : '';

                    console.log(`[AI VOTE] ${bot.name} wants to vote for: "${voteTarget}"`);

                    if (voteTarget === 'skip' || voteTarget === '') {
                        this.votes[bot.color] = 'skip';
                    } else {
                        const matchedColor = nameToColor[voteTarget];
                        if (matchedColor && matchedColor !== bot.color) {
                            this.votes[bot.color] = matchedColor;
                        } else {
                            let found = false;
                            for (const aliveBot of aliveBots) {
                                if (aliveBot.color === bot.color) continue;
                                if (voteTarget.includes(aliveBot.name.toLowerCase()) ||
                                    voteTarget.includes(aliveBot.color.toLowerCase())) {
                                    this.votes[bot.color] = aliveBot.color;
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                this.votes[bot.color] = 'skip';
                            }
                        }
                    }
                    console.log(`[AI VOTE FINAL] ${bot.name} (${bot.color}) votes: ${this.votes[bot.color]}`);
                }
            } catch (err) {
                console.warn(`[AI VOTE ERROR] ${bot.name} vote failed:`, err);
                this.votes[bot.color] = this.fallbackVoteFromChat(bot, aliveBots);
            }
        }

        this.aiVotesGenerated = true;
        this.aiVotesLoading = false;
    }

    fallbackVoteFromChat(bot, aliveBots) {
        const botName = bot.name.toLowerCase();
        let lastAccused = null;

        for (let i = this.chatLog.length - 1; i >= 0; i--) {
            const line = this.chatLog[i].toLowerCase();

            if (!line.startsWith(botName + ':')) continue;

            const messageText = line.substring(line.indexOf(':') + 1).trim();

            const accusationKeywords = [
                'sus', 'suspicious', 'suspect', 'impostor', 'imposter',
                'voted', 'vote', 'kill', 'killed', 'saw', 'venting',
                'vent', 'fake', 'faking', 'liar', 'lying', 'it\'s',
                'its', 'was', 'think', 'accuse', 'blame'
            ];

            const hasAccusation = accusationKeywords.some(k => messageText.includes(k));
            if (!hasAccusation) continue;

            for (const target of aliveBots) {
                if (target.color === bot.color) continue;
                if (messageText.includes(target.name.toLowerCase()) ||
                    messageText.includes(target.color.toLowerCase())) {
                    lastAccused = target.color;
                    break;
                }
            }

            if (lastAccused) break;
        }

        // NEW: If no accusation found in current chat, check history
        if (!lastAccused && this.meetingHistory.length > 0) {
            const lastMeeting = this.meetingHistory[this.meetingHistory.length - 1];
            for (const acc of lastMeeting.accusations) {
                if (acc.accuser.toLowerCase() === botName) {
                    const target = aliveBots.find(b =>
                        b.name.toLowerCase() === acc.target.toLowerCase() && b.alive
                    );
                    if (target && target.color !== bot.color) {
                        lastAccused = target.color;
                        console.log(`[FALLBACK VOTE] ${bot.name} remembers accusing ${target.name} last meeting`);
                        break;
                    }
                }
            }
        }

        if (lastAccused) {
            console.log(`[FALLBACK VOTE] ${bot.name} votes for ${lastAccused} (from chat scan)`);
            return lastAccused;
        }

        const accusationCounts = {};
        // Scan current meeting
        for (const line of this.chatLog) {
            const lower = line.toLowerCase();
            const accusationKeywords = ['sus', 'suspicious', 'impostor', 'imposter', 'vent', 'kill', 'fake', 'liar'];
            if (!accusationKeywords.some(k => lower.includes(k))) continue;

            for (const target of aliveBots) {
                if (target.color === bot.color) continue;
                if (lower.includes(target.name.toLowerCase()) || lower.includes(target.color.toLowerCase())) {
                    accusationCounts[target.color] = (accusationCounts[target.color] || 0) + 1;
                }
            }
        }

        // NEW: Also scan previous meeting accusations with reduced weight
        for (const meeting of this.meetingHistory) {
            for (const acc of meeting.accusations) {
                const target = aliveBots.find(b =>
                    b.name.toLowerCase() === acc.target.toLowerCase() && b.alive
                );
                if (target && target.color !== bot.color) {
                    accusationCounts[target.color] = (accusationCounts[target.color] || 0) + 0.5; // Half weight for old accusations
                }
            }
        }

        // NEW: Factor in wrong ejection suspicion
        if (this.ejectionHistory.length > 0) {
            for (const ej of this.ejectionHistory) {
                if (!ej.wasImpostor) {
                    // Someone innocent was ejected — who pushed for it?
                    const meetingRecord = this.meetingHistory.find(m => m.number === ej.meeting);
                    if (meetingRecord) {
                        for (const acc of meetingRecord.accusations) {
                            if (acc.target === ej.name) {
                                const pusher = aliveBots.find(b =>
                                    b.name.toLowerCase() === acc.accuser.toLowerCase() && b.alive
                                );
                                if (pusher && pusher.color !== bot.color) {
                                    accusationCounts[pusher.color] = (accusationCounts[pusher.color] || 0) + 1.5; // Extra suspicion
                                }
                            }
                        }
                    }
                }
            }
        }

        let maxCount = 0;
        let mostAccused = null;
        for (const [color, count] of Object.entries(accusationCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostAccused = color;
            }
        }

        if (mostAccused) {
            console.log(`[FALLBACK VOTE] ${bot.name} votes for most accused: ${mostAccused}`);
            return mostAccused;
        }

        console.log(`[FALLBACK VOTE] ${bot.name} skips (no accusations found)`);
        return 'skip';
    }

    forceHideVotingOverlay() {
        const overlay = document.getElementById('voting-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            overlay.style.visibility = 'hidden';
            overlay.style.pointerEvents = 'none';
        }
    }

    forceShowVotingOverlay() {
        const overlay = document.getElementById('voting-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = '';
            overlay.style.visibility = 'visible';
            overlay.style.pointerEvents = 'auto';
        }
    }

    update(dt, bots, gameState) {
        this.gameStateRef = gameState;

        if (!this.domInitialized) this.initDOM();

        const chatContainer = document.getElementById('meeting-input-container');
        if (chatContainer) {
            const isDiscussionOrSplash = (this.phase === 'discussion' || this.phase === 'splash');
            const isPlayMode = (gameState.gameMode === 'play');

            if (isDiscussionOrSplash && isPlayMode) {
                chatContainer.classList.remove('hidden');
                chatContainer.style.display = 'flex';
                chatContainer.style.visibility = 'visible';
                chatContainer.style.opacity = '1';
                chatContainer.style.zIndex = '999999';

                const chatInput = document.getElementById('chat-input-box');
                if (chatInput) {
                    chatInput.disabled = (this.phase === 'splash');
                    chatInput.placeholder = (this.phase === 'splash') ? "Wait for discussion..." : "Type your message...";
                }
            } else {
                chatContainer.classList.add('hidden');
                chatContainer.style.display = 'none';
            }
        }

        if (this.phase === 'none') {
            this.forceHideVotingOverlay();
            return;
        }

        const isDetective = gameState.player?.extraRole === 'detective' && gameState.player.alive;
        if (this.phase !== 'voting' && !(this.phase === 'discussion' && isDetective)) {
            this.forceHideVotingOverlay();
        } else if (this.phase === 'discussion' && isDetective) {
            this.forceShowVotingOverlay();
            if (!this.votingUIPopulated) {
                this.populateVotingUI(gameState);
                this.votingUIPopulated = true;
            }
        }

        if (!this.timerPaused) this.timer -= dt;

        this.loadingDots = (this.loadingDots + dt * 0.003) % 4;

        for (const bot of bots) {
            if (bot.speechTimer > 0) {
                bot.speechTimer -= dt;
                if (bot.speechTimer <= 0) bot.currentSpeech = null;
            }
        }

        switch (this.phase) {
            case 'splash':
                this.forceHideVotingOverlay();
                if (this.timer <= 0) {
                    this.phase = 'discussion';
                    this.timer = this.discussionTime;
                    this.messageTimer = 0;
                    this.generateAIMessages(bots, gameState);
                }
                break;

            case 'discussion':
                this.forceHideVotingOverlay();

                if (!this.timerPaused) {
                    this.messageTimer += dt;
                    if (!this.isGeneratingNext) {
                        this.nextAITimer -= dt;
                        if (this.nextAITimer <= 0) {
                            this.generateNextAIResponse(bots, gameState);
                            this.nextAITimer = 3000 + Math.random() * 5000;
                        }
                    }
                }

                if (this.aiMessagesReady) {
                    while (this.currentMessageIndex < this.chatMessages.length &&
                        this.chatMessages[this.currentMessageIndex].delay <= this.messageTimer) {
                        this.addVisibleMessage(this.chatMessages[this.currentMessageIndex]);
                        this.currentMessageIndex++;
                    }
                }

                if (this.timer <= 0) {
                    while (this.currentMessageIndex < this.chatMessages.length) {
                        this.addVisibleMessage(this.chatMessages[this.currentMessageIndex]);
                        this.currentMessageIndex++;
                    }
                    this.phase = 'voting';
                    this.timer = this.votingTime;
                    this.votingUIPopulated = false; // Repopulate for voting
                    this.generateAIVotes(bots, gameState);
                }
                break;

            case 'voting':
                if (gameState.player && gameState.player.alive && !this.votes[gameState.player.color]) {
                    this.forceShowVotingOverlay();
                    if (!this.votingUIPopulated) {
                        this.populateVotingUI(gameState);
                        this.votingUIPopulated = true;
                    }
                } else {
                    this.forceHideVotingOverlay();
                }

                if (this.timer <= 0 && !this.votingDone) {
                    if (gameState.player && gameState.player.alive && !this.votes[gameState.player.color]) {
                        this.votes[gameState.player.color] = 'skip';
                    }

                    if (!this.aiVotesGenerated && this.aiVotesLoading) {
                        this.timer = 1000;
                        return;
                    }

                    if (!this.aiVotesGenerated) {
                        const aliveBots = bots.filter(b => b.alive);
                        for (const bot of aliveBots) {
                            if (gameState.player && bot.color === gameState.player.color) continue;
                            if (!this.votes[bot.color]) {
                                this.votes[bot.color] = this.fallbackVoteFromChat(bot, aliveBots);
                            }
                        }
                    }

                    this.forceHideVotingOverlay();

                    // NEW: Save meeting to history BEFORE tallying (so we capture the full discussion)
                    this.saveMeetingToHistory(bots);

                    this.tallyVotes(bots, gameState);
                    this.votingDone = true;
                    this.phase = 'results';
                    this.timer = this.resultsTime;

                    // NEW: Update the last history entry with ejection result
                    if (this.meetingHistory.length > 0) {
                        const lastRecord = this.meetingHistory[this.meetingHistory.length - 1];
                        lastRecord.ejected = this.ejectedPlayer ? {
                            name: this.ejectedPlayer.name,
                            color: this.ejectedPlayer.color,
                            wasImpostor: this.ejectedPlayer.role === 'impostor'
                        } : null;
                    }
                }
                break;

            case 'results':
                this.forceHideVotingOverlay();
                if (this.timer <= 0) {
                    if (this.ejectedPlayer) {
                        this.phase = 'ejection';
                        this.timer = this.ejectionTime;
                    } else {
                        this.endMeeting(bots, gameState);
                    }
                }
                break;

            case 'ejection':
                this.forceHideVotingOverlay();
                if (this.timer <= 0) this.endMeeting(bots, gameState);
                break;
        }
    }

    tallyVotes(bots, gameState) {
        const tally = { 'skip': 0 };
        for (const [voter, voted] of Object.entries(this.votes)) {
            tally[voted] = (tally[voted] || 0) + 1;
        }

        let maxVotes = 0, maxColor = null, tie = false;
        for (const [color, count] of Object.entries(tally)) {
            if (color === 'skip') continue;
            if (count > maxVotes) { maxVotes = count; maxColor = color; tie = false; }
            else if (count === maxVotes) tie = true;
        }

        if (tally['skip'] >= maxVotes || tie || maxVotes === 0) {
            this.ejectedPlayer = null;
            this.ejectionText = 'No one was ejected. (Skipped)';
        } else {
            const ejected = bots.find(b => b.color === maxColor);
            if (ejected) {
                ejected.die(ejected.x, ejected.y);
                this.ejectedPlayer = ejected;
                this.ejectionText = `${ejected.name} was ${ejected.role === 'impostor' ? '' : 'not '}An Impostor.`;
                gameState.onEjection(ejected);
            }
        }
    }

    endMeeting(bots, gameState) {
        this.phase = 'none';
        gameState.phase = 'playing';
        gameState.meetingCooldown = 15000;

        this.forceHideVotingOverlay();

        if (this.trackTarget && gameState.player) {
            gameState.player.trackedTarget = this.trackTarget;
            console.log(`[TRACKER] Player is now tracking ${this.trackTarget.name}`);
        }

        for (const bot of bots) bot.resetForRound();
        gameState.scatterBots();
        gameState.reportedBodies.clear();

        console.log(`[MEMORY] Meeting #${this.meetingNumber} ended. History size: ${this.meetingHistory.length}, Ejections: ${this.ejectionHistory.length}`);
    }

    // NEW: Reset all memory (call this when starting a brand new game)
    resetAllMemory() {
        this.meetingHistory = [];
        this.meetingNumber = 0;
        this.ejectionHistory = [];
        this.accusationMemory = {};
        this.suspicionCarryover = {};
        console.log("[MEMORY] All meeting memory cleared for new game.");
    }

    getPhaseLabel() {
        switch (this.phase) {
            case 'splash': return this.reportType === 'body' ? 'DEAD BODY REPORTED' : 'EMERGENCY MEETING';
            case 'discussion':
                const dots = '.'.repeat(Math.floor(this.loadingDots));
                const meetingLabel = this.meetingNumber > 1 ? ` (Meeting #${this.meetingNumber})` : '';
                return `Discussion: ${Math.ceil(this.timer / 1000)}s${meetingLabel}${this.aiMessagesLoading ? ' (Thinking' + dots + ')' : ''}`;
            case 'voting':
                const voteDots = '.'.repeat(Math.floor(this.loadingDots));
                return `Voting: ${Math.ceil(this.timer / 1000)}s${this.aiVotesLoading ? ' (Deciding' + voteDots + ')' : ''}`;
            case 'results': return 'Vote Results';
            case 'ejection': return this.ejectionText;
            default: return '';
        }
    }

    populateVotingUI(gameState) {
        const container = document.getElementById('vote-buttons-container');
        if (!container) return;
        container.innerHTML = '';

        const candidates = gameState.bots.filter(b => b.alive);
        candidates.forEach(bot => {
            const card = document.createElement('div');
            card.className = 'player-vote-card';

            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            if (this.votes[gameState.player.color] === bot.color) btn.classList.add('voted');

            const colorDef = (typeof COLORS !== 'undefined' && COLORS[bot.color]) ? COLORS[bot.color] : { body: '#fff' };
            btn.innerHTML = `<div class="vote-color-indicator" style="background: ${colorDef.body}"></div><span>${bot.name}</span>`;
            btn.onclick = () => {
                if (this.phase !== 'voting') return;
                this.votes[gameState.player.color] = bot.color;
                this.populateVotingUI(gameState);
            };
            if (this.phase !== 'voting') btn.style.opacity = '0.5';
            card.appendChild(btn);

            if (gameState.player?.extraRole === 'detective' && bot.alive && bot !== gameState.player) {
                const invBtn = document.createElement('button');
                invBtn.className = 'investigate-btn';
                invBtn.textContent = this.investigatedPlayers.has(bot.color) ? 'INVESTIGATED' : 'INVESTIGATE';
                invBtn.disabled = (this.investigatedPlayers.has(bot.color) || this.investigationCount <= 0);
                invBtn.onclick = (e) => { e.stopPropagation(); this.investigatePlayer(bot); };
                card.appendChild(invBtn);
                const info = document.getElementById('detective-info');
                if (info) info.classList.remove('hidden');
                this.updateInvestigationUI();
            }

            if (gameState.player?.extraRole === 'tracker' && bot.alive && bot !== gameState.player) {
                const trackBtn = document.createElement('button');
                trackBtn.className = 'track-btn';
                trackBtn.textContent = (this.trackTarget === bot) ? 'TRACKING' : 'TRACK';
                if (this.trackTarget === bot) trackBtn.classList.add('active');
                trackBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.trackTarget = bot;
                    this.populateVotingUI(gameState);
                };
                card.appendChild(trackBtn);
            }
            container.appendChild(card);
        });

        const skipCard = document.createElement('div');
        skipCard.className = 'player-vote-card';
        skipCard.style.gridColumn = 'span 3';
        const skipBtn = document.createElement('button');
        skipBtn.className = 'vote-btn skip-btn';
        if (this.votes[gameState.player.color] === 'skip') skipBtn.classList.add('voted');
        skipBtn.textContent = 'SKIP VOTE';
        skipBtn.onclick = () => {
            if (this.phase !== 'voting') return;
            this.votes[gameState.player.color] = 'skip';
            this.populateVotingUI(gameState);
        };
        if (this.phase !== 'voting') skipBtn.style.opacity = '0.5';
        skipCard.appendChild(skipBtn);
        container.appendChild(skipCard);
    }

    investigatePlayer(bot) {
        if (this.investigationCount <= 0 || this.investigatedPlayers.has(bot.color)) return;
        this.investigationCount--;
        this.investigatedPlayers.add(bot.color);
        const results = document.getElementById('investigation-results');
        if (results) {
            const tag = document.createElement('div');
            tag.className = 'result-tag';
            tag.textContent = `${bot.name}: ${bot.snapshottedRoom || 'Unknown'}`;
            results.appendChild(tag);
        }
        this.updateInvestigationUI();
        this.populateVotingUI(this.gameStateRef);
    }

    updateInvestigationUI() {
        const count = document.getElementById('investigation-count');
        if (count) count.textContent = this.investigationCount;
    }

    extractMentionedBot(text, bots) {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const bot of bots) {
            if (lower.includes(bot.name.toLowerCase()) || lower.includes(bot.color.toLowerCase())) return bot;
        }
        return null;
    }

    async generateNextAIResponse(bots, gameState) {
        if (this.isGeneratingNext || this.phase !== 'discussion') return;
        this.isGeneratingNext = true;
        try {
            if (isAIConnected()) {
                const transcript = this.chatLog.join('\n');
                const nextSpeakerName = await geminiChatOrchestrator(transcript, bots);

                if (nextSpeakerName && nextSpeakerName.toLowerCase() !== 'skip') {
                    const speaker = bots.find(b => b.name.toLowerCase() === nextSpeakerName.toLowerCase() && b.alive);
                    if (speaker) {
                        const response = await generateNextBotResponseAI(bots, this.chatLog, this.currentContext, gameState, speaker);
                        if (response) {
                            this.chatLog.push(`${response.bot.name}: ${response.text}`);
                            const msg = { id: 'ai-reactive-' + Date.now(), bot: response.bot, text: response.text, delay: 0 };
                            this.chatMessages.push(msg);
                            this.addVisibleMessage(msg);

                            response.bot.currentSpeech = response.text;
                            response.bot.speechTimer = 4000;
                        }
                    }
                }
            }
        } catch (err) { console.warn("Orchestrated AI failed:", err); }
        finally { this.isGeneratingNext = false; }
    }
}