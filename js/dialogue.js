// dialogue.js — Sophisticated behavioral AI dialogue with alibi system
// v3.0 - Cache Buster: 2026-02-14-12-25

// Adjacent rooms for theories
const ADJACENT_ROOMS = {
    cafeteria: ['weapons', 'medbay', 'admin'],
    weapons: ['cafeteria', 'navigation', 'o2'],
    navigation: ['weapons', 'o2', 'shields'],
    o2: ['weapons', 'navigation', 'shields'],
    shields: ['navigation', 'o2', 'communications'],
    communications: ['shields', 'admin', 'storage'],
    storage: ['cafeteria', 'admin', 'electrical', 'communications'],
    admin: ['cafeteria', 'storage', 'communications'],
    electrical: ['storage', 'security', 'lowerEngine'],
    lowerEngine: ['electrical', 'reactor'],
    upperEngine: ['reactor', 'medbay'],
    reactor: ['upperEngine', 'lowerEngine', 'security'],
    medbay: ['upperEngine', 'cafeteria'],
    security: ['reactor', 'electrical'],
};

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function roomName(id) {
    if (!id || id === 'unknown') return 'unknown';
    if (id === 'hallway') return 'Hallway';
    return ROOMS[id]?.name || id.charAt(0).toUpperCase() + id.slice(1);
}

