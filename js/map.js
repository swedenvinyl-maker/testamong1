// map.js — The Skeld map data (Enhanced Among Us Style)
const MAP_WIDTH = 3200;
const MAP_HEIGHT = 2000;

// Room definitions
const ROOMS = {
    cafeteria: {
        name: 'Cafeteria',
        bounds: { x: 1200, y: 100, w: 500, h: 350 },
        center: { x: 1450, y: 275 },
        color: '#343e4f',
        floorColor: '#3b4557',
        floorAccent: '#323c4d',
        wallColor: '#1e2530',
        hasEmergencyButton: true
    },
    weapons: {
        name: 'Weapons',
        bounds: { x: 1800, y: 150, w: 300, h: 280 },
        center: { x: 1950, y: 290 },
        color: '#3a4555',
        floorColor: '#3f4c5e',
        floorAccent: '#353f50',
        wallColor: '#1e2530'
    },
    navigation: {
        name: 'Navigation',
        bounds: { x: 2300, y: 350, w: 350, h: 350 },
        center: { x: 2475, y: 525 },
        color: '#2f3c4e',
        floorColor: '#354250',
        floorAccent: '#2b3644',
        wallColor: '#1a2230'
    },
    o2: {
        name: 'O2',
        bounds: { x: 1750, y: 500, w: 280, h: 250 },
        center: { x: 1890, y: 625 },
        color: '#354050',
        floorColor: '#3a4756',
        floorAccent: '#303b4a',
        wallColor: '#1e2530'
    },
    shields: {
        name: 'Shields',
        bounds: { x: 2050, y: 750, w: 300, h: 280 },
        center: { x: 2200, y: 890 },
        color: '#2e3a4c',
        floorColor: '#333f52',
        floorAccent: '#293548',
        wallColor: '#1a2230'
    },
    communications: {
        name: 'Comms',
        bounds: { x: 1550, y: 900, w: 300, h: 250 },
        center: { x: 1700, y: 1025 },
        color: '#333d4d',
        floorColor: '#384454',
        floorAccent: '#2e3a4a',
        wallColor: '#1e2530'
    },
    storage: {
        name: 'Storage',
        bounds: { x: 1100, y: 750, w: 400, h: 350 },
        center: { x: 1300, y: 925 },
        color: '#3b4a5a',
        floorColor: '#404f5f',
        floorAccent: '#364555',
        wallColor: '#1e2833'
    },
    admin: {
        name: 'Admin',
        bounds: { x: 1550, y: 550, w: 300, h: 280 },
        center: { x: 1700, y: 690 },
        color: '#384555',
        floorColor: '#3d4a5b',
        floorAccent: '#334050',
        wallColor: '#1e2530'
    },
    electrical: {
        name: 'Electrical',
        bounds: { x: 600, y: 650, w: 320, h: 300 },
        center: { x: 760, y: 800 },
        color: '#2d3845',
        floorColor: '#323d4a',
        floorAccent: '#283340',
        wallColor: '#161d26'
    },
    lowerEngine: {
        name: 'Lower Engine',
        bounds: { x: 200, y: 750, w: 300, h: 300 },
        center: { x: 350, y: 900 },
        color: '#3a4858',
        floorColor: '#3f4e5e',
        floorAccent: '#354454',
        wallColor: '#1e2833'
    },
    upperEngine: {
        name: 'Upper Engine',
        bounds: { x: 200, y: 150, w: 300, h: 300 },
        center: { x: 350, y: 300 },
        color: '#3a4858',
        floorColor: '#3f4e5e',
        floorAccent: '#354454',
        wallColor: '#1e2833'
    },
    reactor: {
        name: 'Reactor',
        bounds: { x: 50, y: 400, w: 300, h: 300 },
        center: { x: 200, y: 550 },
        color: '#3c2a2a',
        floorColor: '#443030',
        floorAccent: '#382626',
        wallColor: '#221515'
    },
    medbay: {
        name: 'MedBay',
        bounds: { x: 800, y: 250, w: 300, h: 280 },
        center: { x: 950, y: 390 },
        color: '#2a3d45',
        floorColor: '#304550',
        floorAccent: '#263b44',
        wallColor: '#182830'
    },
    security: {
        name: 'Security',
        bounds: { x: 550, y: 400, w: 250, h: 220 },
        center: { x: 675, y: 510 },
        color: '#333e4e',
        floorColor: '#384454',
        floorAccent: '#2e3a4a',
        wallColor: '#1e2530'
    }
};

