// game.js — High-level game state
// v3.0 - Cache Buster: 2026-02-14-12-25

class GameState {
    constructor() {
        this.phase = 'lobby'; // lobby, starting, playing, meeting, gameover
        this.bots = [];
        this.ghost = null;
        this.meetingSystem = new MeetingSystem();
        this.meetingSystem.gameStateRef = this;
        this.totalTaskSteps = 0;
        this.completedTaskSteps = 0;
        this.taskBarProgress = 0;
        this.meetingCooldown = 0;
        this.reportedBodies = new Set();
        this.bodyTimers = {}; // { botId: timeRemaining } for Viper kills
        this.killFeed = []
        this.startTimer = 5000;
        this.gameOverReason = '';
        this.winner = '';
        this.activeSabotage = null;
        this.sabotageTimer = 0;
        this.gameTime = 0;
        this.emergencyMeetingsLeft = 1;
        this.extraRolesEnabled = false;
        this.showVitals = false;
    }

    init(mode = 'spectate', forcedRole = null, extraRoles = false, extendedColors = false, forcedExtraRole = null) {
        this.gameMode = mode;
        this.extraRolesEnabled = extraRoles;
        this.extendedColorsEnabled = extendedColors;
        this.forcedExtraRole = forcedExtraRole;
        this.phase = 'lobby';
        this.bots = [];
        this.killFeed = [];
        this.completedTaskSteps = 0;
        this.reportedBodies = new Set();
        this.player = null;
        this.playerControls = null;
        this.showVitals = false;

        // Create bots (12 standard, 18 if extended colors)
        const colors = [...COLOR_NAMES];
        const botCount = this.extendedColorsEnabled ? colors.length : 12;
        const impostorCount = this.extendedColorsEnabled ? 3 : 2;

        const impostorIndices = [];
        while (impostorIndices.length < impostorCount) {
            const idx = Math.floor(Math.random() * botCount);
            if (!impostorIndices.includes(idx)) impostorIndices.push(idx);
        }

        for (let i = 0; i < botCount; i++) {
            const isImpostor = impostorIndices.includes(i);
            const bot = isImpostor
                ? new Impostor(i, colors[i])
                : new Bot(i, colors[i], 'crewmate');

            // Spread out starting positions in cafeteria
            const angle = (i / botCount) * Math.PI * 2;
            bot.x = ROOMS.cafeteria.center.x + Math.cos(angle) * 80;
            bot.y = ROOMS.cafeteria.center.y + Math.sin(angle) * 50;
            bot.assignTasks();
            bot.isPlayer = false; // Ensure explicit false at start
            this.bots.push(bot);
        }

        // Initial assignment logic moved down to ensure this.player is set first

        // Ghost player (always created for camera/spectator logic if needed, but if playing...)
        // Actually GhostPlayer controls camera. If playing, camera should follow PlayerBot.
        // We can reuse GhostPlayer for camera logic or just update renderer?
        // Renderer uses `game.ghost` to determine camera target.
        // If playing, we need to instruct Renderer or Ghost to follow player.

        if (mode === 'play') {
            // Hijack a bot with the requested role
            let playerBot;
            if (forcedRole) {
                const candidates = this.bots.filter(b => {
                    const isImp = b instanceof Impostor;
                    return (forcedRole === 'impostor') ? isImp : !isImp;
                });
                playerBot = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                playerBot = this.bots[Math.floor(Math.random() * this.bots.length)];
            }

            this.player = playerBot;
            this.playerControls = new PlayerControls(this);
            this.playerControls.setPlayerBot(this.player);

            // Disable Ghost inputs?
            // GhostPlayer handles inputs. If we have a player, we should disable Ghost?
            // Or just make Ghost follow player?
            this.ghost = new GhostPlayer(); // Keeping for compatibility
            this.ghost.target = this.player; // Hack: Make ghost follow player?
            // Ghost update logic follows WASD. We need to disable Ghost update if playing.
        } else {
            this.ghost = new GhostPlayer();
        }

        if (this.extraRolesEnabled) {
            this.assignExtraRoles();
        } else {
            // If global toggle is OFF, NO roles for anyone.
            this.bots.forEach(b => b.extraRole = null);
        }

        // Calculate total tasks
        this.totalTaskSteps = getTotalTaskSteps(this.bots);
        this.completedTaskSteps = 0;

        // Start countdown
        this.phase = 'starting';
        this.startTimer = 5000;
        this.meetingCooldown = 15000; // 15s cooldown at start
    }

