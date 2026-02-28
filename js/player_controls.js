// player_controls.js — Handles player input for the "Play" mode (not spectate)

class PlayerControls {
    constructor(gameState) {
        this.gameState = gameState;
        this.playerBot = null;
        this.keys = {
            up: false, down: false, left: false, right: false
        };

        // Venting state
        this.isVenting = false;
        this.currentVentKey = null;

        // Bind input listeners
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        const btnKill = document.getElementById('btn-kill');
        const btnUse = document.getElementById('btn-use');
        const btnReport = document.getElementById('btn-report');

        if (btnKill) btnKill.addEventListener('click', () => this.tryKill());
        if (btnUse) btnUse.addEventListener('click', () => this.tryUse());
        if (btnReport) btnReport.addEventListener('click', () => this.tryReport());

        const btnVitals = document.getElementById('btn-vitals');
        if (btnVitals) btnVitals.addEventListener('click', () => this.tryVitals());
    }

    setPlayerBot(bot) {
        this.playerBot = bot;
        bot.isPlayer = true;
        // Update UI based on role
        const hud = document.getElementById('player-hud');
        if (hud) {
            hud.classList.remove('hidden');
            const btnKill = document.getElementById('btn-kill');
            if (bot.role !== 'impostor') {
                if (btnKill) btnKill.style.display = 'none';
            } else {
                if (btnKill) btnKill.style.display = 'block';
            }

            const btnVitals = document.getElementById('btn-vitals');
            if (btnVitals) {
                if (bot.extraRole) {
                    btnVitals.classList.remove('hidden');
                    if (bot.extraRole === 'scientist') btnVitals.textContent = 'VITALS';
                    else if (bot.extraRole === 'detective') btnVitals.textContent = 'HISTORY';
                    else if (bot.extraRole === 'shapeshifter') btnVitals.textContent = 'SHIFT';
                    else if (bot.extraRole === 'phantom') btnVitals.textContent = 'PHANTOM';
                    else btnVitals.classList.add('hidden');
                } else {
                    btnVitals.classList.add('hidden');
                }
            }
        }
    }

    handleKeyDown(e) {
        if (!this.playerBot || !this.playerBot.alive) return;
        // If chat input matches active element, ignore game controls
        if (document.activeElement === document.getElementById('chat-input-box')) return;

        const key = e.key.toLowerCase();

        // Venting controls (A/D to cycle)
        if (this.isVenting) {
            if (key === 'a') this.cycleVent(-1);
            if (key === 'd') this.cycleVent(1);
            if (key === 'e') this.tryUse();
            return;
        }

        switch (key) {
            case 'w': case 'arrowup': this.keys.up = true; break;
            case 's': case 'arrowdown': this.keys.down = true; break;
            case 'a': case 'arrowleft': this.keys.left = true; break;
            case 'd': case 'arrowright': this.keys.right = true; break;
            case 'q': this.tryKill(); break;
            case 'e': this.tryUse(); break;
            case 'r': this.tryReport(); break;
        }
    }