// Corridors connecting rooms
// Corridors connecting rooms
const CORRIDORS = [
    { name: 'Hallway between Cafeteria and Weapons', x: 1700, y: 200, w: 120, h: 80 },
    { name: 'Hallway between Cafeteria and MedBay', x: 1050, y: 280, w: 170, h: 70 },
    { name: 'Hallway between MedBay and Security', x: 500, y: 280, w: 320, h: 70 },
    { name: 'Hallway between Engine and Reactor', x: 250, y: 430, w: 100, h: 120 },
    { name: 'Hallway between Reactor and Security', x: 340, y: 470, w: 230, h: 70 },
    { name: 'Hallway between Reactor and Lower Engine', x: 250, y: 680, w: 100, h: 100 },
    { name: 'Hallway between Security and Electrical', x: 700, y: 580, w: 100, h: 100 },
    { name: 'Hallway between Electrical and Lower Engine', x: 480, y: 780, w: 140, h: 70 },
    { name: 'Hallway between Electrical and Storage', x: 900, y: 780, w: 220, h: 70 },
    { name: 'Hallway between Cafeteria and Storage', x: 1400, y: 430, w: 80, h: 420 },
    { name: 'Hallway near Admin entrance', x: 1480, y: 550, w: 70, h: 70 },
    { name: 'Hallway between Storage and Admin', x: 1400, y: 800, w: 170, h: 70 },
    { name: 'Hallway between Admin and Comms', x: 1650, y: 810, w: 80, h: 110 },
    { name: 'Hallway between Weapons and O2', x: 1850, y: 410, w: 80, h: 110 },
    { name: 'Hallway between Weapons and Navigation', x: 2080, y: 280, w: 240, h: 80 },
    { name: 'Hallway between O2 and Shields', x: 2010, y: 650, w: 100, h: 120 },
    { name: 'Hallway between O2 and Navigation', x: 2010, y: 530, w: 310, h: 70 },
    { name: 'Hallway between Navigation and Shields', x: 2300, y: 680, w: 80, h: 100 },
    { name: 'Hallway between Comms and Shields', x: 1830, y: 900, w: 240, h: 70 },
    { name: 'Hallway South of Storage', x: 1100, y: 1080, w: 200, h: 70 },
    { name: 'Hallway North of MedBay', x: 1100, y: 150, w: 120, h: 80 },
];

const CORRIDOR_COLOR = '#2a3545';
const CORRIDOR_FLOOR_COLOR = '#2f3a4a';
const CORRIDOR_WALL_COLOR = '#1a2230';
const WALL_THICKNESS = 5;

// ============================================================
// WALL OBSTACLES — solid walls that block player movement
// ============================================================
const WALL_OBSTACLES = [
    // Electrical: the classic breaker-panel divider wall
    // Vertical wall from top of room down, gap at bottom-right to walk around
    {
        x: 718, y: 650, w: 14, h: 210,
        room: 'electrical',
        color: '#1a2230',
        highlight: '#222d3a'
    },
    // Small horizontal cap on top of the divider
    {
        x: 718, y: 650, w: 55, h: 14,
        room: 'electrical',
        color: '#1a2230',
        highlight: '#222d3a'
    },
];

// Waypoint navigation graph
const WAYPOINTS = [
    { id: 0, x: 1450, y: 275, room: 'cafeteria' },
    { id: 1, x: 1300, y: 275, room: 'cafeteria' },
    { id: 2, x: 1600, y: 275, room: 'cafeteria' },
    { id: 3, x: 1450, y: 180, room: 'cafeteria' },
    { id: 4, x: 1450, y: 400, room: 'cafeteria' },
    { id: 5, x: 1950, y: 290, room: 'weapons' },
    { id: 6, x: 1850, y: 240, room: 'weapons' },
    { id: 7, x: 2475, y: 525, room: 'navigation' },
    { id: 8, x: 2380, y: 450, room: 'navigation' },
    { id: 9, x: 2400, y: 620, room: 'navigation' },
    { id: 10, x: 1890, y: 625, room: 'o2' },
    { id: 11, x: 1890, y: 540, room: 'o2' },
    { id: 12, x: 2200, y: 890, room: 'shields' },
    { id: 13, x: 2150, y: 790, room: 'shields' },
    { id: 14, x: 1700, y: 1025, room: 'communications' },
    { id: 15, x: 1700, y: 940, room: 'communications' },
    { id: 16, x: 1300, y: 925, room: 'storage' },
    { id: 17, x: 1200, y: 850, room: 'storage' },
    { id: 18, x: 1400, y: 850, room: 'storage' },
    { id: 19, x: 1700, y: 690, room: 'admin' },
    { id: 20, x: 1600, y: 620, room: 'admin' },
    { id: 21, x: 1700, y: 790, room: 'admin' },
    { id: 22, x: 760, y: 800, room: 'electrical' },
    { id: 23, x: 700, y: 720, room: 'electrical' },
    { id: 24, x: 850, y: 800, room: 'electrical' },
    { id: 25, x: 350, y: 900, room: 'lowerEngine' },
    { id: 26, x: 350, y: 820, room: 'lowerEngine' },
    { id: 27, x: 350, y: 300, room: 'upperEngine' },
    { id: 28, x: 350, y: 380, room: 'upperEngine' },
    { id: 29, x: 200, y: 550, room: 'reactor' },
    { id: 30, x: 250, y: 480, room: 'reactor' },
    { id: 31, x: 250, y: 640, room: 'reactor' },
    { id: 32, x: 950, y: 390, room: 'medbay' },
    { id: 33, x: 900, y: 320, room: 'medbay' },
    { id: 34, x: 675, y: 510, room: 'security' },
    { id: 35, x: 675, y: 580, room: 'security' },
    { id: 36, x: 1750, y: 240, room: null },
    { id: 37, x: 1150, y: 300, room: null },
    { id: 38, x: 550, y: 310, room: null },
    { id: 39, x: 300, y: 470, room: null },
    { id: 40, x: 400, y: 500, room: null },
    { id: 41, x: 300, y: 720, room: null },
    { id: 42, x: 720, y: 640, room: null },
    { id: 43, x: 550, y: 810, room: null },
    { id: 44, x: 1000, y: 810, room: null },
    { id: 45, x: 1440, y: 520, room: null },
    { id: 46, x: 1440, y: 700, room: null },
    { id: 47, x: 1480, y: 850, room: null },
    { id: 48, x: 1890, y: 460, room: null },
    { id: 49, x: 2100, y: 320, room: null },
    { id: 50, x: 2100, y: 560, room: null },
    { id: 51, x: 2100, y: 720, room: null },
    { id: 52, x: 2340, y: 700, room: null },
    { id: 53, x: 1950, y: 940, room: null },
    { id: 54, x: 1690, y: 850, room: null },
    { id: 55, x: 650, y: 310, room: null },
];