    assignExtraRoles() {
        // 1. Assign Impostor roles
        if (this.extraRolesEnabled) {
            const impostors = this.bots.filter(b => b instanceof Impostor);
            const impRoles = ['viper', 'shapeshifter', 'phantom'];
            impostors.forEach(imp => {
                imp.extraRole = impRoles[Math.floor(Math.random() * impRoles.length)];
            });
        }

        // 2. Assign Crewmate roles
        const crewmates = this.bots.filter(b => !(b instanceof Impostor));
        const shuffledCrew = [...crewmates].sort(() => Math.random() - 0.5);

        // If player has a forced extra role, assign it first (ONLY if it matches their team)
        if (this.gameMode === 'play' && this.player && this.forcedExtraRole) {
            const isImp = this.player instanceof Impostor;
            const crewRoles = ['scientist', 'detective', 'noisemaker', 'tracker'];
            const impRoles = ['viper', 'shapeshifter', 'phantom'];

            const isCompatible = (crewRoles.includes(this.forcedExtraRole) && !isImp) ||
                (impRoles.includes(this.forcedExtraRole) && isImp);

            if (isCompatible) {
                this.player.extraRole = this.forcedExtraRole;
                // Remove player from shuffled crew to avoid double assignment or role swap
                const pIdx = shuffledCrew.indexOf(this.player);
                if (pIdx > -1) shuffledCrew.splice(pIdx, 1);
            } else {
                console.log(`Forced role ${this.forcedExtraRole} ignored: Incompatible with team.`);
            }
        }

        // Only assign random extra roles if global toggle is ON
        if (this.extraRolesEnabled) {
            const crewCount = this.extendedColorsEnabled ? 5 : 3;
            const crewRoles = ['scientist', 'detective', 'noisemaker', 'tracker'];
            for (let i = 0; i < Math.min(crewCount, shuffledCrew.length); i++) {
                // If they don't already have a forced role
                if (!shuffledCrew[i].extraRole) {
                    shuffledCrew[i].extraRole = crewRoles[Math.floor(Math.random() * crewRoles.length)];
                }
            }
        }
    }

    triggerNoisemakerAlert(body) {
        console.log("Noisemaker Alert! Everyone rushing to body.");
        this.noisemakerAlertBody = body;
        this.noisemakerAlertTimer = 10000; // Alert lasts 10s

        // Make all alive crewmates rush to the body
        for (const bot of this.bots) {
            if (bot.alive && bot.role === 'crewmate' && !bot.isPlayer) {
                bot.navigateToRoom(null, body.x, body.y);
                bot.currentSpeech = "I HEARD SOMETHING!";
                bot.speechTimer = 2000;
            }
        }
    }

    update(dt) {
        this.gameTime += dt;

        switch (this.phase) {
            case 'starting':
                this.startTimer -= dt;
                if (this.startTimer <= 0) {
                    this.phase = 'playing';
                    this.scatterBots();
                }
                break;

            case 'playing':
                this.meetingCooldown -= dt;

                // Update sabotage
                if (this.activeSabotage) {
                    this.sabotageTimer -= dt;
                    if (this.sabotageTimer <= 0) {
                        this.resolveSabotage();
                    }
                }

                // Update body timers for Viper
                for (const botId in this.bodyTimers) {
                    this.bodyTimers[botId] -= dt;
                    if (this.bodyTimers[botId] <= 0) {
                        delete this.bodyTimers[botId];
                        const bot = this.bots.find(b => b.id == botId);
                        if (bot) bot.deathPos = null; // Disappear
                        console.log(`Body of ${botId} disappeared (Viper)`);
                    }
                }

                // Update player controls if in play mode
                if (this.playerControls) {
                    this.playerControls.update(dt);
                }

                // Update all bots
                for (const bot of this.bots) {
                    bot.update(dt, this.bots, this);
                }

                // Update ghost
                this.ghost.update(dt);

                // Check for emergency meeting calls
                this.checkEmergencyButtonPress();

                // Check win conditions
                this.checkWinConditions();

                // Update noisemaker alert
                if (this.noisemakerAlertTimer > 0) {
                    this.noisemakerAlertTimer -= dt;
                    if (this.noisemakerAlertTimer <= 0) {
                        this.noisemakerAlertBody = null;
                    }
                }

                // Update task bar
                this.taskBarProgress = this.totalTaskSteps > 0
                    ? this.completedTaskSteps / this.totalTaskSteps
                    : 0;
                break;

            case 'meeting':
                this.meetingSystem.update(dt, this.bots, this);
                this.ghost.update(dt);
                if (this.meetingSystem.phase === 'none') {
                    this.phase = 'playing';
                    this.checkWinConditions();
                }
                break;

            case 'gameover':
                this.ghost.update(dt);
                break;
        }
    }

