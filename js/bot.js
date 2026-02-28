// bot.js — Bot class with AI state machine, alibi tracking, smart task selection
// v4.0 - AI-Powered Movement via puter.com

class Bot {
    constructor(id, color, role) {
        this.id = id;
        this.color = color;
        this.name = color.charAt(0).toUpperCase() + color.slice(1);
        this.role = role; // 'crewmate' or 'impostor'
        this.alive = true;
        this.x = 1450;
        this.y = 275;
        this.speed = 1.8;
        this.direction = 1; // 1 = right, -1 = left
        this.frame = 0;
        this.frameTimer = 0;
        this.state = 'idle'; // idle, moving, doing_task, waiting, dead
        this.tasks = [];
        this.currentTaskIndex = 0;
        this.currentStepIndex = 0;
        this.completedSteps = 0;
        this.taskProgress = 0;
        this.taskDuration = 0;
        this.path = [];
        this.pathIndex = 0;
        this.idleTimer = 0;
        this.waitTimer = 0;
        this.currentRoom = 'cafeteria';
        this.visionRadius = 200;
        this.deathPos = null;
        this.deathTime = 0;
        this.killCooldown = 0;
        this.isPlayer = false;

        // --- Alibi & memory system ---
        this.companions = {};
        this.recentSightings = [];
        this.sawBody = null;
        this.suspicions = {};
        this.clearList = [];
        this.meetingMemory = [];
        this.personality = {
            talkativeness: 0.3 + Math.random() * 0.6,
            paranoia: 0.1 + Math.random() * 0.5,
            confidence: 0.3 + Math.random() * 0.5,
            loyalty: 0.2 + Math.random() * 0.6,
        };

        // Social Commands
        this.isFollowingPlayer = false;
        this.followingBot = null;
        this.campRoom = null;

        // Speech bubbles
        this.currentSpeech = null;
        this.speechTimer = 0;

        // Alibi Snapshots for meetings
        this.snapshottedRoom = null;
        this.snapshottedCompanions = [];

        this.extraRole = null;
        this.vitalsCooldown = 0;
        this.locationHistory = [];
        this.lastActualLocation = 'cafeteria';

        // NEW: AI movement tracking
        this.hasVisitedFirstWaypoint = false; // Track if first random waypoint is done
        this.aiMovementCooldown = 0;          // Prevent spamming AI calls
        this.aiMovementPending = false;       // Guard against concurrent AI calls
        this.lastAIDecisionRoom = null;       // What room AI last chose
        this.aiDecisionHistory = [];          // Track AI decisions for smarter choices
        this.movementsSinceAI = 0;            // Count moves since last AI decision

        this.trackedTarget = null; // For Tracker role
    }

    // Smart task assignment — takes all bots to avoid overlap
    assignTasksSmart(allBots) {
        if (this.role === 'crewmate' || this.role === 'impostor') {
            const taskCounts = {};
            for (const bot of allBots) {
                if (bot === this) continue;
                for (const t of bot.tasks) {
                    taskCounts[t.id] = (taskCounts[t.id] || 0) + 1;
                }
            }

            const assigned = [];

            const common = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.COMMON);
            assigned.push(...common);

            const shorts = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.SHORT);
            const sortedShorts = [...shorts].sort((a, b) =>
                (taskCounts[a.id] || 0) - (taskCounts[b.id] || 0) + (Math.random() - 0.5) * 2
            );
            const shortCount = 2 + Math.floor(Math.random() * 2);
            assigned.push(...sortedShorts.slice(0, shortCount));

