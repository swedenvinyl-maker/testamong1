// pathfinding.js — A* pathfinding on waypoint graph

function heuristic(a, b) {
    return Math.hypot(WAYPOINTS[a].x - WAYPOINTS[b].x, WAYPOINTS[a].y - WAYPOINTS[b].y);
}

function getEdgeCost(a, b) {
    return Math.hypot(WAYPOINTS[a].x - WAYPOINTS[b].x, WAYPOINTS[a].y - WAYPOINTS[b].y);
}

function findPath(startWP, endWP) {
    if (startWP === endWP) return [startWP];

    const openSet = new Set([startWP]);
    const cameFrom = {};
    const gScore = {};
    const fScore = {};

    for (let i = 0; i < WAYPOINTS.length; i++) {
        gScore[i] = Infinity;
        fScore[i] = Infinity;
    }
    gScore[startWP] = 0;
    fScore[startWP] = heuristic(startWP, endWP);

    while (openSet.size > 0) {
        // Find node in openSet with lowest fScore
        let current = null;
        let lowestF = Infinity;
        for (const node of openSet) {
            if (fScore[node] < lowestF) {
                lowestF = fScore[node];
                current = node;
            }
        }

        if (current === endWP) {
            // Reconstruct path
            const path = [current];
            while (cameFrom[current] !== undefined) {
                current = cameFrom[current];
                path.unshift(current);
            }
            return path;
        }

        openSet.delete(current);
        const neighbors = WAYPOINT_EDGES[current] || [];

        for (const neighbor of neighbors) {
            const tentativeG = gScore[current] + getEdgeCost(current, neighbor);
            if (tentativeG < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeG;
                fScore[neighbor] = tentativeG + heuristic(neighbor, endWP);
                openSet.add(neighbor);
            }
        }
    }

    // No path found
    return null;
}

function findPathBetweenPoints(startX, startY, endX, endY) {
    const startWP = findNearestWaypoint(startX, startY);
    const endWP = findNearestWaypoint(endX, endY);
    const path = findPath(startWP, endWP);
    if (!path) return null;
    return path.map(id => ({ x: WAYPOINTS[id].x, y: WAYPOINTS[id].y }));
}
