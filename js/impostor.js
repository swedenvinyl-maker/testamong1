// impostor.js — Impostor-specific AI with kill risk assessment
class Impostor extends Bot {
    constructor(id, color) {
        super(id, color, 'impostor');
        this.killCooldownMax = 30000; // 30s kill cooldown
        this.killTimer = 15000;       // 15s initial cooldown at round start
        this.killRange = 80;
        this.isVenting = false;
        this.ventTimer = 0;
        this.currentVent = null;
        this.sabotageCooldown = 30000; // 30s initial cooldown for sabotage
        this.fakingTask = false;
        this.targetVictim = null;
        this.cautiousness = 0.55 + Math.random() * 0.35; // 0.55-0.9
        this.kills = []; // track our kills for lying purposes
        this.fakeAlibiRoom = null; // room we'll claim to have been in

        // NEW: Self-report cooldown system
        this.selfReportCooldown = 0;        // Cooldown preventing self-report
        this.lastKillVictimId = null;       // Track the last victim's ID

        // Extra Roles
        this.shiftTimer = 0;
        this.shiftCooldown = 0;
        this.isShifted = false;
        this.shiftedColor = null;
        this.phantomTimer = 0;
        this.phantomCooldown = 0;
        this.isPhantom = false;
        this.aiDecisionCooldown = 0; // Cooldown for AI decision calls
    }

    update(dt, allBots, gameState) {
        if (!this.alive) return;
        if (gameState.phase === 'meeting') return;

        // Player Control Override
        if (this.isPlayer) {
            this.currentRoom = getRoomAt(this.x, this.y) || this.currentRoom;
            this.updateSightingsAndAlibis(allBots);

            // Decrement kill cooldown for player
            this.killTimer -= dt;

            // Animation for player
            if (this.state === 'moving') {
                this.frameTimer += dt;
                if (this.frameTimer > 150) {
                    this.frame++;
                    this.frameTimer = 0;
                }
            }
            return; // Skip AI behavior
        }

        this.killTimer -= dt;
        this.sabotageCooldown -= dt;

        // NEW: Decrement self-report cooldown
        if (this.selfReportCooldown > 0) this.selfReportCooldown -= dt;

        // Update Extra Role Timers
        if (this.shiftCooldown > 0) this.shiftCooldown -= dt;
        if (this.phantomCooldown > 0) this.phantomCooldown -= dt;

        if (this.isShifted) {
            this.shiftTimer -= dt;
            if (this.shiftTimer <= 0) this.unshift();
        }

        if (this.isPhantom) {
            this.phantomTimer -= dt;
            if (this.phantomTimer <= 0) this.isPhantom = false;
        }

        // Handle venting
        if (this.isVenting) {
            this.ventTimer -= dt;
            if (this.ventTimer <= 0) {
                this.exitVent();
            }
            return;
        }

        // Check for kill opportunity — only if cooldown is done
        if (this.killTimer <= 0) {
            this.evaluateKillOpportunity(allBots, gameState);
        }

        // Animate
        this.frameTimer += dt;
        if (this.frameTimer > 150) {
            this.frame++;
            this.frameTimer = 0;
        }

        this.currentRoom = getRoomAt(this.x, this.y) || this.currentRoom;
        this.updateSightingsAndAlibis(allBots);

        switch (this.state) {
            case 'idle':
                this.handleImpostorIdle(dt, allBots, gameState);
                break;
            case 'moving':
                this.handleMoving(dt);
                break;
            case 'doing_task':
                this.handleFakeTask(dt);
                break;
            case 'waiting':
                this.handleWaiting(dt);
                break;
        }

        // Occasional sabotage
        if (this.sabotageCooldown <= 0 && Math.random() < 0.0008) {
            this.trySabotage(gameState);
        }

        // AI decision cooldown
        if (this.aiDecisionCooldown > 0) this.aiDecisionCooldown -= dt;

        // Impostors sometimes report bodies for cover (using overridden method)
        if (Math.random() < 0.12) {
            this.checkForBodies(allBots, gameState);
        }
    }

