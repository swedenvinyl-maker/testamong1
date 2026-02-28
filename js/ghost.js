// ghost.js — Ghost player controller

class GhostPlayer {
    constructor() {
        this.x = 1450;
        this.y = 275;
        this.color = 'white'; // Default ghost color
        this.speed = 3.5;
        this.boostSpeed = 6;
        this.frame = 0;
        this.frameTimer = 0;
        this.keys = {
            up: false, down: false, left: false, right: false,
            boost: false
        };
    }

    handleKeyDown(e) {
        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp': this.keys.up = true; break;
            case 's': case 'S': case 'ArrowDown': this.keys.down = true; break;
            case 'a': case 'A': case 'ArrowLeft': this.keys.left = true; break;
            case 'd': case 'D': case 'ArrowRight': this.keys.right = true; break;
            case 'Shift': this.keys.boost = true; break;
        }
    }

    handleKeyUp(e) {
        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp': this.keys.up = false; break;
            case 's': case 'S': case 'ArrowDown': this.keys.down = false; break;
            case 'a': case 'A': case 'ArrowLeft': this.keys.left = false; break;
            case 'd': case 'D': case 'ArrowRight': this.keys.right = false; break;
            case 'Shift': this.keys.boost = false; break;
        }
    }

    update(dt) {
        if (this.target) {
            this.x = this.target.x;
            this.y = this.target.y;
            return;
        }

        this.frameTimer += dt;
        if (this.frameTimer > 100) {
            this.frame++;
            this.frameTimer = 0;
        }

        const spd = this.keys.boost ? this.boostSpeed : this.speed;
        let dx = 0, dy = 0;

        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;

        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;
        }

        this.x += dx * spd;
        this.y += dy * spd;

        // Clamp to map bounds (ghost can go through walls but not off-map)
        this.x = Math.max(20, Math.min(MAP_WIDTH - 20, this.x));
        this.y = Math.max(20, Math.min(MAP_HEIGHT - 20, this.y));
    }

    draw(ctx) {
        if (this.target) return; // Don't draw ghost if we are controlling a bot
        drawGhost(ctx, this.x, this.y, this.color, this.frame, 1.2);
        drawNameTag(ctx, this.x, this.y, 'You (Ghost)', this.color);
    }
}