function capName(color) {
    if (!color) return 'someone';
    return color.charAt(0).toUpperCase() + color.slice(1);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// -------------------------------------------------------------------
//  DISCUSSION MESSAGE GENERATOR — context-aware, alibi-tracking
// -------------------------------------------------------------------

function generateDiscussionMessages(bots, context, gameState) {
    const messages = [];
    // Filter out the player's bot from automatic AI messages
    const aliveBots = bots.filter(b => b.alive && b !== gameState.player);
    const deadBots = bots.filter(b => !b.alive);
    const isBodyReport = context.type === 'body_report';

    // -- PHASE 1: Reporter speaks first ---
    if (context.reporter && context.reporter.alive && context.reporter !== gameState.player) {
        if (isBodyReport && context.victim) {
            // SPECIAL: Witness reporting
            if (context.reporter.sawKill && context.reporter.sawKill.victim.id === context.victim.id) {
                const killer = context.reporter.sawKill.killer;
                const msgs = [
                    `IT WAS ${capName(killer.color)}!!! I SAW THEM KILL ${capName(context.victim.color)}!`,
                    `I SAW ${capName(killer.color)} DO IT! IN ${roomName(context.bodyRoom)}!`,
                    `guys it is ${capName(killer.color)}, i literally saw the kill`,
                    `100% ${capName(killer.color)}, they killed right in front of me`,
                ];
                messages.push({
                    bot: context.reporter,
                    text: pickRandom(msgs),
                    delay: 600,
                    type: 'accuse',
                    meta: { accuser: context.reporter.color, accused: killer.color, reason: 'witness' }
                });
            } else if (context.stackKill) {
                // SPECIAL: Stack kill reporting
                const room = roomName(context.bodyRoom);
                const msgs = [
                    `IT WAS A STACK KILL! i found the body in ${room} but too many people were there!`,
                    `someone just died in the crowd in ${room}!! i couldn't see who!`,
                    `BODY IN ${room}! it was a stack kill, i have no idea who did it`,
                    `guys it's a stack kill in ${room}, don't trust anyone who was there`,
                ];
                messages.push({ bot: context.reporter, text: pickRandom(msgs), delay: 600 });
            } else if (context.reporter.extraRole === 'scientist' && isBodyReport) {
                const msgs = [
                    `My vitals showed a death before I found the body.`,
                    `Vitals confirmed it, ${context.victim?.name} is gone.`,
                    `I was checking vitals and saw a flatline!`,
                ];
                messages.push({ bot: context.reporter, text: pickRandom(msgs), delay: 600 });
            } else {
                const room = roomName(context.bodyRoom);
                const reps = [
                    `i found ${context.victim.name}'s body in ${room}!!`,
                    `body in ${room}! ${context.victim.name} is dead!`,
                    `DEAD BODY in ${room}!! its ${context.victim.name}!`,
                    `${context.victim.name} is dead in ${room}, i just walked in and found them`,
                    `yo ${context.victim.name} got killed in ${room}!`,
                ];
                messages.push({ bot: context.reporter, text: pickRandom(reps), delay: 600 });

                // Reporter follow-up with context
                const sightings = context.reporter.recentSightings.filter(
                    s => s.color !== context.reporter.color && s.color !== context.victim?.color
                );
                if (sightings.length > 0 && Math.random() < 0.7) {
                    const s = pickRandom(sightings);
                    const followups = [
                        `i saw ${capName(s.color)} ${s.activity} near ${roomName(s.room)} right before`,
                        `${capName(s.color)} was in ${roomName(s.room)} when i walked past, idk if thats relevant`,
                        `last person i saw was ${capName(s.color)} in ${roomName(s.room)}`,
                    ];
                    messages.push({ bot: context.reporter, text: pickRandom(followups), delay: 2500 });
                }
            }
        } else {
            messages.push({
                bot: context.reporter,
                text: pickRandom([
                    'EMERGENCY MEETING! i saw something suspicious',
                    'called a meeting because i have info',
                    'emergency!! i need to tell everyone something',
                ]),
                delay: 600,
            });
        }
    }

    // -- PHASE 2: Other bots react naturally ---
    const others = shuffleArray(aliveBots.filter(b => b !== context.reporter));
    let delay = 4000;

    // Track accusations made so far for AI agreement/disagreement
    const accusations = []; // { accuser, accused, reason }
    const defenses = [];    // { defender, defending, reason }

    // If reporter made an accusation (witness), add it
    if (messages.some(m => m.type === 'accuse')) {
        const accMsg = messages.find(m => m.type === 'accuse');
        accusations.push(accMsg.meta);
    }

    for (const bot of others) {
        const msgs = generateBotMessages(bot, context, aliveBots, deadBots, accusations, defenses, gameState);
        for (const msg of msgs) {
            messages.push({ bot, text: msg.text, delay });
            delay += 1800 + Math.random() * 2500;

            // Track accusations for other bots to react to
            if (msg.type === 'accuse') accusations.push(msg.meta);
            if (msg.type === 'defend') defenses.push(msg.meta);
        }
    }

    // -- PHASE 3: Reactions to accusations (second round) ---
    delay += 1000;
    for (const acc of accusations) {
        // The accused defends themselves
        const accused = aliveBots.find(b => b.color === acc.accused);
        if (accused && Math.random() < 0.8) {
            const def = generateSelfDefense(accused, acc, aliveBots, gameState);
            messages.push({ bot: accused, text: def, delay });
            delay += 2000 + Math.random() * 1500;
        }

        // Alibi partners vouch
        for (const bot of aliveBots) {
            if (bot.color === acc.accused) continue;
            if (bot.clearList.includes(acc.accused) && Math.random() < 0.85) {
                const room = bot.companions[acc.accused]?.room;
                const vouches = [
                    `it cant be ${capName(acc.accused)}, they were with me in ${roomName(room)} the whole time`,
                    `nah ${capName(acc.accused)} is clear, i was literally with them in ${roomName(room)}`,
                    `i can vouch for ${capName(acc.accused)}, we were together in ${roomName(room)}`,
                    `${capName(acc.accused)} was right next to me doing tasks in ${roomName(room)}, its not them`,
                    `we were both in ${roomName(room)}, no way its ${capName(acc.accused)}`,
                ];
                messages.push({ bot, text: pickRandom(vouches), delay });
                delay += 1500 + Math.random() * 1200;
            }
        }
    }

    // -- PHASE 4: Some last-minute thoughts ---
    delay += 500;
    const lateReactors = shuffleArray([...aliveBots]).slice(0, Math.min(3, aliveBots.length));
    for (const bot of lateReactors) {
        if (Math.random() < bot.personality.talkativeness * 0.6) {
            const late = generateLateThought(bot, accusations, defenses, context, aliveBots);
            if (late) {
                messages.push({ bot, text: late, delay });
                delay += 1500 + Math.random() * 1500;
            }
        }
    }

    return messages;
}

// -------------------------------------------------------------------
//  PER-BOT MESSAGE GENERATOR
// -------------------------------------------------------------------

function generateBotMessages(bot, context, aliveBots, deadBots, prevAccusations, prevDefenses, gameState) {
    const msgs = [];
    const isImpostor = bot.role === 'impostor';

    if (isImpostor) {
        return generateImpostorMessages(bot, context, aliveBots, prevAccusations, gameState);
    }

    // Crewmate logic
    const msgCount = Math.random() < bot.personality.talkativeness ? 2 : 1;

    for (let i = 0; i < msgCount; i++) {
        const msg = generateCrewmateMessage(bot, context, aliveBots, deadBots, prevAccusations, prevDefenses, i, gameState);
        if (msg) msgs.push(msg);
    }

    return msgs;
}

function generateCrewmateMessage(bot, context, aliveBots, deadBots, prevAccs, prevDefs, msgIndex, gameState) {
    const roll = Math.random();
    // Safely get room name, even if unknown or null
    const room = roomName(bot.currentRoom);
    const task = bot.getCurrentTaskStep();
    const taskName = task ? task.task.name : 'my tasks';

    // First message — state where you were
    if (msgIndex === 0) {
        // PRIORITY: If we witnessed a kill, REPORT IT!
        if (bot.sawKill) {
            const killerName = capName(bot.sawKill.killer.color);
            const victimName = capName(bot.sawKill.victim.color);
            const killRoom = roomName(bot.sawKill.room);

            const accusations = [
                `IT WAS ${killerName}!!! I SAW THEM KILL ${victimName} IN ${killRoom}!`,
                `guys vote ${killerName} i literally saw them kill ${victimName}`,
                `I SAW ${killerName} KILL ${victimName} RIGHT IN FRONT OF ME`,
                `100% ${killerName}, they killed ${victimName} in ${killRoom} i saw it`,
                `emergency because i saw ${killerName} murder ${victimName}!!`,
            ];

            return {
                text: pickRandom(accusations),
                type: 'accuse',
                meta: { accuser: bot.color, accused: bot.sawKill.killer.color, reason: 'witness' }
            };
        }

        // Priority 2: Stack Kill witness
        if (bot.sawStackKill) {
            const room = roomName(bot.sawStackKill.room);
            const msgs = [
                `i saw the kill in ${room} but it was a stack, couldn't see the face`,
                `it was definitely a stack kill in ${room}`,
                `too many people in ${room} when it happened, it's a stack kill`,
            ];
            return { text: pickRandom(msgs), type: 'info', meta: { stackKill: true } };
        }

        // If we have alibi partners, mention it
        if (bot.clearList.length > 0 && Math.random() < 0.6) {
            const partner = capName(pickRandom(bot.clearList));
            const msgs = [
                `i was in ${room} with ${partner}, we're both clear`,
                `me and ${partner} were together in ${room} doing tasks`,
                `${partner} and i were in ${room} the entire time, cant be either of us`,
                `i was doing ${taskName} in ${room}, ${partner} was right there with me`,
            ];
            return { text: pickRandom(msgs), type: 'alibi', meta: { partners: bot.clearList } };
        }

        const starters = [
            `i was in ${room} doing ${taskName}`,
            `i was doing ${taskName} in ${room}`,
            `was in ${room} the whole time`,
            `just came from ${room}, was doing ${taskName}`,
        ];
        return { text: pickRandom(starters), type: 'info', meta: {} };
    }

    // Second message — accuse, ask questions, or share observations
    // Check if we saw anyone suspicious
    const susSightings = bot.recentSightings.filter(s => {
        const isAlive = aliveBots && aliveBots.some(b => b.color === s.color);
        const isNotCleared = !bot.clearList.includes(s.color);
        return isAlive && isNotCleared && s.color !== bot.color;
    });

    if (roll < 0.35 * bot.personality.confidence && susSightings.length > 0) {
        const sus = pickRandom(susSightings);
        const susRoom = roomName(sus.room);
        const susName = capName(sus.color);

        // Was the suspicious person near the body?
        const bodyRoom = context.bodyRoom;
        const adjRooms = bodyRoom ? (ADJACENT_ROOMS[bodyRoom] || []) : [];
        const nearBody = sus.room === bodyRoom || adjRooms.includes(sus.room);

        if (nearBody) {
            const accs = [
                `${susName} was in ${susRoom} right near the body, thats sus`,
                `i literally saw ${susName} near ${susRoom}, kinda sus considering the body was there`,
                `yo ${susName} was very close to ${roomName(bodyRoom)}, i saw them in ${susRoom}`,
                `${susName} was ${sus.activity} in ${susRoom} near the body.. vote ${susName}?`,
            ];
            return { text: pickRandom(accs), type: 'accuse', meta: { accuser: bot.color, accused: sus.color, reason: 'near body' } };
        } else {
            const obs = [
                `i saw ${susName} in ${susRoom} ${sus.activity}`,
                `${susName} was in ${susRoom}, not sure what they were doing`,
                `last i saw ${susName} they were in ${susRoom}`,
            ];
            return { text: pickRandom(obs), type: 'info', meta: {} };
        }
    }

    // Agree with previous accusation
    if (roll < 0.6 && prevAccs.length > 0 && Math.random() < bot.personality.paranoia) {
        const acc = pickRandom(prevAccs);
        const agrees = [
            `yeah ${capName(acc.accused)} is sus, i agree`,
            `i was thinking the same thing about ${capName(acc.accused)}`,
            `vote ${capName(acc.accused)}, they always seem sketchy`,
            `${capName(acc.accused)} been quiet and sus`,
        ];
        return { text: pickRandom(agrees), type: 'agree', meta: {} };
    }

    // Ask a question
    if (roll < 0.75) {
        const qs = [
            'where was everyone?',
            'anyone see anything sus?',
            'who was near the body?',
            `anyone else in ${room}?`,
            'what was everyone doing?',
            'this is the second kill, we gotta figure this out',
        ];
        return { text: pickRandom(qs), type: 'question', meta: {} };
    }

    // Suggest skip
    const skips = [
        'i dont have enough info, skip?',
        'idk who it is, maybe skip this one',
        'lets not random vote, skip',
    ];
    return { text: pickRandom(skips), type: 'skip', meta: {} };
}

// -------------------------------------------------------------------
//  IMPOSTOR MESSAGE GENERATOR — deception, bluffs, scapegoating
// -------------------------------------------------------------------

function generateImpostorMessages(bot, context, aliveBots, prevAccusations, gameState) {
    const msgs = [];
    const crewmates = aliveBots ? aliveBots.filter(b => b.role === 'crewmate' && b !== bot) : [];
    const otherImpostor = aliveBots ? aliveBots.find(b => b !== bot && b.role === 'impostor') : null;

    // Pick a scapegoat — never blame the other impostor
    const scapegoat = crewmates.length > 0 ? pickRandom(crewmates) : null;

    // Fake alibi room
    const alibiRoom = bot.fakeAlibiRoom || bot.currentRoom;
    const alibiRoomName = roomName(alibiRoom);
    const taskStep = bot.getCurrentTaskStep();
    const taskName = taskStep ? taskStep.task.name : 'tasks';

    // First message — establish alibi
    if (bot.clearList.length > 0) {
        const partner = capName(pickRandom(bot.clearList));
        msgs.push({
            text: pickRandom([
                `i was with ${partner} in ${alibiRoomName} doing ${taskName}`,
                `me and ${partner} were in ${alibiRoomName}, we're clear`,
                `${partner} can confirm i was in ${alibiRoomName}`,
            ]),
            type: 'alibi',
            meta: {},
        });
    } else {
        msgs.push({
            text: pickRandom([
                `i was in ${alibiRoomName} doing ${taskName}`,
                `was doing ${taskName} in ${alibiRoomName}, didnt see anything`,
                `just came from ${alibiRoomName}, was doing my tasks`,
            ]),
            type: 'info',
            meta: {},
        });
    }

    // Second message — try to deflect / blame someone else
    // Logic: If someone accuses us, defend hard!
    const accusedUs = prevAccusations.find(a => a.accused === bot.color);
    if (accusedUs && Math.random() < 0.8) {
        msgs.push({
            text: generateSelfDefense(bot, accusedUs, aliveBots, gameState),
            type: 'defend',
            meta: {}
        });
    } else if (Math.random() < 0.4 && scapegoat) {
        // Throw suspicion on a crewmate
        // If witness accusation exists, impostor might panic and accuse back?
        const bluffs = [
            `ngl ${scapegoat.name} was acting kinda weird near ${roomName(alibiRoom)}`,
            `has anyone noticed ${scapegoat.name} being sus? i saw them lurking around`,
            `i think i saw ${scapegoat.name} following ${context.victim?.name || 'someone'} earlier`,
            `${scapegoat.name} was being really sus, just saying`,
            `im voting ${scapegoat.name}, they were near ${roomName(context.bodyRoom || alibiRoom)}`,
        ];
        msgs.push({
            text: pickRandom(bluffs),
            type: 'accuse',
            meta: { accuser: bot.color, accused: scapegoat.color, reason: 'bluff' },
        });
    } else if (Math.random() < 0.65 && prevAccusations.length > 0) {
        const validAccs = prevAccusations.filter(a => a.accused !== otherImpostor?.color);
        if (validAccs.length > 0) {
            const acc = pickRandom(validAccs);
            msgs.push({
                text: pickRandom([
                    `yeah ${capName(acc.accused)} is sus, vote them`,
                    `i agree, ${capName(acc.accused)} was being weird`,
                    `${capName(acc.accused)} is definitely the impostor`,
                    `lets vote ${capName(acc.accused)}, i dont trust them`,
                ]),
                type: 'agree',
                meta: {},
            });
        }
    } else {
        msgs.push({
            text: pickRandom([
                'this is scary, we need to find them',
                'idk who it is but we gotta be careful',
                'anyone have any actual proof?',
                'we shouldnt random vote',
            ]),
            type: 'info',
            meta: {},
        });
    }

    return msgs;
}

// -------------------------------------------------------------------
//  SELF-DEFENSE when accused
// -------------------------------------------------------------------

function generateSelfDefense(bot, accusation, aliveBots, gameState) {
    const room = roomName(bot.currentRoom);
    const task = bot.getCurrentTaskStep();
    const taskName = task ? task.task.name : 'my tasks';

    // If we have alibi partners, use them
    if (bot.clearList.length > 0) {
        const partners = bot.clearList.map(c => capName(c)).join(' and ');
        return pickRandom([
            `its not me!! i was with ${partners} in ${room} the whole time`,
            `literally ask ${partners}, we were together in ${room}!`,
            `how is it me when i was literally with ${partners}? makes no sense`,
            `${partners} can vouch for me we were in ${room} doing tasks`,
        ]);
    }

    // Impostor defense
    if (bot.role === 'impostor') {
        const alibiRoom = bot.fakeAlibiRoom || room;
        return pickRandom([
            `its not me, i was in ${roomName(alibiRoom)} doing ${taskName}`,
            `why are you accusing me?? i was literally in ${roomName(alibiRoom)}`,
            `thats cap, i was nowhere near the body, i was in ${roomName(alibiRoom)}`,
            `stop accusing me and find the real impostor, i was doing ${taskName}`,
            `voting me is a waste, im clean`,
        ]);
    }

    // Regular crewmate defense
    return pickRandom([
        `its not me! i was doing ${taskName} in ${room}`,
        `why would i report if it was me? i was in ${room}`,
        `im literally a crewmate doing ${taskName}, vote me and you lose`,
        `thats wrong, i was in ${room} the entire round`,
        `im not the impostor, i was doing ${taskName}!`,
    ]);
}

// -------------------------------------------------------------------
//  LATE THOUGHTS (second round of discussion)
// -------------------------------------------------------------------

function generateLateThought(bot, accusations, defenses, context, aliveBots) {
    if (accusations.length > 0 && Math.random() < 0.6) {
        const acc = pickRandom(accusations);
        if (Math.random() < 0.5) {
            return pickRandom([
                `actually yeah i think ${capName(acc.accused)} did it`,
                `vote ${capName(acc.accused)}, the evidence adds up`,
                `${capName(acc.accused)} still hasnt given a good alibi`,
                `we're voting ${capName(acc.accused)} right?`,
            ]);
        } else {
            return pickRandom([
                `wait are we sure about ${capName(acc.accused)}? what if its someone else`,
                `idk about voting ${capName(acc.accused)}, im not convinced`,
                `we might be wrong about ${capName(acc.accused)}, be careful`,
            ]);
        }
    }

    if (context.type === 'body_report') {
        const bodyRoom = context.bodyRoom;
        const adj = ADJACENT_ROOMS[bodyRoom] || [];
        if (adj.length > 0) {
            return pickRandom([
                `the body was in ${roomName(bodyRoom)}, killer probably came from ${roomName(pickRandom(adj))}`,
                `whoever was near ${roomName(bodyRoom)} is sus`,
                `was anyone in ${roomName(pickRandom(adj))}? thats right next to where the body was`,
            ]);
        }
    }

    return pickRandom([
        'we need to figure this out before its too late',
        'just vote who you think is sus',
        'the impostors are being sneaky this game',
        'hurry up and vote',
        'were running out of time',
    ]);
}

// -------------------------------------------------------------------
//  VOTE GENERATOR — based on discussion, alibis, suspicion
// -------------------------------------------------------------------

function generateVotes(bots, context, gameState, chatMessages) {
    const votes = {};
    const aliveBots = bots.filter(b => b.alive);

    // Parse chat messages for accusations/suspicions to boost votes
    const chatSus = {};
    let skipConsensusCount = 0;

    if (chatMessages) {
        chatMessages.forEach(msg => {
            if (!msg.text) return;
            const text = msg.text.toLowerCase();

            // Check for skip consensus
            if (text.includes('skip') || text.includes('skp')) {
                skipConsensusCount++;
            }

            // Look for accused players in text
            aliveBots.forEach(b => {
                if (b === msg.bot) return; // Don't count self-talk
                const name = b.name.toLowerCase();
                const color = b.color.toLowerCase();

                if (text.includes(name) || text.includes(color)) {
                    // Check for accusatory keywords
                    if (text.includes('sus') || text.includes('kill') || text.includes('vote') || text.includes('saw') || text.includes('trust') || text.includes('bad') || text.includes('impostor') || text.includes('imp')) {
                        if (!chatSus[b.color]) chatSus[b.color] = 0;
                        chatSus[b.color] += 2.0; // Significant boost
                    }
                    if (text.includes('safe') || text.includes('clear') || text.includes('with me')) {
                        if (!chatSus[b.color]) chatSus[b.color] = 0;
                        chatSus[b.color] -= 1.5; // Reduction
                    }
                }
            });
        });
    }

    // Determine if strict skip consensus exists (e.g., more than 30% of messages mention skip)
    const isSkipConsensus = chatMessages && chatMessages.length > 2 && (skipConsensusCount / chatMessages.length) > 0.3;

    for (const bot of aliveBots) {
        votes[bot.color] = generateBotVote(bot, aliveBots, context, gameState, chatSus, isSkipConsensus);
    }

    return votes;
}

function generateBotVote(bot, aliveBots, context, gameState, chatSus, isSkipConsensus) {
    const otherAlive = aliveBots.filter(b => b !== bot);
    if (otherAlive.length === 0) return 'skip';

    // PRIORITY: If we witnessed a kill, VOTE THEM!
    if (bot.sawKill) {
        // If the accused is still alive, vote them
        const killer = otherAlive.find(b => b.color === bot.sawKill.killer.color);
        if (killer) return killer.color;
    }

    // --- Impostor voting ---
    if (bot.role === 'impostor') {
        const crewmates = otherAlive.filter(b => b.role === 'crewmate');
        const otherImp = otherAlive.find(b => b.role === 'impostor');

        // Never vote for the other impostor
        const validTargets = otherAlive.filter(b => b !== otherImp);
        if (validTargets.length === 0) return 'skip';

        // Check if chat is piling on a crewmate
        // If clear consensus against a crewmate, vote them to blend in
        // ...

        // Vote for whoever seems most accused in discussion
        if (crewmates.length > 0 && Math.random() < 0.75) {
            return pickRandom(crewmates).color;
        }
        if (Math.random() < 0.2) return 'skip';
        return pickRandom(validTargets).color;
    }

    // --- Crewmate voting ---

    // Build suspicion scores
    const scores = {};
    for (const other of otherAlive) {
        scores[other.color] = 0;
    }

    // People near the body are more sus
    if (context.bodyRoom) {
        for (const sighting of bot.recentSightings) {
            if (!scores.hasOwnProperty(sighting.color)) continue;
            if (sighting.room === context.bodyRoom) {
                scores[sighting.color] += 3;
            }
            const adj = ADJACENT_ROOMS[context.bodyRoom] || [];
            if (adj.includes(sighting.room)) {
                scores[sighting.color] += 1.5;
            }
        }
    }

    // People we were with are LESS sus
    for (const color of bot.clearList) {
        if (scores.hasOwnProperty(color)) {
            scores[color] -= 4 * bot.personality.loyalty;
        }
    }

    // People acting weird get slight bump
    for (const sighting of bot.recentSightings) {
        if (!scores.hasOwnProperty(sighting.color)) continue;
        if (sighting.activity === 'standing around') {
            scores[sighting.color] += 0.5;
        }
    }

    // Add Chat Suspicion
    if (chatSus) {
        for (const color in chatSus) {
            if (scores.hasOwnProperty(color)) {
                // Determine if we trust the chat
                scores[color] += chatSus[color];
            }
        }
    }

    // Handle skip consensus
    if (isSkipConsensus && Math.random() < 0.8) {
        // Find if anyone is extremely sus before skipping
        const highlySus = Object.values(scores).some(s => s > 6);
        if (!highlySus) return 'skip';
    }

    // Add some randomness based on paranoia
    for (const color in scores) {
        scores[color] += (Math.random() - 0.3) * bot.personality.paranoia * 2.5;
    }

    // Find highest suspicion
    let maxScore = -Infinity;
    let maxColor = null;
    for (const [color, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            maxColor = color;
        }
    }

    // Only vote if suspicion is high enough, otherwise skip
    // Skip consensus makes this threshhold higher
    const threshold = isSkipConsensus ? 3.5 : 1.2;
    if (maxScore < threshold || Math.random() < 0.1) {
        return 'skip';
    }

    return maxColor || 'skip';
}

// -------------------------------------------------------------------
//  AI TEXT GENERATION (Puter.js) — Hybrid System
// -------------------------------------------------------------------

// -------------------------------------------------------------------
//  REACTIVE AI DIALOGUE SYSTEM — Turn-based listening
// -------------------------------------------------------------------

/**
 * Generates responses for bots ONE BY ONE during the meeting.
 * This allows bots to "read" what the player or other bots just said.
 */
async function generateNextBotResponseAI(bots, currentLog, context, gameState, priorityBot = null) {
    // 1. Pick a bot to speak (randomly based on talkativeness, but avoid double-talking)
    const aliveBots = bots.filter(b => b.alive && b !== gameState.player);
    if (aliveBots.length === 0) return null;

    let candidate = null;
    if (priorityBot && priorityBot.alive && priorityBot !== gameState.player) {
        candidate = priorityBot;
        console.log(`[AI] Priority speaker enforced: ${candidate.name}`);
    } else {
        candidate = aliveBots[Math.floor(Math.random() * aliveBots.length)];
        // Lower threshold for "not speaking" to ensure chat is active
        if (Math.random() > candidate.personality.talkativeness + 0.2) {
            console.log(`[AI] Candidate ${candidate.name} skipped (threshold).`);
            return null;
        }
        console.log(`[AI] Candidate ${candidate.name} selected.`);
    }

    // 2. Build the system prompt
    const baseSystemPrompt = `You are playing Among Us.
Map: The Skeld.
Roles: Crewmate (innocent) or Impostor (killer).
State: Discussion phase.

Rules:
- RESPOND to the LAST FEW MESSAGES in the Chat Log! Use them for context.
- Be VERY brief (max 12 words).
- Use lowercase/slang: "sus", "cap", "vented", "skip", "where".
- Don't just repeat yourself. Gossip, ask questions, or react to accusations.
- If anyone (including the PLAYER) asks a question, try to answer it!
- If you are Impostor, lie convincingly.
`;

    // 3. Generate message
    const text = await generateSingleBotMessageAI(candidate, context, currentLog, baseSystemPrompt, bots, gameState, 'reactive');

    if (text) {
        return { bot: candidate, text };
    }
    return null;
}

async function generateDiscussionMessagesAI(bots, context, gameState) {
    // Legacy support for the initial reporter message
    const messages = [];
    if (context.reporter && context.reporter.alive && context.reporter !== gameState.player) {
        const text = await generateSingleBotMessageAI(context.reporter, context, [], "You just reported a body. Tell everyone where it is.", bots, gameState, 'report');
        messages.push({ bot: context.reporter, text, delay: 500 });
    }
    return messages;
}

async function generateSingleBotMessageAI(bot, context, discussionLog, baseSystemPrompt, allBots, gameState, phase) {
    if (bot === gameState.player) {
        console.warn(`[BLOCK] AI attempted to speak for player bot (${bot.color}). Blocked.`);
        return null;
    }
    // 1. Build context for THIS bot
    let myRoleRaw = bot.role;
    let myGoal = "Find the impostor.";

    // RANDOM GOALS BLOCKED BY REPLY PHASE
    if (phase === 'reply') {
        myGoal = "Respond directly and briefly to the last person who spoke in the Chat Log. Address their specific point or alibi.";
    } else if (bot.role !== 'impostor' && !bot.sawKill) {
        const goals = [
            "Share your alibi.",
            "Ask where the body was found.",
            "Ask someone specific where they were.",
            "Accuse someone acting suspicious.",
            "Suggest skipping.",
            "Agree with the chat consensus."
        ];
        // Bias towards asking/accusing in round 2
        if (phase === 'followup') {
            myGoal = "Respond to questions or accusations. Determine who to vote for.";
        } else {
            myGoal = pickRandom(goals);
        }
    }

    let knowledge = "";

    // -- MEETING CONTEXT INJECTION --
    if (context) {
        knowledge += ` This meeting is for a ${context.type.replace('_', ' ')}. `;
        if (context.reporter) knowledge += `${context.reporter.name} reported it. `;
        if (context.victim) {
            const bodyRoomStr = roomName(context.bodyRoom);
            knowledge += `${context.victim.name} died in ${bodyRoomStr}. `;

            // PROXIMITY EVIDENCE
            const bodySeenTime = context.time || Date.now();
            const suspiciousSightings = bot.recentSightings.filter(s => {
                const timeDiff = Math.abs(bodySeenTime - s.time);
                const isNearBodyRoom = (s.room === context.bodyRoom) ||
                    (ADJACENT_ROOMS[context.bodyRoom]?.includes(s.room));
                return s.color !== bot.color && s.color !== context.victim?.color && isNearBodyRoom && timeDiff < 25000;
            });

            if (suspiciousSightings.length > 0) {
                knowledge += " PROXIMITY EVIDENCE: ";
                suspiciousSightings.forEach(s => {
                    knowledge += `You saw ${capName(s.color)} in ${roomName(s.room)} very recently. They are EXTREMELY suspicious. `;
                });
                myGoal = `Accuse ${capName(suspiciousSightings[0].color)} using your proximity evidence.`;
            }
        }
    }

    // -- MEETING HISTORY & PLAYER STATUS --
    let statusText = "";
    if (allBots) {
        const alive = allBots.filter(b => b.alive).map(b => b.name);
        const dead = allBots.filter(b => !b.alive).map(b => b.name);
        statusText = `ALIVE PLAYERS: ${alive.join(', ')}\nDEAD PLAYERS: ${dead.join(', ')}`;
    }

    const memoryText = `
${context.meetingHistory || ""}
${context.suspicionContext || ""}
${context.ejectionContext || ""}
`.trim();

    // -- STACK KILL / CROWD AWARENESS --
    // Check if we were in a crowd (stack)
    let crowd = [];
    if (bot.companions) {
        crowd = Object.values(bot.companions).filter(c => Date.now() - c.lastSeen < 5000 && c.duration > 2000);
    }

    if (crowd.length >= 2) {
        knowledge += ` You were hidden in a 'stack' with ${crowd.length} others (${crowd.map(c => capName(c.color)).join(', ')}). `;
    }

    if (context && context.stackKill) {
        knowledge += ` This was a STACK KILL. Multiple players were in the room. Even if you saw it, it's hard to be sure who did it. `;
    }

    // -- WITNESS LOGIC INJECTION --
    if (bot.sawKill) {
        const killerName = bot.sawKill.killer.name;
        const victimName = bot.sawKill.victim.name;
        knowledge += `CRITICAL: YOU SAW ${killerName} KILL ${victimName} IN ${roomName(bot.sawKill.room)}! SCREAM IT!`;
        myGoal = `ACCUSE ${killerName} WITH ALL CAPS!`;
    }

    // -- SOCIAL COMMAND AWARENESS --
    if (bot.isFollowingPlayer) {
        knowledge += " You are currently following the player because they told you to. ";
    }
    if (bot.campRoom) {
        knowledge += ` You are currently camping in ${roomName(bot.campRoom)} because the player told you to. `;
    }

    // -- EXTRA ROLES INJECTION --
    if (bot.extraRole === 'scientist') {
        const aliveCount = allBots.filter(b => b.alive).length;
        knowledge += ` You are a SCIENTIST. Your vitals show ${aliveCount} players alive. If someone died, you might know! `;
    } else if (bot.extraRole === 'detective') {
        const history = bot.locationHistory.slice(0, 3).map(h => roomName(h.room)).join(' then ');
        knowledge += ` You are a DETECTIVE. Your logs show you were in ${history}. Use this to verify others. `;
    } else if (bot.extraRole === 'noisemaker') {
        knowledge += ` You are the NOISEMAKER. If you die, you will alert everyone to your location. `;
    } else if (bot.extraRole === 'tracker' && bot.trackedTarget) {
        const target = bot.trackedTarget;
        const targetRoom = getRoomAt(target.x, target.y) || 'unknown';
        knowledge += ` You are the TRACKER. You are tracking ${target.name}. They are currently in ${roomName(targetRoom)}. `;
    }

    // Role Revelation
    const askedRole = discussionLog.some(l => l.toLowerCase().includes("role") || l.toLowerCase().includes("what are you") || l.toLowerCase().includes("tell role"));
    if (askedRole) {
        if (bot.role === 'impostor') {
            knowledge += ` Someone asked about roles. LIE: say you are just a crewmate or a scientist. NEVER ADMIT TO BEING IMPOSTOR OR HAVING IMPOSTOR ROLES (Viper, Phantom, etc). `;
        } else if (bot.extraRole) {
            knowledge += ` Someone asked about roles. Reveal your role: ${bot.extraRole}. `;
        } else {
            knowledge += ` Someone asked about roles. Reveal your role: just a crewmate. `;
        }
    }

    // -- IMPOSTOR LOGIC INJECTION --
    if (bot.role === 'impostor') {
        const impostors = allBots.filter(b => b.role === 'impostor' && b.alive);
        const partner = impostors.find(p => p !== bot);

        myGoal = "Deflect suspicion. Blame crewmates. Lie.";
        if (partner) {
            knowledge += ` Your partner is ${partner.name}. Do NOT accuse them. Defend them if they are suspected. `;
        }

        // Shared fake alibi logic: if partner exists, "agree" on a room if they were "together"
        let alibiRoom = bot.snapshottedRoom || bot.currentRoom;

        // Coordination trick: Impostors might claim to have been together in the same fake room
        if (partner && Math.random() < 0.7) {
            // Pick partner's or own room to synchronize
            alibiRoom = (Math.random() > 0.5) ? (partner.snapshottedRoom || alibiRoom) : alibiRoom;
        }

        if (bot.extraRole === 'shapeshifter') {
            knowledge += ` You are the SHAPESHIFTER. You can turn into others. Use this to create confusion or frame people. `;
        } else if (bot.extraRole === 'phantom') {
            knowledge += ` You are the PHANTOM. You can turn invisible. `;
        }

        knowledge += `You are the IMPOSTOR. LIE about your location: say you were in ${roomName(alibiRoom)}. `;
        knowledge += `REALITY: You were actually just in ${roomName(bot.lastActualLocation)}. `;
        if (partner && alibiRoom === (partner.snapshottedRoom || partner.currentRoom)) {
            knowledge += ` You can claim you were WITH ${partner.name} in that room. `;
        }
        knowledge += `STRATEGY: Only tell the truth about your location if you have a clear alibi with a crewmate. Otherwise, LIE and say you were in ${roomName(alibiRoom)}. NEVER mention being in a vent or near a body you killed. `;

        // If someone accused us, defend!
        const accusedUs = discussionLog.some(l => l.toLowerCase().includes(bot.name.toLowerCase()) && (l.includes('sus') || l.includes('saw') || l.includes('kill')));
        if (accusedUs) {
            knowledge += " Someone accused you! DENIALLY defend yourself. Accuse them back.";
        }
    } else {
        // Crewmate alibi from snapshot
        const room = bot.snapshottedRoom ? roomName(bot.snapshottedRoom) : 'unknown';
        knowledge += `You were in ${room} at the time.`;

        if (bot.extraRole) knowledge += ` You are a ${bot.extraRole}. `;

        // Vouch for companions from snapshot
        if (bot.snapshottedCompanions && bot.snapshottedCompanions.length > 0) {
            const friends = bot.snapshottedCompanions.join(', ');
            knowledge += ` You were with ${friends}. They are clear (vouch for them).`;
        }

        // If someone accused us, defend!
        const accusedUs = discussionLog.some(l => l.toLowerCase().includes(bot.name.toLowerCase()) && (l.includes('sus') || l.includes('saw') || l.includes('kill')));
        if (accusedUs) {
            knowledge += " You were just accused! Deny it and tell them who you were with.";
        }
    }

    // Relaxed Goal Logic: Goals are now partial suggestions, not strict requirements.
    const goalText = myGoal ? `Optional Goal Suggestion: ${myGoal}. (Feel free to ignore this if the current chat log is more interesting to react to).` : "";

    // -- PROMPT CONSTRUCTION --
    const prompt = `
    GENERAL PLAYER STATUS:
    ${statusText}

    MEETING HISTORY & TRUST:
    ${memoryText}
    
    CURRENT CHAT LOG (READ CAREFULLY):
    ${discussionLog.join('\n')}
    
    You are ${bot.name} (${myRoleRaw.toUpperCase()}).
    Facts: ${knowledge}
    ${goalText}
    
    IMPORTANT: Respond naturally to the Chat Log. If someone asked you a question, answer it. If the chat is quiet, share a fact or suspicion. 
    Reference past meetings if relevant to your current suspicion or logic.
    Write your chat message (max 15 words).
    `;

    try {
        if (!isAIConnected()) throw new Error("Gemini AI not connected");

        console.log(`[AI] Calling Gemini (${bot.name}) with prompt snippet: ${prompt.substring(0, 100)}...`);

        const text = await geminiChat(prompt, baseSystemPrompt);

        console.log("[AI] Raw response:", text);

        if (text && text.length > 1) {
            // Clean up quotes
            let cleaned = text.replace(/^["']|["']$/g, '').trim();
            if (cleaned.toLowerCase().startsWith(bot.name.toLowerCase() + ':')) {
                cleaned = cleaned.substring(bot.name.length + 1).trim();
            }
            return cleaned;
        }
        throw new Error("Invalid or empty AI response");

    } catch (err) {
        console.warn(`[AI] ${bot.name} fallback triggered:`, err.message);

        // Use existing template generator if AI fails
        if (typeof generateDiscussionMessages === 'function') {
            const fallbackMsgs = generateDiscussionMessages(allBots, context, gameState);
            // Find a message for THIS bot if possible, otherwise first
            const myMsg = fallbackMsgs.find(m => m.bot.color === bot.color) || fallbackMsgs[0];
            return myMsg?.text || "Skip?";
        }

        return "Where?";
    }
}