            const longs = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.LONG);
            const sortedLongs = [...longs].sort((a, b) =>
                (taskCounts[a.id] || 0) - (taskCounts[b.id] || 0) + (Math.random() - 0.5) * 2
            );
            assigned.push(sortedLongs[0]);

            this.tasks = assigned;
        }
        this.currentTaskIndex = 0;
        this.currentStepIndex = 0;

        // NEW: Reset AI movement state on task assignment
        this.hasVisitedFirstWaypoint = false;
        this.aiMovementCooldown = 0;
        this.aiMovementPending = false;
        this.lastAIDecisionRoom = null;
        this.aiDecisionHistory = [];
        this.movementsSinceAI = 0;
    }

    // Legacy fallback
    assignTasks() {
        this.assignTasksSmart([]);
    }

    getCurrentTaskStep() {
        if (this.currentTaskIndex >= this.tasks.length) return null;
        const task = this.tasks[this.currentTaskIndex];
        if (this.currentStepIndex >= task.steps.length) return null;
        return {
            task: task,
            step: task.steps[this.currentStepIndex],
            room: task.steps[this.currentStepIndex].room
        };
    }

    update(dt, allBots, gameState) {
        if (!this.alive && this.state !== 'dead') return;
        if (gameState.phase === 'meeting') return;

        // Player Control Override
        if (this.isPlayer && this.alive) {
            this.currentRoom = getRoomAt(this.x, this.y) || this.currentRoom;
            this.updateSightingsAndAlibis(allBots);

            if (this.state === 'moving') {
                this.frameTimer += dt;
                if (this.frameTimer > 150) {
                    this.frame++;
                    this.frameTimer = 0;
                }
            }
            return;
        }

        this.frameTimer += dt;
        if (this.frameTimer > 150) {
            this.frame++;
            this.frameTimer = 0;
        }

        this.currentRoom = getRoomAt(this.x, this.y) || this.currentRoom;
        if (this.currentRoom !== 'hallway' && !this.currentRoom.startsWith('Hallway')) {
            this.lastActualLocation = this.currentRoom;
        }
        this.updateSightingsAndAlibis(allBots);

        if (this.vitalsCooldown > 0) this.vitalsCooldown -= dt;

        // NEW: Tick down AI movement cooldown
        if (this.aiMovementCooldown > 0) this.aiMovementCooldown -= dt;

        // Detective: track movement
        if (this.extraRole === 'detective') {
            const currentRoomName = ROOMS[this.currentRoom]?.name || this.currentRoom;
            if (this.locationHistory.length === 0 || this.locationHistory[0].room !== currentRoomName) {
                this.locationHistory.unshift({ room: currentRoomName, time: Date.now() });
                if (this.locationHistory.length > 5) this.locationHistory.pop();
            }
        }

        // Social AI Commands
        this.handleSocialAI(dt, allBots, gameState);

        switch (this.state) {
            case 'idle':
                this.handleIdle(dt, allBots, gameState);
                break;
            case 'moving':
                this.handleMoving(dt);
                break;
            case 'doing_task':
                this.handleDoingTask(dt, gameState);
                break;
            case 'waiting':
                this.handleWaiting(dt);
                break;
        }

        // Only ALIVE players can check for bodies
        if (this.alive) {
            if (this.role === 'crewmate' || Math.random() < 0.3) {
                this.checkForBodies(allBots, gameState);
            }
        }
    }

    handleSocialAI(dt, allBots, gameState) {
        if (!this.alive || this.isPlayer) return;

        if (this.isFollowingPlayer && gameState.player && gameState.player.alive) {
            const dist = Math.hypot(this.x - gameState.player.x, this.y - gameState.player.y);
            if (dist > 150 || (dist > 80 && (this.state !== 'moving' || Math.random() < 0.02))) {
                this.navigateToRoom(null, gameState.player.x, gameState.player.y);
            }
            if (dist < 60 && this.state === 'moving' && (!this.path || this.pathIndex >= this.path.length - 1)) {
                this.state = 'idle';
                this.path = [];
            }
        } else if (this.followingBot && this.followingBot.alive) {
            const dist = Math.hypot(this.x - this.followingBot.x, this.y - this.followingBot.y);
            if (dist > 150 || (dist > 80 && (this.state !== 'moving' || Math.random() < 0.02))) {
                this.navigateToRoom(null, this.followingBot.x, this.followingBot.y);
            }
            if (dist < 60 && this.state === 'moving' && (!this.path || this.pathIndex >= this.path.length - 1)) {
                this.state = 'idle';
                this.path = [];
            }
        } else if (this.campRoom) {
            const currentRoom = getRoomAt(this.x, this.y);
            if (currentRoom !== this.campRoom) {
                if (this.state !== 'moving' || Math.random() < 0.02) {
                    this.navigateToRoom(this.campRoom);
                }
            } else if (this.state === 'moving' && (!this.path || this.pathIndex >= this.path.length - 1)) {
                this.state = 'idle';
                this.path = [];
            }
        }
    }

    updateSightingsAndAlibis(allBots) {
        const now = Date.now();

        for (const color of Object.keys(this.companions)) {
            if (now - this.companions[color].lastSeen > 5000) {
                delete this.companions[color];
            }
        }

        for (const other of allBots) {
            if (other === this || !other.alive) continue;
            if (other instanceof Impostor && other.isPhantom) continue;

            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < this.visionRadius) {
                const colorToRecord = (other instanceof Impostor && other.isShifted) ? other.shiftedColor : other.color;
                const roomName = other.currentRoom;
                let activity = (other.state === 'doing_task') ? 'task' : (other.state === 'idle' ? 'idle' : 'moving');

                const existing = this.recentSightings.find(s => s.color === colorToRecord);
                if (existing) {
                    existing.room = roomName;
                    existing.time = now;
                    existing.activity = activity;
                } else {
                    this.recentSightings.push({
                        color: colorToRecord,
                        room: roomName,
                        time: now,
                        activity: activity,
                    });
                }
            }
        }

        this.recentSightings = this.recentSightings.filter(s => now - s.time < 45000);

        this.clearList = [];
        for (const [color, data] of Object.entries(this.companions)) {
            const duration = data.lastSeen - data.startTime;
            if (duration > 8000) {
                this.clearList.push(color);
            }
        }
    }

    witnessKill(killer, victim) {
        if (this.role === 'impostor') return;

        this.sawKill = {
            killer: killer,
            victim: victim,
            time: Date.now(),
            room: this.currentRoom
        };

        this.state = 'moving';
        this.isReportingWitness = true;

        const path = findPathBetweenPoints(this.x, this.y, victim.x, victim.y);
        if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
        }
    }

    checkForBodies(allBots, gameState) {
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

                if (Math.random() < 0.95 || this.role === 'crewmate' || this.isReportingWitness) {
                    gameState.reportBody(this, other);
                    return;
                }
            }
        }
    }

    handleIdle(dt, allBots, gameState) {
        this.idleTimer += dt;

        if (this.idleTimer > 800 + Math.random() * 2000) {
            this.idleTimer = 0;

            if (this.isFollowingPlayer || this.followingBot) return;
            if (this.campRoom) {
                this.navigateToRoom(this.campRoom);
                return;
            }

            // Scientist check vitals
            if (this.extraRole === 'scientist' && this.vitalsCooldown <= 0) {
                this.checkVitals(allBots, gameState);
            }

            const taskStep = this.getCurrentTaskStep();

            // NEW: AI-powered movement decision logic
            if (!this.hasVisitedFirstWaypoint) {
                // First move is always random/task-based (original behavior)
                if (taskStep) {
                    this.navigateToRoom(taskStep.room);
                } else {
                    this.wanderToRandomRoom();
                }
                // Mark first waypoint as visited once we start moving
                this.hasVisitedFirstWaypoint = true;
                this.movementsSinceAI = 0;
            } else {
                // After first waypoint: use AI to decide next move
                this.movementsSinceAI++;

                // Use AI every time after first waypoint, with cooldown to prevent spam
                if (this.aiMovementCooldown <= 0 && !this.aiMovementPending) {
                    this.decideNextMoveAI(allBots, gameState);
                } else {
                    // Fallback while AI is on cooldown or pending
                    if (taskStep) {
                        this.navigateToRoom(taskStep.room);
                    } else {
                        this.wanderToRandomRoom();
                    }
                }
            }
        }
    }

    checkVitals(allBots, gameState) {
        this.vitalsCooldown = 10000;
        const deadBot = allBots.find(b => !b.alive && !gameState.reportedBodies.has(b.id));
        if (deadBot) {
            console.log(`${this.name} (Scientist) detected a death!`);
            this.currentSpeech = "I sense someone is dead...";
            this.speechTimer = 3000;
            this.wanderToRandomRoom();
        }
    }

    async decideNextMoveAI(allBots, gameState) {
        if (!window.puter || !window.puter.ai) {
            // No AI available, fall back to task/random
            this.decideNextMoveFallback(allBots, gameState);
            return;
        }

        if (this.aiMovementPending) return; // Already waiting for AI response

        this.aiMovementPending = true;
        this.aiMovementCooldown = 8000 + Math.random() * 4000; // 8-12s cooldown between AI calls

        const rooms = Object.keys(ROOMS);
        const roomNames = rooms.map(r => ROOMS[r].name);
        const currentRoomName = ROOMS[this.currentRoom]?.name || this.currentRoom;

        // Build nearby players info
        const nearbyPlayers = allBots
            .filter(b => b !== this && b.alive && Math.hypot(b.x - this.x, b.y - this.y) < this.visionRadius)
            .map(b => `${b.name} (${b.state === 'doing_task' ? 'doing a task' : b.state})`);

        // Build recent sightings summary
        const recentSightingSummary = this.recentSightings
            .slice(0, 5)
            .map(s => {
                const name = s.color.charAt(0).toUpperCase() + s.color.slice(1);
                const room = ROOMS[s.room]?.name || s.room;
                return `${name} was in ${room} (${s.activity})`;
            });

        // Build suspicion info
        const susList = Object.entries(this.suspicions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([color, level]) => `${color.charAt(0).toUpperCase() + color.slice(1)} (suspicion: ${level.toFixed(1)})`);

        // Build task info
        const taskStep = this.getCurrentTaskStep();
        let taskInfo = 'All tasks complete';
        if (taskStep) {
            const taskRoom = ROOMS[taskStep.room]?.name || taskStep.room;
            taskInfo = `Next task: "${taskStep.task.name}" in ${taskRoom}`;
        }

        // Build recent AI decision history
        const recentDecisions = this.aiDecisionHistory
            .slice(-3)
            .map(d => d.room)
            .join(' → ');

        // Build alive players list
        const alivePlayers = allBots.filter(b => b.alive).map(b => b.name);

        // Build dead players (that this bot knows about)
        const knownDead = allBots
            .filter(b => !b.alive && this.recentSightings.some(s => s.color === b.color))
            .map(b => b.name);

        // Meeting history context (if available from gameState)
        let meetingContext = '';
        if (gameState.meeting && gameState.meeting.meetingHistory && gameState.meeting.meetingHistory.length > 0) {
            const lastMeeting = gameState.meeting.meetingHistory[gameState.meeting.meetingHistory.length - 1];
            meetingContext = `\nLast meeting: ${lastMeeting.type === 'body_report' ? `Body reported by ${lastMeeting.reporter}` : `Emergency meeting by ${lastMeeting.reporter}`}`;
            if (lastMeeting.ejected) {
                meetingContext += `. ${lastMeeting.ejected.name} was ejected (${lastMeeting.ejected.wasImpostor ? 'was Impostor' : 'was Innocent'}).`;
            }
            // Include key accusations from last meeting
            if (lastMeeting.accusations && lastMeeting.accusations.length > 0) {
                const relevantAcc = lastMeeting.accusations
                    .filter(a => a.accuser === this.name || a.target === this.name)
                    .slice(0, 3);
                if (relevantAcc.length > 0) {
                    meetingContext += '\nRelevant accusations from last meeting:';
                    for (const acc of relevantAcc) {
                        meetingContext += `\n  - ${acc.accuser} accused ${acc.target}`;
                    }
                }
            }
        }

        let prompt;

        if (this.role === 'impostor') {
            prompt = `You are "${this.name}" in Among Us. You are secretly the IMPOSTOR. You must act natural and not get caught.

Current Room: ${currentRoomName}
${taskInfo}
Players nearby right now: ${nearbyPlayers.length > 0 ? nearbyPlayers.join(', ') : 'Nobody — you are ALONE'}
Recent sightings: ${recentSightingSummary.length > 0 ? recentSightingSummary.join('; ') : 'None'}
Your recent movement: ${recentDecisions || 'Just started'}
Alive players: ${alivePlayers.join(', ')}
Known dead: ${knownDead.length > 0 ? knownDead.join(', ') : 'None'}${meetingContext}

Available rooms: ${roomNames.join(', ')}

As the IMPOSTOR, your strategy should be:
- Find isolated players to kill (rooms with only 1 other person)
- Avoid rooms with many people watching you
- Fake tasks by going to task rooms (but don't stay too long or people notice you not completing tasks)
- After a kill, move away from the body quickly to a different room
- If your kill cooldown is active, act natural and do fake tasks
- Vary your movement pattern so you don't look suspicious
- Consider avoiding players who accused you in past meetings
- If someone saw you near a body, avoid them

Where should you go next? Respond with ONLY the exact room name from the list. Nothing else.`;
        } else {
            prompt = `You are "${this.name}" in Among Us. You are a CREWMATE trying to complete tasks and find the impostor.

Current Room: ${currentRoomName}
${taskInfo}
Players nearby right now: ${nearbyPlayers.length > 0 ? nearbyPlayers.join(', ') : 'Nobody — you are ALONE'}
Recent sightings: ${recentSightingSummary.length > 0 ? recentSightingSummary.join('; ') : 'None'}
Suspicious players: ${susList.length > 0 ? susList.join(', ') : 'Nobody particularly suspicious'}
Your recent movement: ${recentDecisions || 'Just started'}
Alive players: ${alivePlayers.join(', ')}
Known dead: ${knownDead.length > 0 ? knownDead.join(', ') : 'None'}
Players you can vouch for (alibi): ${this.clearList.length > 0 ? this.clearList.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') : 'Nobody'}${meetingContext}

Available rooms: ${roomNames.join(', ')}

As a CREWMATE, your strategy should be:
- Go to your task room if you have tasks to do (PRIORITY)
- If no tasks, patrol rooms to watch for suspicious behavior
- Stay near other crewmates for safety (buddy system)
- If you're alone, move to a busier room
- If you suspect someone, try to follow them or stay where you can watch them
- Avoid being alone in remote rooms (you could get killed)
- If someone was ejected as innocent last meeting, the person who accused them might be the real impostor — watch them
- Vary your patrol route

Where should you go next? Respond with ONLY the exact room name from the list. Nothing else.`;
        }

        try {
            const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });
            let roomName = (response && typeof response === 'object' && response.message)
                ? response.message.content.trim()
                : (typeof response === 'string' ? response.trim() : '');

            // Clean up response
            roomName = roomName.replace(/[."'*]/g, '').trim();

            // Try exact match first
            let roomId = rooms.find(r => ROOMS[r].name.toLowerCase() === roomName.toLowerCase());

            // Fuzzy match if exact fails
            if (!roomId) {
                roomId = rooms.find(r =>
                    roomName.toLowerCase().includes(ROOMS[r].name.toLowerCase()) ||
                    ROOMS[r].name.toLowerCase().includes(roomName.toLowerCase())
                );
            }

            // Match by room key if name match fails
            if (!roomId) {
                roomId = rooms.find(r => r.toLowerCase() === roomName.toLowerCase().replace(/\s+/g, ''));
            }

            if (roomId) {
                console.log(`[AI MOVE] ${this.name} (${this.role}) decided: ${ROOMS[roomId].name} (from ${currentRoomName})`);

                // Record decision
                this.aiDecisionHistory.push({
                    room: ROOMS[roomId].name,
                    from: currentRoomName,
                    time: Date.now(),
                    reason: this.role
                });
                if (this.aiDecisionHistory.length > 10) this.aiDecisionHistory.shift();

                this.lastAIDecisionRoom = roomId;
                this.movementsSinceAI = 0;
                this.navigateToRoom(roomId);
            } else {
                console.warn(`[AI MOVE] ${this.name} got invalid room: "${roomName}", falling back`);
                this.decideNextMoveFallback(allBots, gameState);
            }
        } catch (err) {
            console.warn(`[AI MOVE ERROR] ${this.name}:`, err);
            this.decideNextMoveFallback(allBots, gameState);
        } finally {
            this.aiMovementPending = false;
        }
    }

    // Fallback when AI is unavailable or fails
    decideNextMoveFallback(allBots, gameState) {
        const taskStep = this.getCurrentTaskStep();
        if (taskStep) {
            this.navigateToRoom(taskStep.room);
        } else {
            this.wanderToRandomRoom();
        }
    }

    navigateToRoom(roomId, targetX = null, targetY = null) {
        let tx, ty;
        if (roomId) {
            const room = ROOMS[roomId];
            if (!room) {
                this.wanderToRandomRoom();
                return;
            }
            tx = room.center.x + (Math.random() - 0.5) * 60;
            ty = room.center.y + (Math.random() - 0.5) * 60;
        } else {
            tx = targetX;
            ty = targetY;
        }

        const path = findPathBetweenPoints(this.x, this.y, tx, ty);
        if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
            this.state = 'moving';
        }
    }

    wanderToRandomRoom() {
        const rooms = Object.keys(ROOMS);
        const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
        this.navigateToRoom(randomRoom);
    }

    handleMoving(dt) {
        if (this.pathIndex >= this.path.length) {
            this.state = 'idle';
            this.onArrivedAtDestination();
            return;
        }

        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.pathIndex++;
            return;
        }

        const moveX = (dx / dist) * this.speed;
        const moveY = (dy / dist) * this.speed;

        const nextX = this.x + moveX;
        const nextY = this.y + moveY;

        const canMoveX = getRoomAt(nextX, this.y) || getCorridorAt(nextX, this.y);
        const canMoveY = getRoomAt(this.x, nextY) || getCorridorAt(this.x, nextY);
        const canMoveBoth = getRoomAt(nextX, nextY) || getCorridorAt(nextX, nextY);

        if (canMoveBoth) {
            this.x = nextX;
            this.y = nextY;
        } else if (canMoveX) {
            this.x = nextX;
        } else if (canMoveY) {
            this.y = nextY;
        } else {
            this.state = 'idle';
            this.path = [];
        }

        if (moveX !== 0) this.direction = moveX > 0 ? 1 : -1;
    }

    onArrivedAtDestination() {
        const taskStep = this.getCurrentTaskStep();
        if (taskStep && this.currentRoom === taskStep.room) {
            this.startTask(taskStep);
        } else if (taskStep) {
            // NEW: If we arrived at AI-chosen room but task is elsewhere,
            // let idle handler decide next (AI will be called again)
            this.idleTimer = 0;
        } else {
            this.idleTimer = 0;
        }
    }

    startTask(taskStep) {
        this.state = 'doing_task';
        this.taskProgress = 0;
        this.taskDuration = taskStep.task.duration;
    }

    handleDoingTask(dt, gameState) {
        this.taskProgress += dt;
        if (this.taskProgress >= this.taskDuration) {
            this.completeTaskStep(gameState);
        }
    }

    completeTaskStep(gameState) {
        const task = this.tasks[this.currentTaskIndex];
        if (this.role === 'crewmate') {
            this.completedSteps++;
            gameState.onTaskStepCompleted();
        }
        this.currentStepIndex++;
        if (this.currentStepIndex >= task.steps.length) {
            this.currentTaskIndex++;
            this.currentStepIndex = 0;
        }

        if (task.waitBetweenSteps && this.currentStepIndex > 0 && this.currentStepIndex < task.steps.length) {
            this.state = 'waiting';
            this.waitTimer = task.waitBetweenSteps;
        } else {
            this.state = 'idle';
            this.idleTimer = 0;
        }
    }

    handleWaiting(dt) {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) {
            this.state = 'idle';
            this.idleTimer = 0;
        }
    }

    die(x, y, gameState) {
        this.alive = false;
        this.state = 'dead';
        this.deathPos = { x, y };
        this.deathTime = Date.now();

        if (this.extraRole === 'noisemaker' && gameState) {
            gameState.triggerNoisemakerAlert(this.deathPos);
        }
    }

    resetForRound() {
        if (this.alive) {
            this.state = 'idle';
            this.idleTimer = 0;
            this.path = [];
            this.pathIndex = 0;
            this.sawBody = null;
            this.sawKill = null;
            this.sawStackKill = null;
            this.x = ROOMS.cafeteria.center.x + (Math.random() - 0.5) * 100;
            this.y = ROOMS.cafeteria.center.y + (Math.random() - 0.5) * 80;
            this.isFollowingPlayer = false;
            this.followingBot = null;
            this.campRoom = null;

            // NEW: Reset first waypoint flag so bots do one random move after meeting
            // then switch back to AI-driven movement
            this.hasVisitedFirstWaypoint = false;
            this.aiMovementCooldown = 2000 + Math.random() * 3000; // Stagger AI calls after meeting
            this.aiMovementPending = false;
        } else {
            this.deathPos = null;
        }
        this.deathTime = 0;

        // Tracker: pick a target
        if (this.alive && this.extraRole === 'tracker' && typeof gameState !== 'undefined' && gameState.bots) {
            const others = gameState.bots.filter(b => b !== this && b.alive);
            if (others.length > 0) {
                this.trackedTarget = others[Math.floor(Math.random() * others.length)];
                console.log(`${this.name} (Tracker) is now tracking ${this.trackedTarget.name}`);
            }
        }
    }

    getKnowledgeSummary(allBots) {
        const lines = [];
        lines.push(`I was in ${ROOMS[this.currentRoom]?.name || this.currentRoom}`);

        const taskStep = this.getCurrentTaskStep();
        if (taskStep) {
            lines.push(`doing ${taskStep.task.name}`);
        }

        if (this.clearList.length > 0) {
            const names = this.clearList.map(c => c.charAt(0).toUpperCase() + c.slice(1));
            lines.push(`alibi with ${names.join(' and ')}`);
        }

        if (this.recentSightings.length > 0) {
            for (const s of this.recentSightings.slice(0, 3)) {
                const name = s.color.charAt(0).toUpperCase() + s.color.slice(1);
                const room = ROOMS[s.room]?.name || s.room;
                lines.push(`saw ${name} in ${room} ${s.activity}`);
            }
        }

        // NEW: Include recent AI movement decisions in knowledge
        if (this.aiDecisionHistory.length > 0) {
            const recent = this.aiDecisionHistory.slice(-2);
            for (const d of recent) {
                lines.push(`went from ${d.from} to ${d.room}`);
            }
        }

        return lines;
    }

    snapshotAlibi() {
        this.snapshottedRoom = this.currentRoom || 'unknown';
        this.snapshottedCompanions = [];

        const now = Date.now();
        for (const [color, data] of Object.entries(this.companions)) {
            if (now - data.startTime > 3000) {
                this.snapshottedCompanions.push(color.charAt(0).toUpperCase() + color.slice(1));
            }
        }
    }
}