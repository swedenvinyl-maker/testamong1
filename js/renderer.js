// renderer.js — Canvas drawing (map, sprites, UI overlays)

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.screenW = canvas.width;
        this.screenH = canvas.height;
        this.minimapScale = 0.08;
        this.stars = [];

        for (let i = 0; i < 200; i++) {
            this.stars.push({
                x: Math.random() * MAP_WIDTH * 1.5 - MAP_WIDTH * 0.25,
                y: Math.random() * MAP_HEIGHT * 1.5 - MAP_HEIGHT * 0.25,
                size: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.003 + 0.001,
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.screenW = this.canvas.width;
        this.screenH = this.canvas.height;
    }

    updateCamera(target) {
        if (!target) return;
        this.camera.targetX = target.x - (this.screenW / (this.zoom || 1)) / 2;
        this.camera.targetY = target.y - (this.screenH / (this.zoom || 1)) / 2;
        this.camera.x += (this.camera.targetX - this.camera.x) * 0.08;
        this.camera.y += (this.camera.targetY - this.camera.y) * 0.08;
    }

    render(gameState, time) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.screenW, this.screenH);

        this.zoom = (gameState.gameMode === 'play') ? 1.8 : 1.0;

        this.drawSpaceBackground(ctx, time);

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        this.drawMap(ctx, time);
        this.drawTaskLocations(ctx, gameState);
        this.drawDeadBodies(ctx, gameState);
        this.drawVents(ctx);
        this.drawBots(ctx, gameState, time);
        // this.drawNoisemakerAlert(ctx, gameState, time); // Disable to prevent crash

        if (gameState.ghost && gameState.gameMode === 'spectate') {
            gameState.ghost.draw(ctx);
        }

        if (gameState.activeSabotage) {
            this.drawSabotageEffect(ctx, gameState);
        }

        ctx.restore();

        this.drawHUD(ctx, gameState);
        if (gameState.showVitals) {
            this.drawVitalsScreen(ctx, gameState);
        }
        this.drawMinimap(ctx, gameState);
        this.drawKillFeed(ctx, gameState);

        if (gameState.phase === 'meeting') {
            this.drawMeetingOverlay(ctx, gameState, time);
        }
        if (gameState.phase === 'gameover') {
            this.drawGameOver(ctx, gameState);
        }
        if (gameState.phase === 'starting') {
            this.drawStartCountdown(ctx, gameState);
        }
    }

    drawFogOfWar(ctx, gameState) {
        if (!gameState.player) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);
        ctx.globalCompositeOperation = 'destination-out';
        const visionRadius = 300 * this.zoom;
        const screenX = (gameState.player.x - this.camera.x) * this.zoom;
        const screenY = (gameState.player.y - this.camera.y) * this.zoom;
        const gradient = ctx.createRadialGradient(
            screenX, screenY, visionRadius * 0.4,
            screenX, screenY, visionRadius
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, visionRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawSpaceBackground(ctx, time) {
        const gradient = ctx.createRadialGradient(
            this.screenW / 2, this.screenH / 2, 0,
            this.screenW / 2, this.screenH / 2, this.screenW
        );
        gradient.addColorStop(0, '#0a0e1a');
        gradient.addColorStop(1, '#020408');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        for (const star of this.stars) {
            const sx = star.x - this.camera.x * 0.3;
            const sy = star.y - this.camera.y * 0.3;
            if (sx < -10 || sx > this.screenW + 10 || sy < -10 || sy > this.screenH + 10) continue;
            const alpha = star.alpha * (0.5 + 0.5 * Math.sin(time * star.twinkleSpeed));
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ============================================================
    // ENHANCED MAP DRAWING
    // ============================================================
    drawMap(ctx, time) {
        // 1. Draw corridors — floor then walls
        for (const c of CORRIDORS) {
            // Corridor floor
            ctx.fillStyle = CORRIDOR_FLOOR_COLOR;
            ctx.fillRect(c.x, c.y, c.w, c.h);
            // Subtle center stripe
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            if (c.w > c.h) {
                // Horizontal corridor — horizontal center line
                ctx.fillRect(c.x, c.y + c.h / 2 - 1, c.w, 2);
            } else {
                // Vertical corridor — vertical center line
                ctx.fillRect(c.x + c.w / 2 - 1, c.y, 2, c.h);
            }
            // Corridor wall border
            ctx.strokeStyle = CORRIDOR_WALL_COLOR;
            ctx.lineWidth = 3;
            ctx.strokeRect(c.x, c.y, c.w, c.h);
        }

        // 2. Draw rooms — floor, grid pattern, decor, walls, label
        for (const [key, room] of Object.entries(ROOMS)) {
            const b = room.bounds;

            // Base floor
            ctx.fillStyle = room.floorColor || room.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);

            // Checkerboard / tile pattern
            const tileSize = 40;
            for (let tx = b.x; tx < b.x + b.w; tx += tileSize) {
                for (let ty = b.y; ty < b.y + b.h; ty += tileSize) {
                    const col = Math.floor((tx - b.x) / tileSize);
                    const row = Math.floor((ty - b.y) / tileSize);
                    if ((col + row) % 2 === 0) {
                        ctx.fillStyle = room.floorAccent || 'rgba(0,0,0,0.06)';
                        const tw = Math.min(tileSize, b.x + b.w - tx);
                        const th = Math.min(tileSize, b.y + b.h - ty);
                        ctx.fillRect(tx, ty, tw, th);
                    }
                }
            }

            // Subtle grid lines
            ctx.save();
            ctx.globalAlpha = 0.04;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            for (let gx = b.x; gx <= b.x + b.w; gx += tileSize) {
                ctx.beginPath();
                ctx.moveTo(gx, b.y);
                ctx.lineTo(gx, b.y + b.h);
                ctx.stroke();
            }
            for (let gy = b.y; gy <= b.y + b.h; gy += tileSize) {
                ctx.beginPath();
                ctx.moveTo(b.x, gy);
                ctx.lineTo(b.x + b.w, gy);
                ctx.stroke();
            }
            ctx.restore();

            // Room-specific decorations
            this.drawRoomDecor(ctx, key, b, time);

            // Room walls (thick border)
            ctx.strokeStyle = room.wallColor || '#1e2530';
            ctx.lineWidth = WALL_THICKNESS;
            ctx.strokeRect(b.x, b.y, b.w, b.h);

            // Room label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = 'bold 22px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(room.name.toUpperCase(), room.center.x, room.center.y);
        }

        // 3. Draw wall obstacles (Electrical divider etc.)
        for (const wall of WALL_OBSTACLES) {
            ctx.fillStyle = wall.color;
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            // 3D highlight on top edge
            ctx.fillStyle = wall.highlight || 'rgba(255,255,255,0.06)';
            ctx.fillRect(wall.x, wall.y, wall.w, 2);
            // Shadow on bottom
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(wall.x, wall.y + wall.h - 2, wall.w, 2);
        }
    }

    // ============================================================
    // ENHANCED ROOM DECORATIONS
    // ============================================================
    drawRoomDecor(ctx, roomKey, b, time) {
        ctx.save();
        const t = (time || performance.now()) / 1000;

        switch (roomKey) {

            // ---- CAFETERIA ----
            case 'cafeteria': {
                const cx = b.x + b.w / 2;
                const cy = b.y + b.h / 2;
                // Large central table
                ctx.fillStyle = '#3a4a5a';
                ctx.beginPath();
                ctx.arc(cx, cy, 75, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#4a5a6a';
                ctx.lineWidth = 4;
                ctx.stroke();
                // Inner ring
                ctx.fillStyle = '#2e3e4e';
                ctx.beginPath();
                ctx.arc(cx, cy, 40, 0, Math.PI * 2);
                ctx.fill();
                // Emergency button
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.arc(cx, cy, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Button shine
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                ctx.arc(cx - 3, cy - 4, 6, 0, Math.PI * 2);
                ctx.fill();

                // Dining tables (3 pairs)
                const tables = [
                    { x: b.x + 60, y: b.y + 50 },
                    { x: b.x + 60, y: b.y + 200 },
                    { x: b.x + b.w - 120, y: b.y + 50 },
                    { x: b.x + b.w - 120, y: b.y + 200 },
                ];
                for (const tb of tables) {
                    ctx.fillStyle = '#445566';
                    ctx.beginPath();
                    ctx.roundRect(tb.x, tb.y, 70, 28, 4);
                    ctx.fill();
                    ctx.strokeStyle = '#556677';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // Chairs (small circles on sides)
                    ctx.fillStyle = '#3a4a58';
                    for (let ci = 0; ci < 3; ci++) {
                        ctx.beginPath();
                        ctx.arc(tb.x + 12 + ci * 22, tb.y - 8, 5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(tb.x + 12 + ci * 22, tb.y + 36, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Trash chute bottom-left
                ctx.fillStyle = '#222';
                ctx.fillRect(b.x + 10, b.y + b.h - 50, 35, 40);
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x + 10, b.y + b.h - 50, 35, 40);
                break;
            }

            // ---- WEAPONS ----
            case 'weapons': {
                // Targeting seat area (right side)
                const chairX = b.x + b.w - 60;
                const chairY = b.y + b.h / 2;
                // Targeting circle
                ctx.strokeStyle = 'rgba(102, 187, 106, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(chairX, chairY, 40, 0, Math.PI * 2);
                ctx.stroke();
                // Crosshair
                ctx.strokeStyle = 'rgba(102, 187, 106, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(chairX - 50, chairY); ctx.lineTo(chairX + 50, chairY);
                ctx.moveTo(chairX, chairY - 50); ctx.lineTo(chairX, chairY + 50);
                ctx.stroke();
                // Center dot
                ctx.fillStyle = '#66bb6a';
                ctx.beginPath();
                ctx.arc(chairX, chairY, 5, 0, Math.PI * 2);
                ctx.fill();
                // Chair
                ctx.fillStyle = '#3d4f63';
                ctx.beginPath();
                ctx.arc(chairX, chairY, 18, 0, Math.PI * 2);
                ctx.fill();

                // Console on left wall
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 15, b.y + 40, 50, 30);
                ctx.strokeStyle = '#81d4fa';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 20, b.y + 44, 40, 22);
                // Blinking light
                const blink = Math.sin(t * 3) > 0 ? '#66bb6a' : '#2e5730';
                ctx.fillStyle = blink;
                ctx.beginPath();
                ctx.arc(b.x + 25, b.y + 80, 3, 0, Math.PI * 2);
                ctx.fill();

                // Ammo rack on top wall
                ctx.fillStyle = '#556';
                ctx.fillRect(b.x + 100, b.y + 10, 12, 70);
                ctx.fillRect(b.x + 120, b.y + 10, 12, 70);
                break;
            }

            // ---- NAVIGATION ----
            case 'navigation': {
                // Large windshield (right wall)
                const wsX = b.x + b.w - 80;
                const wsY = b.y + 40;
                const wsW = 70;
                const wsH = b.h - 80;
                ctx.fillStyle = '#060d18';
                ctx.fillRect(wsX, wsY, wsW, wsH);
                ctx.strokeStyle = '#1b4965';
                ctx.lineWidth = 3;
                ctx.strokeRect(wsX, wsY, wsW, wsH);
                // Stars in windshield
                const starPositions = [
                    [0.2, 0.1], [0.7, 0.15], [0.3, 0.35], [0.8, 0.4],
                    [0.15, 0.6], [0.6, 0.55], [0.5, 0.8], [0.85, 0.75],
                    [0.4, 0.2], [0.9, 0.9]
                ];
                for (const [sx, sy] of starPositions) {
                    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + sx * 2)));
                    ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
                    ctx.beginPath();
                    ctx.arc(wsX + sx * wsW, wsY + sy * wsH, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Pilot seat
                ctx.fillStyle = '#3d4f63';
                ctx.beginPath();
                ctx.roundRect(wsX - 50, b.y + b.h / 2 - 25, 35, 50, 6);
                ctx.fill();
                ctx.strokeStyle = '#4a6278';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Side consoles
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 20, b.y + 60, 60, 25);
                ctx.strokeStyle = '#81d4fa';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 25, b.y + 63, 50, 19);

                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 20, b.y + b.h - 85, 60, 25);
                ctx.strokeStyle = '#81d4fa';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 25, b.y + b.h - 82, 50, 19);

                // Steering wheel
                ctx.strokeStyle = 'rgba(144,202,249,0.5)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(wsX - 32, b.y + b.h / 2, 20, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }

            // ---- O2 ----
            case 'o2': {
                // Oxygen tanks (cylindrical shapes)
                for (let i = 0; i < 3; i++) {
                    const tankX = b.x + 30 + i * 45;
                    const tankY = b.y + 30;
                    ctx.fillStyle = '#3a5a3a';
                    ctx.beginPath();
                    ctx.roundRect(tankX, tankY, 25, 65, 8);
                    ctx.fill();
                    ctx.strokeStyle = '#66bb6a';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // Valve on top
                    ctx.fillStyle = '#777';
                    ctx.fillRect(tankX + 8, tankY - 5, 9, 8);
                }

                // Plant / terrarium
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(b.x + b.w - 60, b.y + b.h - 55, 35, 20);
                ctx.fillStyle = '#2e7d32';
                ctx.beginPath();
                ctx.arc(b.x + b.w - 43, b.y + b.h - 55, 20, Math.PI, 0);
                ctx.fill();

                // Control panel
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 20, b.y + b.h - 50, 80, 25);
                ctx.strokeStyle = '#a5d6a7';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 25, b.y + b.h - 47, 70, 19);
                // Status lights
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = i < 3 ? '#66bb6a' : '#ef5350';
                    ctx.beginPath();
                    ctx.arc(b.x + 35 + i * 16, b.y + b.h - 60, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            // ---- SHIELDS ----
            case 'shields': {
                // Shield generator — hexagonal
                const shX = b.x + b.w / 2;
                const shY = b.y + b.h / 2;
                const hex = (cx2, cy2, r, fill, strokeCol) => {
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = Math.PI / 3 * i - Math.PI / 6;
                        const px = cx2 + r * Math.cos(angle);
                        const py = cy2 + r * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fillStyle = fill;
                    ctx.fill();
                    if (strokeCol) {
                        ctx.strokeStyle = strokeCol;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                };
                hex(shX, shY, 45, '#2d3a50', '#42a5f5');
                hex(shX, shY, 25, '#1a2740', '#64b5f6');
                // Core glow
                const shPulse = 0.5 + 0.5 * Math.sin(t * 2);
                ctx.fillStyle = `rgba(66, 165, 245, ${0.3 * shPulse})`;
                ctx.beginPath();
                ctx.arc(shX, shY, 50 + 5 * shPulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#42a5f5';
                ctx.beginPath();
                ctx.arc(shX, shY, 8, 0, Math.PI * 2);
                ctx.fill();

                // Shield status panel
                ctx.fillStyle = '#2a3040';
                ctx.fillRect(b.x + 15, b.y + 15, 70, 35);
                ctx.strokeStyle = '#42a5f5';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 15, b.y + 15, 70, 35);
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = i < 3 ? '#66bb6a' : '#ef5350';
                    ctx.beginPath();
                    ctx.arc(b.x + 28 + i * 12, b.y + 32, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            // ---- COMMUNICATIONS ----
            case 'communications': {
                // Comms desk
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 30, b.y + 40, 100, 40);
                ctx.strokeStyle = '#607d8b';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Screen on desk
                ctx.fillStyle = '#0d1b2a';
                ctx.fillRect(b.x + 40, b.y + 45, 40, 28);
                ctx.strokeStyle = '#81d4fa';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 40, b.y + 45, 40, 28);
                // Blinking signal
                const sig = Math.sin(t * 4) > 0;
                ctx.fillStyle = sig ? '#4fc3f7' : '#1a3a4a';
                ctx.fillRect(b.x + 48, b.y + 52, 24, 14);

                // Radio dish
                ctx.strokeStyle = '#b0bec5';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(b.x + b.w - 60, b.y + 50, 25, -Math.PI * 0.7, Math.PI * 0.2);
                ctx.stroke();
                ctx.fillStyle = '#78909c';
                ctx.beginPath();
                ctx.arc(b.x + b.w - 60, b.y + 50, 5, 0, Math.PI * 2);
                ctx.fill();
                // Dish mast
                ctx.strokeStyle = '#78909c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.x + b.w - 60, b.y + 55);
                ctx.lineTo(b.x + b.w - 60, b.y + 90);
                ctx.stroke();

                // Side cabinet
                ctx.fillStyle = '#3d4f63';
                ctx.fillRect(b.x + b.w - 50, b.y + b.h - 70, 35, 50);
                ctx.strokeStyle = '#546e7a';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + b.w - 50, b.y + b.h - 70, 35, 50);
                break;
            }

            // ---- STORAGE ----
            case 'storage': {
                // Crates / boxes — scattered
                const crates = [
                    { x: 25, y: 30, w: 50, h: 50, c: '#5d4037' },
                    { x: 25, y: 90, w: 40, h: 40, c: '#4e342e' },
                    { x: 80, y: 60, w: 45, h: 55, c: '#5d4037' },
                    { x: 30, y: 200, w: 55, h: 45, c: '#6d4c41' },
                    { x: 100, y: 210, w: 35, h: 35, c: '#4e342e' },
                    { x: b.w - 80, y: 30, w: 50, h: 50, c: '#5d4037' },
                ];
                for (const cr of crates) {
                    ctx.fillStyle = cr.c;
                    ctx.fillRect(b.x + cr.x, b.y + cr.y, cr.w, cr.h);
                    ctx.strokeStyle = '#795548';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(b.x + cr.x, b.y + cr.y, cr.w, cr.h);
                    // Cross tape on crate
                    ctx.strokeStyle = 'rgba(188,170,140,0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(b.x + cr.x, b.y + cr.y);
                    ctx.lineTo(b.x + cr.x + cr.w, b.y + cr.y + cr.h);
                    ctx.moveTo(b.x + cr.x + cr.w, b.y + cr.y);
                    ctx.lineTo(b.x + cr.x, b.y + cr.y + cr.h);
                    ctx.stroke();
                }

                // Fuel canister
                ctx.fillStyle = '#c62828';
                ctx.beginPath();
                ctx.roundRect(b.x + b.w - 55, b.y + b.h - 60, 22, 35, 3);
                ctx.fill();
                ctx.strokeStyle = '#e53935';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('FUEL', b.x + b.w - 44, b.y + b.h - 38);

                // Trash chute (bottom-left)
                ctx.fillStyle = '#222';
                ctx.fillRect(b.x + 10, b.y + b.h - 45, 40, 38);
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x + 10, b.y + b.h - 45, 40, 38);
                // Chute opening lines
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(b.x + 15 + i * 9, b.y + b.h - 42);
                    ctx.lineTo(b.x + 15 + i * 9, b.y + b.h - 10);
                    ctx.stroke();
                }
                break;
            }

            // ---- ADMIN ----
            case 'admin': {
                // Large map table in center
                const tableX = b.x + 40;
                const tableY = b.y + 50;
                const tableW = b.w - 80;
                const tableH = b.h - 100;
                ctx.fillStyle = '#3d4f63';
                ctx.beginPath();
                ctx.roundRect(tableX, tableY, tableW, tableH, 6);
                ctx.fill();
                ctx.strokeStyle = '#4a6278';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Map screen on table (glowing blue)
                ctx.fillStyle = '#0d1b2e';
                ctx.fillRect(tableX + 15, tableY + 10, tableW - 30, tableH - 20);
                // Map glow
                ctx.fillStyle = `rgba(33, 150, 243, ${0.08 + 0.04 * Math.sin(t * 2)})`;
                ctx.fillRect(tableX + 15, tableY + 10, tableW - 30, tableH - 20);
                // Fake room outlines on map
                ctx.strokeStyle = 'rgba(100, 181, 246, 0.3)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 5; i++) {
                    ctx.strokeRect(
                        tableX + 25 + i * 35,
                        tableY + 20 + (i % 2) * 30,
                        28, 22
                    );
                }
                // Blinking dots on map (players)
                for (let i = 0; i < 4; i++) {
                    const dotBlink = Math.sin(t * 3 + i) > 0;
                    ctx.fillStyle = dotBlink ? '#66bb6a' : '#1a3a1a';
                    ctx.beginPath();
                    ctx.arc(tableX + 40 + i * 40, tableY + 35 + (i % 2) * 40, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Card swipe terminal
                ctx.fillStyle = '#455a64';
                ctx.fillRect(b.x + 10, b.y + b.h - 60, 28, 45);
                ctx.strokeStyle = '#ff7043';
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x + 10, b.y + b.h - 60, 28, 45);
                // Card slot
                ctx.fillStyle = '#333';
                ctx.fillRect(b.x + 16, b.y + b.h - 35, 16, 4);
                break;
            }

            // ---- ELECTRICAL ----
            case 'electrical': {
                // The breaker panel is ON the divider wall (left side of wall at x=718)
                // Breaker box
                ctx.fillStyle = '#37474f';
                ctx.fillRect(690, 680, 28, 80);
                ctx.strokeStyle = '#ffca28';
                ctx.lineWidth = 2;
                ctx.strokeRect(690, 680, 28, 80);
                // Rows of switches
                for (let row = 0; row < 5; row++) {
                    for (let col = 0; col < 2; col++) {
                        const on = (row + col) % 2 === 0;
                        ctx.fillStyle = on ? '#66bb6a' : '#ef5350';
                        ctx.fillRect(695 + col * 11, 688 + row * 14, 8, 5);
                    }
                }

                // Wire boxes on far walls
                const wireBoxes = [
                    { x: b.x + 10, y: b.y + 20 },
                    { x: b.x + b.w - 45, y: b.y + b.h - 70 },
                    { x: b.x + 10, y: b.y + b.h - 70 },
                ];
                for (const wb of wireBoxes) {
                    ctx.fillStyle = '#37474f';
                    ctx.fillRect(wb.x, wb.y, 30, 45);
                    ctx.strokeStyle = '#ffa726';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(wb.x, wb.y, 30, 45);
                }

                // Dangling wires from top-left wire box
                const wireColors = ['#ef5350', '#42a5f5', '#ffca28', '#66bb6a'];
                for (let i = 0; i < wireColors.length; i++) {
                    ctx.strokeStyle = wireColors[i];
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(b.x + 15 + i * 7, b.y + 65);
                    const sag = 15 + Math.sin(t + i) * 5;
                    ctx.quadraticCurveTo(
                        b.x + 12 + i * 7, b.y + 65 + sag,
                        b.x + 18 + i * 5, b.y + 95
                    );
                    ctx.stroke();
                }

                // Caution stripes on floor near entrance (right side)
                ctx.save();
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#ffca28';
                for (let s = 0; s < 4; s++) {
                    ctx.fillRect(b.x + b.w - 30, b.y + 20 + s * 20, 20, 8);
                }
                ctx.restore();
                break;
            }

            // ---- LOWER ENGINE ----
            case 'lowerEngine': {
                const ecx = b.x + b.w / 2;
                const ecy = b.y + b.h / 2;
                // Engine housing ring
                ctx.strokeStyle = '#42a5f5';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(ecx, ecy, 55, 0, Math.PI * 2);
                ctx.stroke();
                // Engine body
                ctx.fillStyle = '#2a3a4e';
                ctx.beginPath();
                ctx.arc(ecx, ecy, 50, 0, Math.PI * 2);
                ctx.fill();
                // Inner ring
                ctx.strokeStyle = '#1565c0';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ecx, ecy, 30, 0, Math.PI * 2);
                ctx.stroke();
                // Core with pulse
                const ePulse = 0.6 + 0.4 * Math.sin(t * 3);
                ctx.fillStyle = `rgba(21, 101, 192, ${ePulse})`;
                ctx.beginPath();
                ctx.arc(ecx, ecy, 18, 0, Math.PI * 2);
                ctx.fill();
                // Bright center
                ctx.fillStyle = '#42a5f5';
                ctx.beginPath();
                ctx.arc(ecx, ecy, 6, 0, Math.PI * 2);
                ctx.fill();

                // Fuel intake panel
                ctx.fillStyle = '#455a64';
                ctx.fillRect(b.x + 20, b.y + b.h - 40, 70, 22);
                ctx.strokeStyle = '#78909c';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 20, b.y + b.h - 40, 70, 22);
                break;
            }

            // ---- UPPER ENGINE ----
            case 'upperEngine': {
                const ecx2 = b.x + b.w / 2;
                const ecy2 = b.y + b.h / 2;
                // Same as lower engine
                ctx.strokeStyle = '#42a5f5';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(ecx2, ecy2, 55, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#2a3a4e';
                ctx.beginPath();
                ctx.arc(ecx2, ecy2, 50, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#1565c0';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ecx2, ecy2, 30, 0, Math.PI * 2);
                ctx.stroke();
                const ePulse2 = 0.6 + 0.4 * Math.sin(t * 3);
                ctx.fillStyle = `rgba(21, 101, 192, ${ePulse2})`;
                ctx.beginPath();
                ctx.arc(ecx2, ecy2, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#42a5f5';
                ctx.beginPath();
                ctx.arc(ecx2, ecy2, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#455a64';
                ctx.fillRect(b.x + 20, b.y + b.h - 40, 70, 22);
                ctx.strokeStyle = '#78909c';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 20, b.y + b.h - 40, 70, 22);
                break;
            }

            // ---- REACTOR ----
            case 'reactor': {
                const rcx = b.x + b.w / 2;
                const rcy = b.y + b.h / 2;
                // Pulsing danger glow
                const rPulse = 0.7 + 0.3 * Math.sin(t * 2.5);
                const rGrad = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, 110);
                rGrad.addColorStop(0, `rgba(211, 47, 47, ${0.3 * rPulse})`);
                rGrad.addColorStop(1, 'rgba(211, 47, 47, 0)');
                ctx.fillStyle = rGrad;
                ctx.fillRect(b.x, b.y, b.w, b.h);

                // Outer containment ring
                ctx.strokeStyle = `rgba(239, 83, 80, ${0.5 + 0.3 * rPulse})`;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(rcx, rcy, 60, 0, Math.PI * 2);
                ctx.stroke();

                // Core housing
                ctx.fillStyle = '#4a1a1a';
                ctx.beginPath();
                ctx.arc(rcx, rcy, 45, 0, Math.PI * 2);
                ctx.fill();

                // Inner core
                ctx.fillStyle = '#b71c1c';
                ctx.beginPath();
                ctx.arc(rcx, rcy, 25, 0, Math.PI * 2);
                ctx.fill();

                // Bright hot center
                ctx.fillStyle = `rgba(255, 82, 82, ${rPulse})`;
                ctx.beginPath();
                ctx.arc(rcx, rcy, 12, 0, Math.PI * 2);
                ctx.fill();

                // White-hot core
                ctx.fillStyle = `rgba(255, 200, 200, ${0.4 * rPulse})`;
                ctx.beginPath();
                ctx.arc(rcx, rcy, 5, 0, Math.PI * 2);
                ctx.fill();

                // Control rods (4 around the core)
                ctx.fillStyle = '#616161';
                const rodPositions = [
                    [rcx - 55, rcy - 50, 12, 50],
                    [rcx + 43, rcy - 50, 12, 50],
                    [rcx - 55, rcy + 5, 12, 50],
                    [rcx + 43, rcy + 5, 12, 50],
                ];
                for (const [rx, ry, rw, rh] of rodPositions) {
                    ctx.fillRect(rx, ry, rw, rh);
                }

                // Control console
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(b.x + 15, b.y + b.h - 45, 70, 25);
                ctx.strokeStyle = '#ef5350';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + 20, b.y + b.h - 42, 60, 19);
                break;
            }

            // ---- MEDBAY ----
            case 'medbay': {
                // Med scanner platform
                const scanX = b.x + b.w / 2 - 10;
                const scanY = b.y + b.h / 2 + 20;
                // Scanner base circle
                ctx.fillStyle = '#1b3a3a';
                ctx.beginPath();
                ctx.arc(scanX, scanY, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#26c6da';
                ctx.lineWidth = 3;
                ctx.stroke();
                // Scanner ring pulse
                const scanPulse = 0.3 + 0.3 * Math.sin(t * 2);
                ctx.strokeStyle = `rgba(38, 198, 218, ${scanPulse})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(scanX, scanY, 42, 0, Math.PI * 2);
                ctx.stroke();
                // Inner light
                ctx.fillStyle = `rgba(38, 198, 218, ${0.3 + 0.2 * Math.sin(t * 4)})`;
                ctx.beginPath();
                ctx.arc(scanX, scanY, 10, 0, Math.PI * 2);
                ctx.fill();

                // Bed
                ctx.fillStyle = '#eceff1';
                ctx.beginPath();
                ctx.roundRect(b.x + 20, b.y + 25, 70, 30, 4);
                ctx.fill();
                ctx.strokeStyle = '#b0bec5';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Pillow
                ctx.fillStyle = '#cfd8dc';
                ctx.fillRect(b.x + 22, b.y + 28, 18, 24);

                // IV drip stand
                ctx.strokeStyle = '#90a4ae';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.x + 15, b.y + 30);
                ctx.lineTo(b.x + 15, b.y + 65);
                ctx.stroke();
                ctx.fillStyle = '#b0bec5';
                ctx.beginPath();
                ctx.arc(b.x + 15, b.y + 26, 4, 0, Math.PI * 2);
                ctx.fill();
                // IV bag
                ctx.fillStyle = 'rgba(129, 212, 250, 0.5)';
                ctx.fillRect(b.x + 11, b.y + 18, 8, 12);

                // Medicine cabinet (right wall)
                ctx.fillStyle = '#eceff1';
                ctx.fillRect(b.x + b.w - 45, b.y + 20, 35, 55);
                ctx.strokeStyle = '#4dd0e1';
                ctx.lineWidth = 1;
                ctx.strokeRect(b.x + b.w - 45, b.y + 20, 35, 55);
                // Cross symbol
                ctx.fillStyle = '#e53935';
                ctx.fillRect(b.x + b.w - 33, b.y + 35, 10, 3);
                ctx.fillRect(b.x + b.w - 30, b.y + 32, 3, 10);
                break;
            }

            // ---- SECURITY ----
            case 'security': {
                // Monitor bank (4 screens, 2x2)
                const monX = b.x + 15;
                const monY = b.y + 15;
                // Monitor housing
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(monX, monY, 105, 75);
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.strokeRect(monX, monY, 105, 75);

                // 4 individual screens
                const screens = [
                    [monX + 5, monY + 5, 45, 30],
                    [monX + 55, monY + 5, 45, 30],
                    [monX + 5, monY + 40, 45, 30],
                    [monX + 55, monY + 40, 45, 30],
                ];
                for (let i = 0; i < screens.length; i++) {
                    const [sx, sy, sw, sh] = screens[i];
                    ctx.fillStyle = '#0d2137';
                    ctx.fillRect(sx, sy, sw, sh);
                    ctx.strokeStyle = '#4fc3f7';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(sx, sy, sw, sh);
                    // Scan line
                    const scanY2 = sy + ((t * 20 + i * 8) % sh);
                    ctx.fillStyle = 'rgba(79, 195, 247, 0.15)';
                    ctx.fillRect(sx, scanY2, sw, 2);
                    // Static noise dots
                    ctx.fillStyle = 'rgba(79, 195, 247, 0.08)';
                    for (let d = 0; d < 6; d++) {
                        const dx = sx + Math.abs(Math.sin(t * 5 + d + i)) * sw;
                        const dy = sy + Math.abs(Math.cos(t * 7 + d + i)) * sh;
                        ctx.fillRect(dx, dy, 2, 2);
                    }
                }

                // Chair
                ctx.fillStyle = '#455a64';
                ctx.beginPath();
                ctx.arc(b.x + b.w / 2, b.y + b.h - 45, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#546e7a';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Chair back
                ctx.fillStyle = '#37474f';
                ctx.beginPath();
                ctx.roundRect(b.x + b.w / 2 - 14, b.y + b.h - 65, 28, 12, 3);
                ctx.fill();
                break;
            }

        }
        ctx.restore();
    }

    // ============================================================
    // ENHANCED VENTS
    // ============================================================
    drawVents(ctx) {
        for (const [id, vent] of Object.entries(VENTS)) {
            ctx.save();
            // Vent base (dark recessed look)
            ctx.fillStyle = '#0f0f1e';
            ctx.beginPath();
            ctx.roundRect(vent.x - 20, vent.y - 12, 40, 24, 4);
            ctx.fill();
            // Metal rim
            ctx.strokeStyle = '#2a2a44';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Inner vent area
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.roundRect(vent.x - 16, vent.y - 8, 32, 16, 2);
            ctx.fill();
            // Horizontal slats
            ctx.strokeStyle = '#333355';
            ctx.lineWidth = 1.5;
            for (let i = -6; i <= 6; i += 3) {
                ctx.beginPath();
                ctx.moveTo(vent.x - 14, vent.y + i);
                ctx.lineTo(vent.x + 14, vent.y + i);
                ctx.stroke();
            }
            // Corner screws
            ctx.fillStyle = '#444466';
            const screwPositions = [[-16, -8], [14, -8], [-16, 6], [14, 6]];
            for (const [sx, sy] of screwPositions) {
                ctx.beginPath();
                ctx.arc(vent.x + sx, vent.y + sy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ============================================================
    // REST OF RENDERER (unchanged)
    // ============================================================

    drawTaskLocations(ctx, gameState) {
        const taskRooms = new Set();
        for (const task of TASK_DEFINITIONS) {
            for (const step of task.steps) {
                taskRooms.add(step.room);
            }
        }
        for (const roomId of taskRooms) {
            const room = ROOMS[roomId];
            if (!room) continue;
            ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
            ctx.beginPath();
            ctx.arc(room.center.x + 20, room.center.y - 20, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawDeadBodies(ctx, gameState) {
        for (const bot of gameState.bots) {
            if (!bot.alive && bot.deathPos) {
                drawDeadBody(ctx, bot.deathPos.x, bot.deathPos.y, bot.color, 1.2);
            }
        }
    }

    drawBots(ctx, gameState, time) {
        const visionRadius = 300;
        for (const bot of gameState.bots) {
            if (!bot.alive) continue;
            if (bot instanceof Impostor && bot.isVenting) continue;
            if (gameState.gameMode === 'play' && gameState.player && gameState.player.alive && bot !== gameState.player) {
                const d = Math.hypot(bot.x - gameState.player.x, bot.y - gameState.player.y);
                if (d > visionRadius) continue;
            }
            const drawColor = (bot instanceof Impostor && bot.isShifted) ? bot.shiftedColor : bot.color;
            const drawAlpha = (bot instanceof Impostor && bot.isPhantom) ? 0.3 : 1.0;
            ctx.save();
            ctx.globalAlpha = drawAlpha;
            drawCrewmate(ctx, bot.x, bot.y, drawColor, bot.direction, bot.frame, 1.2);
            ctx.restore();
            drawNameTag(ctx, bot.x, bot.y, bot.name, drawColor);
            if (bot.state === 'doing_task' && bot.taskDuration > 0) {
                const progress = bot.taskProgress / bot.taskDuration;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(bot.x - 20, bot.y + 25, 40, 6);
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(bot.x - 20, bot.y + 25, 40 * progress, 6);
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.strokeRect(bot.x - 20, bot.y + 25, 40, 6);
            }
            const canSeeImpostor = (gameState.gameMode === 'spectate') ||
                (gameState.player && gameState.player.role === 'impostor');
            if (bot.role === 'impostor' && canSeeImpostor) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('\u2605 IMP', bot.x, bot.y - 42);
            }
        }
    }

    drawSabotageEffect(ctx, gameState) {
        if (gameState.activeSabotage === 'lights') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
            const g = ctx.createRadialGradient(
                gameState.ghost.x, gameState.ghost.y, 50,
                gameState.ghost.x, gameState.ghost.y, 200
            );
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.8)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        }
    }

    drawHUD(ctx, gameState) {
        const padding = 15;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(padding, padding, 200, 80, 8);
        ctx.fill();

        ctx.fillStyle = '#ddd';
        ctx.font = '12px "Outfit", sans-serif';
        ctx.textAlign = 'left';

        if (gameState.gameMode === 'play' && gameState.player) {
            const role = gameState.player.role.toUpperCase();
            const status = gameState.player.alive ? 'ALIVE' : '\uD83D\uDC7B GHOST';
            ctx.fillText(`${role} | Status: ${status}`, padding + 10, padding + 20);
        } else {
            ctx.fillText('\uD83D\uDC7B Spectator Mode (WASD to move)', padding + 10, padding + 20);
        }
        const total = gameState.extendedColorsEnabled ? 18 : 12;
        ctx.fillText(`Alive: ${gameState.getAliveCount()} / ${total}`, padding + 10, padding + 40);

        const isImpostor = gameState.player && gameState.player.role === 'impostor';
        if (gameState.gameMode === 'spectate' || isImpostor) {
            const impNames = gameState.getImpostorNames();
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText(`Impostors: ${impNames.join(', ')}`, padding + 10, padding + 60);
        }

        // Tracker HUD
        if (gameState.player && gameState.player.extraRole === 'tracker' && gameState.player.trackedTarget) {
            const target = gameState.player.trackedTarget;
            const targetRoom = getRoomAt(target.x, target.y) || 'unknown';
            ctx.fillStyle = '#4ade80';
            ctx.fillText(`TRACKING: ${target.name} (${targetRoom})`, padding + 10, padding + 80);
        }

        if (gameState.activeSabotage) {
            ctx.fillStyle = 'rgba(200, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.roundRect(this.screenW / 2 - 100, padding + 45, 200, 30, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`\u26A0 ${gameState.activeSabotage.toUpperCase()} SABOTAGED`, this.screenW / 2, padding + 66);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(padding, this.screenH - 60, 220, 45, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('WASD/Arrows: Move | Shift: Speed boost', padding + 10, this.screenH - 38);
        ctx.fillText('You are a ghost \u2014 observe the game!', padding + 10, this.screenH - 22);
    }

    drawVitalsScreen(ctx, gameState) {
        const w = 400;
        const h = 500;
        const x = (this.screenW - w) / 2;
        const y = (this.screenH - h) / 2;

        ctx.fillStyle = 'rgba(10, 20, 30, 0.95)';
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 24px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VITALS MONITOR', x + w / 2, y + 40);

        ctx.font = '14px "Outfit", sans-serif';
        ctx.textAlign = 'left';

        const bots = gameState.bots;
        const cols = 3;
        const rows = Math.ceil(bots.length / cols);
        const cellW = (w - 40) / cols;
        const cellH = (h - 80) / rows;

        bots.forEach((bot, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = x + 20 + col * cellW;
            const by = y + 70 + row * cellH;

            // Draw status indicator
            ctx.fillStyle = bot.alive ? '#4ade80' : '#ff4d4d';
            ctx.beginPath();
            ctx.arc(bx + 10, by + 10, 6, 0, Math.PI * 2);
            ctx.fill();

            // Draw player name
            ctx.fillStyle = '#ddd';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(bot.name, bx + 22, by + 14);

            // Draw status text
            ctx.font = '10px sans-serif';
            ctx.fillStyle = bot.alive ? '#aaa' : '#ff6b6b';
            ctx.fillText(bot.alive ? 'OK' : 'DNT', bx + 22, by + 26);
        });

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press VITALS (G) again to close', x + w / 2, y + h - 15);
    }

    drawMinimap(ctx, gameState) {
        const mmW = 200;
        const mmH = 125;
        const mmX = this.screenW - mmW - 15;
        const mmY = 15;
        const scale = this.minimapScale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mmX - 5, mmY - 5, mmW + 10, mmH + 10, 6);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(mmX, mmY);

        for (const [key, room] of Object.entries(ROOMS)) {
            const b = room.bounds;
            ctx.fillStyle = 'rgba(60, 100, 140, 0.6)';
            ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
        }

        ctx.fillStyle = 'rgba(40, 70, 100, 0.4)';
        for (const c of CORRIDORS) {
            ctx.fillRect(c.x * scale, c.y * scale, c.w * scale, c.h * scale);
        }

        for (const bot of gameState.bots) {
            if (!bot.alive) continue;
            const col = COLORS[bot.color];
            ctx.fillStyle = col ? col.body : '#fff';
            ctx.beginPath();
            ctx.arc(bot.x * scale, bot.y * scale, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const bot of gameState.bots) {
            if (bot.alive || !bot.deathPos) continue;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.rect(bot.deathPos.x * scale - 2, bot.deathPos.y * scale - 2, 4, 4);
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(gameState.ghost.x * scale, gameState.ghost.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawKillFeed(ctx, gameState) {
        const now = gameState.gameTime;
        const recentKills = gameState.killFeed.filter(k => now - k.time < 10000);
        if (recentKills.length === 0) return;

        const x = this.screenW - 250;
        let y = 160;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 15, 240, recentKills.length * 22 + 20, 6);
        ctx.fill();

        ctx.font = '11px "Outfit", sans-serif';
        ctx.textAlign = 'left';

        for (const kill of recentKills) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText(`\u2620 ${kill.killer} killed ${kill.victim} in ${ROOMS[kill.room]?.name || kill.room}`, x, y);
            y += 22;
        }
    }

    drawMeetingOverlay(ctx, gameState, time) {
        const ms = gameState.meetingSystem;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        switch (ms.phase) {
            case 'splash':
                this.drawMeetingSplash(ctx, ms, time);
                break;
            case 'discussion':
            case 'voting':
                this.drawMeetingDiscussion(ctx, ms, gameState, time);
                break;
            case 'results':
                this.drawVoteResults(ctx, ms, gameState);
                break;
            case 'ejection':
                this.drawEjection(ctx, ms, time);
                break;
        }
    }

    drawMeetingSplash(ctx, ms, time) {
        const text = ms.reportType === 'body' ? 'DEAD BODY REPORTED' : 'EMERGENCY MEETING';
        const bgColor = ms.reportType === 'body' ? '#c41e3a' : '#f39c12';

        const pulse = 0.8 + 0.2 * Math.sin(time * 0.01);
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = pulse;
        ctx.fillRect(0, this.screenH / 2 - 60, this.screenW, 120);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${36 + Math.sin(time * 0.005) * 3}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.screenW / 2, this.screenH / 2);

        if (ms.reporter) {
            ctx.font = '16px "Outfit", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(`Called by ${ms.reporter.name}`, this.screenW / 2, this.screenH / 2 + 40);
        }
    }

    drawMeetingDiscussion(ctx, ms, gameState, time) {
        const headerColor = ms.phase === 'voting' ? '#8b5cf6' : '#3b82f6';
        ctx.fillStyle = headerColor;
        ctx.fillRect(0, 0, this.screenW, 50);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ms.getPhaseLabel(), this.screenW / 2, 32);

        const panelX = 20;
        const panelY = 65;
        const panelW = 200;

        ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, this.screenH - 80, 8);
        ctx.fill();

        ctx.font = 'bold 13px "Outfit", sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'left';
        ctx.fillText('Players', panelX + 10, panelY + 22);

        let py = panelY + 40;
        for (const bot of gameState.bots) {
            const col = COLORS[bot.color];
            const alpha = bot.alive ? 1 : 0.3;
            ctx.globalAlpha = alpha;

            drawCrewmate(ctx, panelX + 25, py + 8, bot.color, 1, 0, 0.6);

            const isImpTeam = gameState.player && gameState.player.role === 'impostor';
            const showRed = (bot.role === 'impostor' && (gameState.gameMode === 'spectate' || isImpTeam));

            ctx.fillStyle = showRed ? '#ff6b6b' : (col ? col.body : '#fff');
            ctx.font = (bot === gameState.player) ? 'bold 12px "Outfit", sans-serif' : '12px "Outfit", sans-serif';

            const playerName = (bot === gameState.player) ? bot.name + ' (YOU)' : bot.name;
            ctx.fillText(playerName, panelX + 45, py + 12);

            if (bot.currentSpeech) {
                const bubbleX = panelX + panelW + 5;
                const bubbleY = py - 10;
                const text = bot.currentSpeech;
                ctx.font = 'italic 11px "Outfit", sans-serif';
                const textWidth = ctx.measureText(text).width;
                const bW = Math.min(200, textWidth + 20);
                const bH = 25;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.moveTo(bubbleX, bubbleY + 15);
                ctx.lineTo(bubbleX - 10, bubbleY + 10);
                ctx.lineTo(bubbleX, bubbleY + 5);
                ctx.fill();

                ctx.beginPath();
                ctx.roundRect(bubbleX, bubbleY, bW, bH, 10);
                ctx.fill();

                ctx.fillStyle = '#000';
                ctx.textAlign = 'left';
                const displayText = textWidth > 180 ? text.substring(0, 25) + "..." : text;
                ctx.fillText(displayText, bubbleX + 10, bubbleY + 16);
            }

            if (!bot.alive) {
                ctx.fillStyle = '#ff4444';
                ctx.font = '10px sans-serif';
                ctx.fillText('\u2620', panelX + panelW - 25, py + 12);
            }

            if (ms.phase === 'voting' && ms.votes[bot.color] && bot.alive) {
                const vote = ms.votes[bot.color];
                ctx.fillStyle = '#aaa';
                ctx.font = '10px "Outfit", sans-serif';
                const voteText = vote === 'skip' ? '\u2192 Skip' : `\u2192 ${vote.charAt(0).toUpperCase() + vote.slice(1)}`;
                ctx.fillText(voteText, panelX + 45, py + 26);
            }

            ctx.globalAlpha = 1;
            py += 38;
        }

        const chatX = panelX + panelW + 20;
        const chatY = 65;
        const chatW = this.screenW - chatX - 20;
        const chatH = this.screenH - 80;

        ctx.fillStyle = 'rgba(15, 15, 35, 0.9)';
        ctx.beginPath();
        ctx.roundRect(chatX, chatY, chatW, chatH, 8);
        ctx.fill();

        ctx.font = 'bold 13px "Outfit", sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'left';
        ctx.fillText('Chat', chatX + 10, chatY + 22);

        let my = chatY + 40;
        const maxVisible = Math.floor((chatH - 50) / 36);
        const startIdx = Math.max(0, ms.visibleMessages.length - maxVisible);

        for (let i = startIdx; i < ms.visibleMessages.length; i++) {
            const msg = ms.visibleMessages[i];
            if (my > chatY + chatH - 20) break;

            const col = COLORS[msg.bot.color];

            ctx.fillStyle = col ? col.body : '#fff';
            ctx.beginPath();
            ctx.arc(chatX + 15, my - 4, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = col ? col.body : '#fff';
            ctx.font = 'bold 12px "Outfit", sans-serif';
            ctx.fillText(msg.bot.name + ':', chatX + 25, my);

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '12px "Outfit", sans-serif';
            const maxTextW = chatW - 30;
            const words = msg.text.split(' ');
            let line = '';
            let lineY = my + 16;

            for (const word of words) {
                const testLine = line + word + ' ';
                if (ctx.measureText(testLine).width > maxTextW && line !== '') {
                    ctx.fillText(line, chatX + 15, lineY);
                    line = word + ' ';
                    lineY += 14;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, chatX + 15, lineY);
            my = lineY + 16;
        }
    }

    drawVoteResults(ctx, ms, gameState) {
        ctx.fillStyle = 'rgba(20, 20, 50, 0.95)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Vote Results', this.screenW / 2, 60);

        const tally = {};
        tally['skip'] = 0;
        for (const [voter, voted] of Object.entries(ms.votes)) {
            if (!tally[voted]) tally[voted] = 0;
            tally[voted]++;
        }

        let y = 110;
        ctx.font = '16px "Outfit", sans-serif';
        const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);

        for (const [color, count] of sorted) {
            const col = COLORS[color];
            if (col) {
                ctx.fillStyle = col.body;
            } else {
                ctx.fillStyle = '#aaa';
            }
            const label = color === 'skip' ? 'Skip' : color.charAt(0).toUpperCase() + color.slice(1);
            ctx.textAlign = 'left';
            ctx.fillText(`${label}: `, this.screenW / 2 - 80, y);

            ctx.fillStyle = col ? col.body : '#666';
            ctx.fillRect(this.screenW / 2 + 20, y - 12, count * 30, 16);

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'right';
            ctx.fillText(count.toString(), this.screenW / 2 + 20 + count * 30 + 20, y);
            y += 32;
        }
    }

    drawEjection(ctx, ms, time) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        for (const star of this.stars.slice(0, 50)) {
            const alpha = 0.3 + 0.3 * Math.sin(time * star.twinkleSpeed);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x * 0.3, star.y * 0.5, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        if (ms.ejectedPlayer) {
            const progress = 1 - ms.timer / ms.ejectionTime;
            const ejX = -50 + progress * (this.screenW + 100);
            const ejY = this.screenH / 2 + Math.sin(progress * 10) * 30;
            const rotation = progress * Math.PI * 6;

            ctx.save();
            ctx.translate(ejX, ejY);
            ctx.rotate(rotation);
            drawCrewmate(ctx, 0, 0, ms.ejectedPlayer.color, 1, 0, 1.5);
            ctx.restore();
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ms.ejectionText, this.screenW / 2, this.screenH / 2 + 80);
    }

    drawGameOver(ctx, gameState) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        const isCrewWin = gameState.winner === 'crewmates';
        ctx.fillStyle = isCrewWin ? '#3b82f6' : '#ef4444';
        ctx.font = 'bold 42px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isCrewWin ? 'CREWMATES WIN' : 'IMPOSTORS WIN', this.screenW / 2, this.screenH / 2 - 60);

        ctx.fillStyle = '#ccc';
        ctx.font = '18px "Outfit", sans-serif';
        ctx.fillText(gameState.gameOverReason, this.screenW / 2, this.screenH / 2);

        ctx.font = '14px "Outfit", sans-serif';
        let y = this.screenH / 2 + 50;
        ctx.fillStyle = '#888';
        ctx.fillText('Roles:', this.screenW / 2, y);
        y += 25;

        for (const bot of gameState.bots) {
            const col = COLORS[bot.color];
            ctx.fillStyle = col ? col.body : '#fff';
            const roleLabel = bot.role === 'impostor' ? ' \u2605 IMPOSTOR' : ' Crewmate';
            const alive = bot.alive ? '' : ' (Dead)';
            ctx.fillText(`${bot.name}: ${roleLabel}${alive}`, this.screenW / 2, y);
            y += 22;
        }

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.roundRect(this.screenW / 2 - 80, y + 20, 160, 40, 8);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px "Outfit", sans-serif';
        ctx.fillText('Play Again', this.screenW / 2, y + 44);
    }

    drawStartingPhase(ctx, gameState) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Outfit';
        ctx.fillText('GET READY', this.canvas.width / 2, this.canvas.height / 2 - 100);

        const seconds = Math.ceil(gameState.startTimer / 1000);
        ctx.font = 'bold 72px Outfit';
        ctx.fillText(seconds, this.canvas.width / 2, this.canvas.height / 2);

        if (gameState.gameMode === 'play' && gameState.player) {
            const role = gameState.player.role.toUpperCase();
            const extraRole = gameState.player.extraRole ? ` (${gameState.player.extraRole.toUpperCase()})` : '';
            const color = (gameState.player.role === 'impostor') ? '#ef4444' : '#3b82f6';

            ctx.font = 'bold 32px Outfit';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText('YOUR ROLE IS', this.canvas.width / 2, this.canvas.height / 2 + 80);

            ctx.font = 'bold 48px Outfit';
            ctx.fillStyle = color;
            ctx.fillText(role + extraRole, this.canvas.width / 2, this.canvas.height / 2 + 140);

            ctx.font = '18px Outfit';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            const subText = (gameState.player.role === 'impostor') ? 'Kill everyone without getting caught.' : 'Complete your tasks and find the impostors.';
            ctx.fillText(subText, this.canvas.width / 2, this.canvas.height / 2 + 180);
        } else {
            ctx.font = '24px Outfit';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText('SPECTATING MODE', this.canvas.width / 2, this.canvas.height / 2 + 80);
        }
    }

    drawStartCountdown(ctx, gameState) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        const sec = Math.ceil(gameState.startTimer / 1000);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 72px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sec.toString(), this.screenW / 2, this.screenH / 2 - 30);

        ctx.font = '20px "Outfit", sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Game starting...', this.screenW / 2, this.screenH / 2 + 30);

        const hint = (gameState.gameMode === 'play')
            ? `You are ${gameState.player?.name.toUpperCase()} \u2014 Complete tasks and find the impostors!`
            : 'You are a ghost \uD83D\uDC7B \u2014 Watch the AI bots play!';
        ctx.fillText(hint, this.screenW / 2, this.screenH / 2 + 60);
    }
}