    shapeshift(allBots) {
        if (this.isShifted || this.shiftCooldown > 0) return;

        // 1. Find the farthest point from all alive bots
        const safePoint = this.findFarthestSafePoint(allBots);
        if (safePoint) {
            this.x = safePoint.x;
            this.y = safePoint.y;
            this.currentRoom = safePoint.room || getRoomAt(this.x, this.y);
            this.state = 'idle';
            this.path = [];
            this.pathIndex = 0;
        }

        // 2. Transform into a random Among Us color
        const colors = COLOR_NAMES.filter(c => c !== this.color);
        this.shiftedColor = colors[Math.floor(Math.random() * colors.length)];

        this.isShifted = true;
        this.shiftTimer = 10000; // 10s
        this.shiftCooldown = 30000; // 30s
        console.log(`${this.name} teleported to safety and shifted into ${this.shiftedColor}`);

        // If someone STILL sees this (unlikely but possible), they get suspicious of the NEW color
        allBots.forEach(b => {
            if (b !== this && b.alive) {
                const d = Math.hypot(b.x - this.x, b.y - this.y);
                if (d < b.visionRadius) {
                    b.suspicions[this.shiftedColor] = (b.suspicions[this.shiftedColor] || 0) + 0.15;
                }
            }
        });
    }

    findFarthestSafePoint(allBots) {
        let bestPoint = null;
        let maxMinDist = -1;

        const aliveBots = allBots.filter(b => b.alive && b !== this);
        if (aliveBots.length === 0) return WAYPOINTS[0];

        // Sample a subset of waypoints to avoid heavy computation if needed,
        // but 55 waypoints is small enough.
        for (const wp of WAYPOINTS) {
            let minDistToBot = Infinity;
            for (const bot of aliveBots) {
                const d = Math.hypot(wp.x - bot.x, wp.y - bot.y);
                if (d < minDistToBot) minDistToBot = d;
            }

            if (minDistToBot > maxMinDist) {
                maxMinDist = minDistToBot;
                bestPoint = wp;
            }
        }

        return bestPoint;
    }

    unshift() {
        this.isShifted = false;
        this.shiftedColor = null;
    }

    goPhantom() {
        if (this.isPhantom || this.phantomCooldown > 0) return;
        this.isPhantom = true;
        this.phantomTimer = 6000; // 6s
        this.phantomCooldown = 30000; // 30s
        console.log(`${this.name} went Phantom`);
    }

    handleImpostorIdle(dt, allBots, gameState) {
        this.idleTimer += dt;

        if (this.idleTimer > 1500 + Math.random() * 2000) {
            this.idleTimer = 0;

            const roll = Math.random();

            if (roll < 0.35 && this.killTimer <= 0) {
                // Hunt for isolated target
                this.huntForTarget(allBots);
            } else if (roll < 0.65) {
                // Fake a task
                this.goFakeTask();
            } else {
                // Just wander (build alibi)
                this.wanderToRandomRoom();
            }

            // Extra Role Usage
            if (this.extraRole === 'shapeshifter' && this.shiftCooldown <= 0 && Math.random() < 0.1) {
                this.shapeshift(allBots);
            }
            if (this.extraRole === 'phantom' && this.phantomCooldown <= 0 && Math.random() < 0.1) {
                this.goPhantom();
            }

            // AI-driven destination choice (occasional)
            if (isAIConnected() && this.aiDecisionCooldown <= 0 && Math.random() < 0.15) {
                this.chooseDestinationAI(allBots, gameState);
            }
        }
    }

    huntForTarget(allBots) {
        const aliveCrewmates = allBots.filter(b => b.alive && b.role === 'crewmate');
        if (aliveCrewmates.length === 0) return;

        let bestTarget = null;
        let bestScore = -1;

        for (const crew of aliveCrewmates) {
            const score = this.assessKillScore(crew, allBots);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = crew;
            }
        }