const WAYPOINT_EDGES = {
    0: [1, 2, 3, 4], 1: [0, 37], 2: [0, 36], 3: [0], 4: [0, 45],
    5: [6, 49], 6: [5, 36, 48],
    7: [8, 9], 8: [7, 49, 50, 52], 9: [7, 52],
    10: [11, 51], 11: [10, 48, 50],
    12: [13, 53], 13: [12, 51, 52],
    14: [15], 15: [14, 53, 54],
    16: [17, 18], 17: [16, 44], 18: [16, 47],
    19: [20, 21], 20: [19, 45], 21: [19, 54, 47],
    22: [23, 24], 23: [22, 42], 24: [22, 44, 43],
    25: [26], 26: [25, 41, 43],
    27: [28, 38], 28: [27, 39],
    29: [30, 31], 30: [29, 39, 40], 31: [29, 41],
    32: [33, 37], 33: [32, 55],
    34: [35, 40], 35: [34, 42],
    36: [2, 6], 37: [1, 32, 55], 38: [27, 55],
    39: [28, 30], 40: [30, 34], 41: [31, 26],
    42: [35, 23], 43: [26, 24], 44: [24, 17],
    45: [4, 20, 46], 46: [45, 47], 47: [46, 18, 21],
    48: [6, 11], 49: [5, 8], 50: [11, 8],
    51: [10, 13], 52: [9, 13, 8], 53: [12, 15],
    54: [21, 15], 55: [33, 38],
};

// Vent locations and connections
const VENTS = {
    reactor_top: { x: 220, y: 470, room: 'reactor', connections: ['upperEngine_vent'] },
    upperEngine_vent: { x: 370, y: 230, room: 'upperEngine', connections: ['reactor_top', 'lowerEngine_vent'] },
    lowerEngine_vent: { x: 370, y: 830, room: 'lowerEngine', connections: ['upperEngine_vent', 'reactor_top'] },
    medbay_vent: { x: 920, y: 350, room: 'medbay', connections: ['electrical_vent'] },
    electrical_vent: { x: 730, y: 760, room: 'electrical', connections: ['medbay_vent'] },
    security_vent: { x: 650, y: 540, room: 'security', connections: ['medbay_vent', 'electrical_vent'] },
    admin_vent: { x: 1660, y: 720, room: 'admin', connections: ['cafeteria_vent'] },
    cafeteria_vent: { x: 1500, y: 200, room: 'cafeteria', connections: ['admin_vent'] },
    navigation_vent: { x: 2450, y: 480, room: 'navigation', connections: ['weapons_vent', 'shields_vent'] },
    weapons_vent: { x: 1980, y: 250, room: 'weapons', connections: ['navigation_vent'] },
    shields_vent: { x: 2230, y: 850, room: 'shields', connections: ['navigation_vent'] },
};

// Check collision with wall obstacles
function collidesWithWall(x, y, radius) {
    radius = radius || 15;
    for (const wall of WALL_OBSTACLES) {
        const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
        const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
        const dx = x - closestX;
        const dy = y - closestY;
        if ((dx * dx + dy * dy) < (radius * radius)) {
            return wall;
        }
    }
    return null;
}

function findNearestWaypoint(x, y) {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < WAYPOINTS.length; i++) {
        const wp = WAYPOINTS[i];
        const dist = Math.hypot(wp.x - x, wp.y - y);
        if (dist < minDist) {
            minDist = dist;
            nearest = i;
        }
    }
    return nearest;
}

function getRoomAt(x, y) {
    for (const [key, room] of Object.entries(ROOMS)) {
        const b = room.bounds;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            return key;
        }
    }
    const corridorName = getCorridorAt(x, y);
    if (corridorName) return corridorName;
    return null;
}

function getCorridorAt(x, y) {
    for (const c of CORRIDORS) {
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            return c.name;
        }
    }
    return null;
}
