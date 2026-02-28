// tasks.js — Task definitions matching The Skeld

const TASK_TYPES = {
    COMMON: 'common',
    SHORT: 'short',
    LONG: 'long'
};

const TASK_DEFINITIONS = [
    // Common tasks (everyone gets these)
    {
        id: 'fix_wiring',
        name: 'Fix Wiring',
        type: TASK_TYPES.COMMON,
        steps: [
            { room: 'electrical', desc: 'Fix Wiring (Electrical)' },
            { room: 'cafeteria', desc: 'Fix Wiring (Cafeteria)' },
            { room: 'admin', desc: 'Fix Wiring (Admin)' },
        ],
        duration: 3000,
    },
    {
        id: 'swipe_card',
        name: 'Swipe Card',
        type: TASK_TYPES.COMMON,
        steps: [{ room: 'admin', desc: 'Swipe Card' }],
        duration: 4000,
    },

    // Short tasks
    {
        id: 'upload_data_caf',
        name: 'Upload Data',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'cafeteria', desc: 'Download Data (Cafeteria)' },
            { room: 'admin', desc: 'Upload Data (Admin)' },
        ],
        duration: 3500,
    },
    {
        id: 'upload_data_elec',
        name: 'Upload Data',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'electrical', desc: 'Download Data (Electrical)' },
            { room: 'admin', desc: 'Upload Data (Admin)' },
        ],
        duration: 3500,
    },
    {
        id: 'upload_data_weap',
        name: 'Upload Data',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'weapons', desc: 'Download Data (Weapons)' },
            { room: 'admin', desc: 'Upload Data (Admin)' },
        ],
        duration: 3500,
    },
    {
        id: 'upload_data_nav',
        name: 'Upload Data',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'navigation', desc: 'Download Data (Navigation)' },
            { room: 'admin', desc: 'Upload Data (Admin)' },
        ],
        duration: 3500,
    },
    {
        id: 'empty_garbage_caf',
        name: 'Empty Garbage',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'cafeteria', desc: 'Empty Garbage (Cafeteria)' },
            { room: 'storage', desc: 'Empty Garbage (Storage)' },
        ],
        duration: 3000,
    },
    {
        id: 'empty_garbage_o2',
        name: 'Empty Garbage',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'o2', desc: 'Empty Garbage (O2)' },
            { room: 'storage', desc: 'Empty Garbage (Storage)' },
        ],
        duration: 3000,
    },
    {
        id: 'shoot_asteroids',
        name: 'Clear Asteroids',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'weapons', desc: 'Clear Asteroids' }],
        duration: 5000,
    },
    {
        id: 'divert_power_weap',
        name: 'Divert Power',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'electrical', desc: 'Divert Power (Electrical)' },
            { room: 'weapons', desc: 'Accept Power (Weapons)' },
        ],
        duration: 2000,
    },
    {
        id: 'divert_power_nav',
        name: 'Divert Power',
        type: TASK_TYPES.SHORT,
        steps: [
            { room: 'electrical', desc: 'Divert Power (Electrical)' },
            { room: 'navigation', desc: 'Accept Power (Navigation)' },
        ],
        duration: 2000,
    },
    {
        id: 'calibrate_distributor',
        name: 'Calibrate Distributor',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'electrical', desc: 'Calibrate Distributor' }],
        duration: 4000,
    },
    {
        id: 'stabilize_steering',
        name: 'Stabilize Steering',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'navigation', desc: 'Stabilize Steering' }],
        duration: 3000,
    },
    {
        id: 'chart_course',
        name: 'Chart Course',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'navigation', desc: 'Chart Course' }],
        duration: 3000,
    },
    {
        id: 'clean_o2_filter',
        name: 'Clean O2 Filter',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'o2', desc: 'Clean O2 Filter' }],
        duration: 3500,
    },
    {
        id: 'prime_shields',
        name: 'Prime Shields',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'shields', desc: 'Prime Shields' }],
        duration: 3000,
    },
    {
        id: 'unlock_manifolds',
        name: 'Unlock Manifolds',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'reactor', desc: 'Unlock Manifolds' }],
        duration: 3500,
    },

    // Long tasks
    {
        id: 'inspect_sample',
        name: 'Inspect Sample',
        type: TASK_TYPES.LONG,
        steps: [
            { room: 'medbay', desc: 'Submit Sample' },
            { room: 'medbay', desc: 'Inspect Sample' },
        ],
        duration: 6000,
        waitBetweenSteps: 10000, // 10s wait between submit and inspect
    },
    {
        id: 'start_reactor',
        name: 'Start Reactor',
        type: TASK_TYPES.LONG,
        steps: [{ room: 'reactor', desc: 'Start Reactor' }],
        duration: 7000,
    },
    {
        id: 'fuel_engines',
        name: 'Fuel Engines',
        type: TASK_TYPES.LONG,
        steps: [
            { room: 'storage', desc: 'Get Fuel (Storage)' },
            { room: 'upperEngine', desc: 'Fuel Upper Engine' },
            { room: 'storage', desc: 'Get Fuel (Storage)' },
            { room: 'lowerEngine', desc: 'Fuel Lower Engine' },
        ],
        duration: 3000,
    },
    {
        id: 'submit_scan',
        name: 'Submit Scan',
        type: TASK_TYPES.SHORT,
        steps: [{ room: 'medbay', desc: 'Submit Scan' }],
        duration: 8000,
    },
];

// Get tasks to assign to a crewmate
function assignTasks() {
    const assigned = [];
    // Always assign common tasks
    const common = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.COMMON);
    assigned.push(...common);

    // Pick 2-3 short tasks
    const shorts = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.SHORT);
    const shuffledShorts = shuffleArray([...shorts]);
    assigned.push(...shuffledShorts.slice(0, 2 + Math.floor(Math.random() * 2)));

    // Pick 1 long task
    const longs = TASK_DEFINITIONS.filter(t => t.type === TASK_TYPES.LONG);
    const shuffledLongs = shuffleArray([...longs]);
    assigned.push(shuffledLongs[0]);

    return assigned;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Calculate total tasks in the game for the task bar
function getTotalTaskSteps(bots) {
    let total = 0;
    for (const bot of bots) {
        if (bot.role === 'crewmate') {
            for (const task of bot.tasks) {
                total += task.steps.length;
            }
        }
    }
    return total;
}
