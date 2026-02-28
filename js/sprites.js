// sprites.js — Procedural Among Us character drawing

const COLORS = {
    red: { body: '#c51111', dark: '#7a0838' },
    blue: { body: '#132ed1', dark: '#09158e' },
    green: { body: '#117f2d', dark: '#0a4d2e' },
    pink: { body: '#ed54ba', dark: '#ab2baf' },
    orange: { body: '#ef7d0d', dark: '#b33e15' },
    yellow: { body: '#f5f557', dark: '#c38823' },
    black: { body: '#3f474e', dark: '#1e1f26' },
    white: { body: '#d6e0f0', dark: '#8394bf' },
    purple: { body: '#6b2fbb', dark: '#3b177c' },
    brown: { body: '#71491e', dark: '#5e2615' },
    cyan: { body: '#38fedc', dark: '#24a8ae' },
    lime: { body: '#50ef39', dark: '#15a742' },
    tan: { body: '#91887e', dark: '#524741' },
    maroon: { body: '#830d0d', dark: '#510606' },
    rose: { body: '#ec9ed1', dark: '#b76595' },
    banana: { body: '#fffebe', dark: '#cfb56c' },
    gray: { body: '#758593', dark: '#3f474e' },
    coral: { body: '#d76464', dark: '#a34141' },
};

const COLOR_NAMES = Object.keys(COLORS);

function drawCrewmate(ctx, x, y, color, direction, frame, scale) {
    scale = scale || 1;
    const s = scale;
    const col = COLORS[color] || COLORS.red;

    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 18 * s, 14 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Backpack
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.roundRect(-16 * s, -8 * s, 8 * s, 18 * s, 3 * s);
    ctx.fill();

    // Body
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 14 * s);
    ctx.lineTo(-10 * s, -6 * s);
    ctx.quadraticCurveTo(-10 * s, -20 * s, 0, -20 * s);
    ctx.quadraticCurveTo(12 * s, -20 * s, 12 * s, -6 * s);
    ctx.lineTo(12 * s, 14 * s);
    ctx.closePath();
    ctx.fill();

    // Visor
    ctx.fillStyle = '#93cfef';
    ctx.beginPath();
    ctx.ellipse(6 * s, -8 * s, 7 * s, 5.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visor shine
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(8 * s, -10 * s, 3 * s, 2 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    const legOffset = frame % 2 === 0 ? 2 * s : -2 * s;
    ctx.fillStyle = col.dark;
    // Left leg
    ctx.beginPath();
    ctx.roundRect(-8 * s, 12 * s + legOffset, 8 * s, 8 * s, [0, 0, 3 * s, 3 * s]);
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.roundRect(3 * s, 12 * s - legOffset, 8 * s, 8 * s, [0, 0, 3 * s, 3 * s]);
    ctx.fill();

    ctx.restore();
}

function drawGhost(ctx, x, y, color, frame, scale) {
    scale = scale || 1;
    const s = scale;
    const col = COLORS[color] || COLORS.white;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.5;

    // Ghostly body
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 14 * s);
    ctx.lineTo(-10 * s, -6 * s);
    ctx.quadraticCurveTo(-10 * s, -20 * s, 0, -20 * s);
    ctx.quadraticCurveTo(12 * s, -20 * s, 12 * s, -6 * s);
    ctx.lineTo(12 * s, 14 * s);
    // Wavy bottom
    const wave = Math.sin(frame * 0.3) * 2;
    ctx.lineTo(9 * s, (10 + wave) * s);
    ctx.lineTo(6 * s, 14 * s);
    ctx.lineTo(3 * s, (10 - wave) * s);
    ctx.lineTo(0, 14 * s);
    ctx.lineTo(-3 * s, (10 + wave) * s);
    ctx.lineTo(-6 * s, 14 * s);
    ctx.lineTo(-10 * s, (10 - wave) * s);
    ctx.closePath();
    ctx.fill();

    // Ghost visor (hollow eyes)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(6 * s, -8 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawDeadBody(ctx, x, y, color, scale) {
    scale = scale || 1;
    const s = scale;
    const col = COLORS[color] || COLORS.red;

    ctx.save();
    ctx.translate(x, y);

    // Bone
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 4 * s, 6 * s, Math.PI * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Half body (lower half)
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 0);
    ctx.lineTo(-10 * s, -6 * s);
    ctx.quadraticCurveTo(-10 * s, -16 * s, 0, -16 * s);
    ctx.quadraticCurveTo(8 * s, -16 * s, 8 * s, -6 * s);
    ctx.lineTo(8 * s, 0);
    ctx.closePath();
    ctx.fill();

    // Visor
    ctx.fillStyle = '#93cfef';
    ctx.beginPath();
    ctx.ellipse(4 * s, -6 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawNameTag(ctx, x, y, name, color) {
    const col = COLORS[color] || COLORS.white;
    ctx.save();
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Background
    const metrics = ctx.measureText(name);
    const w = metrics.width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 30 - 16, w, 16, 3);
    ctx.fill();

    // Text
    ctx.fillStyle = col.body;
    ctx.fillText(name, x, y - 30);
    ctx.restore();
}