        if (bestTarget && bestScore > 0.3) {
            this.targetVictim = bestTarget;
            const path = findPathBetweenPoints(this.x, this.y, bestTarget.x, bestTarget.y);
            if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                this.state = 'moving';
            }
        } else {
            // No good target, fake a task instead
            this.goFakeTask();
        }
    }

    // Evaluate whether killing this target is worth the risk (0=terrible, 1=great)
    assessKillScore(target, allBots) {
        // Count nearby witnesses (excluding target and self)
        let witnesses = 0;
        let nearestWitnessDist = Infinity;
        for (const other of allBots) {
            if (other === this || other === target || !other.alive) continue;
            const dist = Math.hypot(other.x - target.x, other.y - target.y);
            if (dist < 280) {
                witnesses++;
                nearestWitnessDist = Math.min(nearestWitnessDist, dist);
            }
        }

        // Score based on isolation
        let score = 0;
        if (witnesses === 0) {
            score = 1.0; // Perfect — no witnesses
        } else if (witnesses === 1 && nearestWitnessDist > 200) {
            score = 0.4; // Risky
        } else {
            score = 0.05; // Too many witnesses
        }

        // Bonus if near a vent (escape route)
        let nearVent = false;
        for (const [ventId, vent] of Object.entries(VENTS)) {
            if (vent.room === this.currentRoom) {
                const dist = Math.hypot(vent.x - this.x, vent.y - this.y);
                if (dist < 120) {
                    nearVent = true;
                    break;
                }
            }
        }
        if (nearVent) score += 0.15;

        // Penalty if in a high-traffic room
        const highTraffic = ['cafeteria', 'admin', 'electrical'];
        if (highTraffic.includes(this.currentRoom)) {
            score -= 0.1;
        }

        // Penalty based on distance to travel
        const dist = Math.hypot(target.x - this.x, target.y - this.y);
        if (dist > 400) score -= 0.2;

        // Cautiousness factor — more cautious impostors need higher scores
        score -= (1 - this.cautiousness) * 0.2;

        return Math.max(0, Math.min(1, score));
    }

    async evaluateKillOpportunity(allBots, gameState) {
        for (const other of allBots) {
            if (other === this || !other.alive || other.role === 'impostor') continue;

            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist > this.killRange) continue;

            const score = this.assessKillScore(other, allBots);

            // If AI is connected, let it make the final call if the score is somewhat decent
            if (isAIConnected() && score >= 0.4) {
                const aiDecision = await this.evaluateKillWithAI(other, allBots, gameState);
                if (aiDecision === true) {
                    this.performKill(other, gameState);
                    return;
                } else if (aiDecision === false) {
                    continue; // AI said wait
                }
            }

            // Fallback/standard logic
            if (score >= 0.6) {
                this.performKill(other, gameState);
                return;
            }
        }
    }

    performKill(victim, gameState) {
        // Count players in this room for stack kill detection
        const allBots = gameState.bots;
        const killRoom = this.currentRoom;
        const playersInRoom = allBots.filter(b => b.alive && getRoomAt(b.x, b.y) === killRoom);
        const isStackKill = playersInRoom.length >= 5;

        victim.die(victim.x, victim.y, gameState);
        victim.stackKill = isStackKill; // Tag victim with stack kill flag
        this.killTimer = this.killCooldownMax;
        this.targetVictim = null;
        this.kills.push({ victim: victim.name, victimId: victim.id, room: this.currentRoom, time: gameState.gameTime, stackKill: isStackKill });

        // NEW: Track the last kill victim ID
        this.lastKillVictimId = victim.id;

        // NEW: 80% chance to have 10 second self-report cooldown, 20% chance to report instantly
        if (Math.random() < 0.8) {
            this.selfReportCooldown = 10000; // 10 seconds cooldown
        } else {
            this.selfReportCooldown = 0; // Can self-report instantly
        }

        // Check for witnesses — stack kill logic!
        for (const bot of allBots) {
            if (bot === this || bot === victim || !bot.alive) continue;

            const dist = Math.hypot(bot.x - this.x, bot.y - this.y);
            if (dist < bot.visionRadius) {
                if (bot.role === 'crewmate') {
                    if (isStackKill) {
                        // Stack kill: witness saw SOMEONE die but can't identify killer
                        bot.sawStackKill = { victim: victim, room: killRoom };
                        console.log(`[STACK KILL] ${bot.name} witnessed a stack kill but can't identify the killer`);
                    } else {
                        bot.witnessKill(this, victim);
                    }
                }
            }
        }

        if (isStackKill) {
            console.log(`[STACK KILL] Kill in ${killRoom} with ${playersInRoom.length} players — witnesses can't identify killer!`);
        }

        // Remember a fake alibi room for this kill
        const adjRooms = ADJACENT_ROOMS[this.currentRoom];
        this.fakeAlibiRoom = adjRooms ? adjRooms[Math.floor(Math.random() * adjRooms.length)] : this.currentRoom;

        gameState.onKill(this, victim);

        // Viper effect
        if (this.extraRole === 'viper') {
            gameState.bodyTimers[victim.id] = 20000;
        }

        // Escape: vent if possible, otherwise walk away fast
        if (Math.random() < 0.65) {
            this.tryVent();
        } else {
            this.wanderToRandomRoom();
        }
    }

    tryVent() {
        for (const [ventId, vent] of Object.entries(VENTS)) {
            if (vent.room === this.currentRoom) {
                const dist = Math.hypot(vent.x - this.x, vent.y - this.y);
                if (dist < 100) {
                    this.enterVent(ventId);
                    return;
                }
            }
        }
        this.wanderToRandomRoom();
    }

    enterVent(ventId) {
        this.isVenting = true;
        this.currentVent = ventId;
        this.ventTimer = 3000 + Math.random() * 5000;
    }

    exitVent() {
        const vent = VENTS[this.currentVent];
        if (vent && vent.connections.length > 0) {
            const destVentId = vent.connections[Math.floor(Math.random() * vent.connections.length)];
            const destVent = VENTS[destVentId];
            if (destVent) {
                this.x = destVent.x;
                this.y = destVent.y;
            }
        }
        this.isVenting = false;
        this.currentVent = null;
        this.state = 'idle';
        this.idleTimer = 0;
    }

    goFakeTask() {
        const taskStep = this.getCurrentTaskStep();
        if (taskStep) {
            this.navigateToRoom(taskStep.room);
            this.fakingTask = true;
        } else {
            this.wanderToRandomRoom();
        }
    }

    handleFakeTask(dt) {
        this.taskProgress += dt;
        if (this.taskProgress >= this.taskDuration) {
            this.taskProgress = 0;
            this.fakingTask = false;
            this.state = 'idle';
            this.idleTimer = 0;

            const task = this.tasks[this.currentTaskIndex];
            if (task) {
                this.currentStepIndex++;
                if (this.currentStepIndex >= task.steps.length) {
                    this.currentTaskIndex++;
                    this.currentStepIndex = 0;
                }
            }
        }
    }

    onArrivedAtDestination() {
        if (this.fakingTask) {
            const taskStep = this.getCurrentTaskStep();
            if (taskStep && this.currentRoom === taskStep.room) {
                this.state = 'doing_task';
                this.taskProgress = 0;
                this.taskDuration = taskStep.task.duration;
            } else {
                this.state = 'idle';
                this.idleTimer = 0;
            }
        } else {
            this.state = 'idle';
            this.idleTimer = 0;
        }
    }

    trySabotage(gameState) {
        if (gameState.activeSabotage) return;
        const sabotages = ['lights', 'o2', 'reactor', 'comms'];
        const choice = sabotages[Math.floor(Math.random() * sabotages.length)];
        gameState.startSabotage(choice, this);
        this.sabotageCooldown = 30000;
    }

    // NEW: Override checkForBodies to handle self-report cooldown
    checkForBodies(allBots, gameState) {
        // Check if we witnessed a kill (same as parent)
        if (this.sawKill && !gameState.reportedBodies.has(this.sawKill.victim.id)) {
            const dist = Math.hypot(this.sawKill.victim.x - this.x, this.sawKill.victim.y - this.y);
            if (dist < 250) {
                gameState.reportBody(this, this.sawKill.victim);
                return;
            }
        }

        for (const other of allBots) {
            if (other === this || other.alive || !other.deathPos) continue;
            if (Date.now() - other.deathTime < 600) continue;

            const dist = Math.hypot(other.deathPos.x - this.x, other.deathPos.y - this.y);
            if (dist < this.visionRadius && !gameState.reportedBodies.has(other.id)) {
                this.sawBody = {
                    color: other.color,
                    room: getRoomAt(other.deathPos.x, other.deathPos.y) || 'unknown'
                };

                // Check if this is our own kill
                const isOurKill = this.kills.some(k => k.victimId === other.id);

                if (isOurKill) {
                    // Self-report logic: only report if cooldown is done
                    if (this.selfReportCooldown <= 0) {
                        // Can now self-report
                        gameState.reportBody(this, other);
                        return;
                    }
                    // Otherwise, don't report our own kill yet (cooldown active)
                } else {
                    // Not our kill - report it for cover
                    gameState.reportBody(this, other);
                    return;
                }
            }
        }
    }

    resetForRound() {
        super.resetForRound();
        this.killTimer = 15000; // 15s cooldown after meeting
        this.isVenting = false;
        this.currentVent = null;
        this.targetVictim = null;
        this.fakingTask = false;

        // NEW: Reset self-report cooldown
        this.selfReportCooldown = 0;
        this.lastKillVictimId = null;
        this.aiDecisionCooldown = 0;
    }

    // Override knowledge summary for meetings — impostor lies
    getKnowledgeSummary(allBots) {
        const lines = [];

        // Lie about location if we killed recently
        const alibiRoom = this.fakeAlibiRoom || this.currentRoom;
        lines.push(`I claim I was in ${ROOMS[alibiRoom]?.name || alibiRoom}`);

        const taskStep = this.getCurrentTaskStep();
        if (taskStep) {
            lines.push(`"doing" ${taskStep.task.name}`);
        }

        // Impostor might have real alibi partners — use them
        if (this.clearList.length > 0) {
            const names = this.clearList.map(c => c.charAt(0).toUpperCase() + c.slice(1));
            lines.push(`alibi with ${names.join(' and ')}`);
        }

        // Pick a random crewmate to throw under the bus
        const crewmates = allBots.filter(b => b.alive && b.role === 'crewmate' && b !== this);
        if (crewmates.length > 0) {
            const scapegoat = crewmates[Math.floor(Math.random() * crewmates.length)];
            lines.push(`scapegoat: ${scapegoat.name}`);
        }

        return lines;
    }

    // AI-driven destination choice using Gemini
    async chooseDestinationAI(allBots, gameState) {
        this.aiDecisionCooldown = 15000; // 15s cooldown between AI decisions

        const roomList = Object.keys(ROOMS).map(r => ROOMS[r].name).join(', ');
        const aliveCount = allBots.filter(b => b.alive).length;
        const myRoom = roomName(this.currentRoom);

        // Build a summary of where players are
        const roomCounts = {};
        allBots.filter(b => b.alive).forEach(b => {
            const room = getRoomAt(b.x, b.y) || 'unknown';
            roomCounts[room] = (roomCounts[room] || 0) + 1;
        });
        const crowdInfo = Object.entries(roomCounts)
            .map(([r, c]) => `${roomName(r)}: ${c} players`)
            .join(', ');

        const prompt = `You are the Impostor in Among Us on The Skeld.
You are currently in ${myRoom}. ${aliveCount} players are alive.
Kill cooldown: ${this.killTimer <= 0 ? 'READY' : Math.ceil(this.killTimer / 1000) + 's remaining'}.
Player distribution: ${crowdInfo}.

Where should I go next? Pick a room to move to that gives me the best chance to:
1. Find an isolated target if my kill is ready
2. Blend in with crewmates if my kill isn't ready
3. Avoid suspicion

Available rooms: ${roomList}

Respond with ONLY the room name. Nothing else.`;

        try {
            const result = await geminiChatStructured(prompt, 'Respond with ONLY a room name from Among Us The Skeld. No other text.');
            if (result) {
                const targetRoom = Object.keys(ROOMS).find(r =>
                    ROOMS[r].name.toLowerCase() === result.toLowerCase() ||
                    r.toLowerCase() === result.toLowerCase()
                );
                if (targetRoom && targetRoom !== this.currentRoom) {
                    console.log(`[AI IMPOSTOR] ${this.name} AI chose to go to ${roomName(targetRoom)}`);
                    this.navigateToRoom(targetRoom);
                }
            }
        } catch (err) {
            console.warn(`[AI IMPOSTOR] ${this.name} AI decision failed:`, err);
        }
    }

    // AI-driven kill decision using Gemini
    async evaluateKillWithAI(target, allBots, gameState) {
        const witnesses = allBots.filter(b => b !== this && b !== target && b.alive && Math.hypot(b.x - target.x, b.y - target.y) < 280);
        const playersInRoom = allBots.filter(b => b.alive && getRoomAt(b.x, b.y) === this.currentRoom);

        const prompt = `You are the Impostor in Among Us. Should I kill ${target.name} right now?
My room: ${roomName(this.currentRoom)}
Players near target: ${witnesses.length}
Players in room: ${playersInRoom.length}
${playersInRoom.length >= 5 ? 'WARNING: This would be a STACK KILL (5+ players) — witnesses wont be able to identify the killer!' : ''}
Nearby vent available: ${this.hasVentNearby() ? 'YES' : 'NO'}

Respond with ONLY "kill" or "wait". Nothing else.`;

        try {
            const result = await geminiChatStructured(prompt, 'Respond with ONLY "kill" or "wait". No other text.');
            return result && result.toLowerCase().includes('kill');
        } catch (err) {
            return null; // Fall back to normal logic
        }
    }

    hasVentNearby() {
        for (const [ventId, vent] of Object.entries(VENTS)) {
            if (vent.room === this.currentRoom) {
                const dist = Math.hypot(vent.x - this.x, vent.y - this.y);
                if (dist < 120) return true;
            }
        }
        return false;
    }
}