    handleKeyUp(e) {
        if (!this.playerBot) return;
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup': this.keys.up = false; break;
            case 's': case 'arrowdown': this.keys.down = false; break;
            case 'a': case 'arrowleft': this.keys.left = false; break;
            case 'd': case 'arrowright': this.keys.right = false; break;
        }
    }

    update(dt) {
        if (!this.playerBot || !this.playerBot.alive || this.gameState.phase !== 'playing') {
            if (this.playerBot && this.playerBot.x === 0 && this.playerBot.y === 0) {
                this.playerBot.x = 1450;
                this.playerBot.y = 275;
            }
            this.keys = { up: false, down: false, left: false, right: false };
            this.gameState.showVitals = false;
            return;
        }

        // Speed is 0 while venting
        if (this.isVenting) {
            this.playerBot.state = 'idle';
            return;
        }

        const speed = this.playerBot.speed * (this.playerBot.role === 'impostor' ? 1.1 : 1.0);
        let dx = 0;
        let dy = 0;

        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            const moveX = (dx / length) * speed * dt * 0.06;
            const moveY = (dy / length) * speed * dt * 0.06;

            const newX = this.playerBot.x + moveX;
            const newY = this.playerBot.y + moveY;

            // Collision check: Must be in a room or corridor
            const roomAtPos = getRoomAt(newX, newY);
            const hallAtPos = getCorridorAt(newX, newY);

            if (roomAtPos || hallAtPos) {
                this.playerBot.x = newX;
                this.playerBot.y = newY;
                this.playerBot.currentRoom = roomAtPos || this.playerBot.currentRoom;
            }
        }

        // Update facing and state
        if (dx !== 0) this.playerBot.direction = dx > 0 ? 1 : -1;
        this.playerBot.state = (dx !== 0 || dy !== 0) ? 'moving' : 'idle';
    }

    tryKill() {
        if (!this.playerBot || this.playerBot.role !== 'impostor' || this.playerBot.killCooldown > 0 || this.isVenting) return;

        // Find nearest killable bot
        let nearest = null;
        let minDist = 60; // Kill range

        for (const other of this.gameState.bots) {
            if (other === this.playerBot || !other.alive || other.role === 'impostor') continue;
            const d = Math.hypot(other.x - this.playerBot.x, other.y - this.playerBot.y);
            if (d < minDist) {
                minDist = d;
                nearest = other;
            }
        }

        if (nearest) {
            this.playerBot.performKill(nearest, this.gameState);
        }
    }

    tryReport() {
        if (!this.playerBot || !this.playerBot.alive || this.isVenting) return;

        for (const other of this.gameState.bots) {
            if (other.alive) continue;
            if (this.gameState.reportedBodies.has(other.id)) continue;

            const bodyPos = other.deathPos || { x: other.x, y: other.y };
            const d = Math.hypot(bodyPos.x - this.playerBot.x, bodyPos.y - this.playerBot.y);

            if (d < 80) { // Report range
                this.gameState.reportBody(this.playerBot, other);
                return;
            }
        }
    }

    tryUse() {
        if (!this.playerBot || !this.playerBot.alive) return;

        // 1. Emergency Button (Cafeteria center)
        const distToButton = Math.hypot(this.playerBot.x - 1450, this.playerBot.y - 275);
        if (distToButton < 100 && this.gameState.meetingCooldown <= 0) {
            this.gameState.callEmergencyMeeting(this.playerBot);
            return;
        }

        // 2. Venting (Impostor only)
        if (this.playerBot.role === 'impostor') {
            if (this.isVenting) {
                // Exit vent
                this.isVenting = false;
                this.playerBot.visible = true;
                this.playerBot.alpha = 1.0;
                console.log("Exited vent at", this.currentVentKey);
                return;
            } else {
                // Try enter vent
                for (const [key, vent] of Object.entries(VENTS)) {
                    const d = Math.hypot(this.playerBot.x - vent.x, this.playerBot.y - vent.y);
                    if (d < 60) {
                        this.isVenting = true;
                        this.currentVentKey = key;
                        this.playerBot.x = vent.x;
                        this.playerBot.y = vent.y;
                        this.playerBot.visible = false;
                        this.playerBot.alpha = 0.0;
                        console.log("Entered vent:", key);
                        return;
                    }
                }
            }
        }

        // 3. Normal Tasks
        if (this.isVenting) return;
        const taskStep = this.playerBot.getCurrentTaskStep();
        if (taskStep && this.playerBot.currentRoom === taskStep.room) {
            this.playerBot.state = 'doing_task';
            this.playerBot.taskProgress = 0;
            this.playerBot.taskDuration = taskStep.task.duration;
            console.log("Started task:", taskStep.task.name);
        }
    }

    cycleVent(dir) {
        if (!this.isVenting || !this.currentVentKey) return;

        const ventKeys = Object.keys(VENTS);
        let currentIndex = ventKeys.indexOf(this.currentVentKey);

        // Cycle through all vents globally
        currentIndex = (currentIndex + dir + ventKeys.length) % ventKeys.length;
        const nextVentKey = ventKeys[currentIndex];

        const nextVent = VENTS[nextVentKey];
        if (nextVent) {
            this.currentVentKey = nextVentKey;
            this.playerBot.x = nextVent.x;
            this.playerBot.y = nextVent.y;
            this.playerBot.currentRoom = nextVent.room;
            console.log("Vented to:", nextVentKey);
        }
    }

    tryVitals() {
        if (!this.playerBot || !this.playerBot.alive || this.isVenting) return;
        if (this.playerBot.extraRole === 'scientist') {
            this.gameState.showVitals = !this.gameState.showVitals;
        } else if (this.playerBot.extraRole === 'detective') {
            const sightings = this.playerBot.recentSightings.slice(0, 5).map(s => `${s.color}: ${s.room}`).join('\n');
            alert(`HISTORY (Recent Sightings):\n${sightings || 'No sightings yet'}`);
        } else if (this.playerBot.extraRole === 'shapeshifter') {
            this.playerBot.shapeshift(this.gameState.bots);
        } else if (this.playerBot.extraRole === 'phantom') {
            this.playerBot.goPhantom();
        }
    }
}