    checkEmergencyButtonPress() {
        // Random chance for a bot to press emergency button if they suspect someone
        if (this.meetingCooldown > 0 || this.emergencyMeetingsLeft <= 0) return;
        for (const bot of this.bots) {
            if (!bot.alive || bot.role === 'impostor') continue;
            if (bot.currentRoom === 'cafeteria' && Math.random() < 0.00005) {
                this.callEmergencyMeeting(bot);
                return;
            }
        }
    }

    reportBody(reporter, victim) {
        if (this.phase !== 'playing') return;
        this.reportedBodies.add(victim.id);
        this.phase = 'meeting';
        const bodyRoom = victim.deathPos ? getRoomAt(victim.deathPos.x, victim.deathPos.y) || 'unknown' : 'unknown';
        this.meetingSystem.startBodyReport(reporter, victim, bodyRoom);
    }

    doTask(bot, task) {
        if (!bot || !task) return;
        this.completedTaskSteps++;
        // Additional task logic could go here
    }

    callEmergencyMeeting(caller) {
        if (this.phase !== 'playing') return;
        this.emergencyMeetingsLeft--;
        this.phase = 'meeting';
        this.meetingSystem.startEmergencyMeeting(caller);
    }

    onTaskStepCompleted() {
        this.completedTaskSteps++;
    }

    onKill(killer, victim) {
        this.killFeed.push({
            killer: killer.name,
            victim: victim.name,
            time: this.gameTime,
            room: getRoomAt(victim.x, victim.y) || 'unknown'
        });

        if (victim === this.player) {
            // Player just died, become a free ghost
            if (this.ghost) {
                this.ghost.target = null;
                this.ghost.x = victim.x;
                this.ghost.y = victim.y;
            }
        }
    }

    onEjection(ejected) {
        if (ejected === this.player) {
            // Player just ejected, become a free ghost
            if (this.ghost) {
                this.ghost.target = null;
                this.ghost.x = ejected.x;
                this.ghost.y = ejected.y;
            }
        }
        // Check win conditions after ejection
        this.checkWinConditions();
    }

    checkWinConditions() {
        const aliveImpostors = this.bots.filter(b => b.alive && b.role === 'impostor').length;
        const aliveCrewmates = this.bots.filter(b => b.alive && b.role === 'crewmate').length;

        // Impostor win: impostors >= crewmates
        if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
            this.gameOver('impostors', 'Impostors Win! They outnumber the crew.');
            return;
        }

        // Crew win: all impostors ejected
        if (aliveImpostors === 0) {
            this.gameOver('crewmates', 'Crewmates Win! All impostors were found!');
            return;
        }

        // Crew win: all tasks completed
        if (this.taskBarProgress >= 1) {
            this.gameOver('crewmates', 'Crewmates Win! All tasks completed!');
            return;
        }
    }

    gameOver(winner, reason) {
        this.phase = 'gameover';
        this.winner = winner;
        this.gameOverReason = reason;
    }

    startSabotage(type, caller) {
        this.activeSabotage = type;
        this.sabotageTimer = 30000; // 30s to fix

        // Make crewmates rush to fix
        for (const bot of this.bots) {
            if (bot.alive && bot.role === 'crewmate' && Math.random() < 0.6) {
                switch (type) {
                    case 'o2':
                        bot.navigateToRoom('o2');
                        break;
                    case 'reactor':
                        bot.navigateToRoom('reactor');
                        break;
                    case 'lights':
                        bot.navigateToRoom('electrical');
                        break;
                    case 'comms':
                        bot.navigateToRoom('communications');
                        break;
                }
            }
        }
    }

    resolveSabotage() {
        // Auto-resolve sabotage (simplified)
        this.activeSabotage = null;
        this.sabotageTimer = 0;
    }

    getAliveCount() {
        return this.bots.filter(b => b.alive).length;
    }

    getImpostorNames() {
        return this.bots.filter(b => b.role === 'impostor').map(b => b.name);
    }

    restart() {
        this.init(this.gameMode);
    }

    scatterBots() {
        console.log("Scattering bots...");
        const aliveBots = this.bots.filter(b => b.alive && !b.isPlayer && b !== this.player);
        if (aliveBots.length === 0) return;

        // Shuffle waypoints to pick different ones
        const indices = Array.from({ length: WAYPOINTS.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // Assign each bot a unique waypoint
        aliveBots.forEach((bot, i) => {
            const wpIndex = indices[i % indices.length];
            const wp = WAYPOINTS[wpIndex];
            bot.navigateToRoom(null, wp.x, wp.y);
        });
    }
}
