/* =========================================================
   INTELLIGENT NETWORK ROUTING SIMULATOR
   Frontend controller
========================================================= */


/* =========================================================
   NETWORK DATA
========================================================= */

let nodes = ["A", "B", "C", "D"];

let edges = [
    { source: "A", destination: "B", weight: 4, latency: 0, capacity: 100, trafficLevel: "LOW", disabled: false },
    { source: "A", destination: "C", weight: 2, latency: 0, capacity: 100, trafficLevel: "LOW", disabled: false },
    { source: "C", destination: "B", weight: 1, latency: 0, capacity: 100, trafficLevel: "LOW", disabled: false },
    { source: "B", destination: "D", weight: 3, latency: 0, capacity: 100, trafficLevel: "LOW", disabled: false },
    { source: "C", destination: "D", weight: 7, latency: 0, capacity: 100, trafficLevel: "LOW", disabled: false }
];

let directed = true;
let useTraffic = false;
let failedNodes = [];

let routingHistory = [];
let pathCount = 0;

/* Animation state */
let animFrames = [];
let animIndex = 0;
let animTimer = null;
let lastResult = null;

/* Autopilot / monitoring state */
let scenarios = [];
let rerouteLog = [];
let monitorTimer = null;

/* Live analytics time-series (session) */
let analyticsSeries = { utilization: [], latency: [] };


/* =========================================================
   ALGORITHM METADATA
========================================================= */

const ALGO_INFO = {
    DIJKSTRA: { name: "Dijkstra's Algorithm", desc: "Greedy minimum-cost route with a priority queue." },
    BFS: { name: "Breadth-First Search", desc: "Finds the route with the fewest hops." },
    BELLMAN_FORD: { name: "Bellman-Ford", desc: "Relaxation-based; handles weighted graphs." },
    A_STAR: { name: "A* Search", desc: "Heuristic-guided search for faster exploration." },
    FLOYD_WARSHALL: { name: "Floyd-Warshall", desc: "Computes all-pairs shortest paths." }
};


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    applyStoredTheme();

    setupEnterKey();

    renderNodeControls();
    renderEdgeTable();
    renderHistory();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();

    refreshHealthIndicator();
    loadSavedList();
    loadScenarios();
});


/* =========================================================
   THEME / DARK MODE
========================================================= */

function toggleTheme() {

    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("rs-theme", isDark ? "dark" : "light");

    const icon = document.querySelector("#themeToggle i");
    if (icon) {
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
}

function applyStoredTheme() {

    if (localStorage.getItem("rs-theme") === "dark") {
        document.body.classList.add("dark");
        const icon = document.querySelector("#themeToggle i");
        if (icon) icon.className = "fa-solid fa-sun";
    }
}


/* =========================================================
   MENU
========================================================= */

const menuButton = document.getElementById("menuBtn");

if (menuButton) {
    menuButton.addEventListener("click", function () {
        document.getElementById("sidebar").classList.toggle("open");
    });
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === pageId);
    });

    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");

    renderNodeControls();
    renderEdgeTable();
    renderHistory();
    updateStatistics();

    if (pageId === "graph") renderNetworkGraph();
    if (pageId === "dashboard") { renderDashboardGraph(); refreshHealthIndicator(); }
    if (pageId === "shortest-path") renderRouteGraph();
    if (pageId === "traffic") renderTrafficTable();
    if (pageId === "failure") { renderFailureLists(); renderNetworkGraph(); }
    if (pageId === "autopilot") initAutopilot();
    if (pageId === "analytics") loadAnalytics();
    if (pageId === "saved") loadSavedList();
}


/* =========================================================
   ALGORITHM SELECTOR
========================================================= */

function currentAlgorithm() {
    const select = document.getElementById("globalAlgorithm");
    return select ? select.value : "DIJKSTRA";
}

function onAlgorithmChange() {

    const algo = currentAlgorithm();
    const info = ALGO_INFO[algo] || ALGO_INFO.DIJKSTRA;

    const name = document.getElementById("algoInfoName");
    const desc = document.getElementById("algoInfoDesc");
    if (name) name.textContent = info.name;
    if (desc) desc.textContent = info.desc;
}


/* =========================================================
   ADD NODE
========================================================= */

function addNode() {

    const input = document.getElementById("newNodeName");
    if (!input) return;

    const node = input.value.trim().toUpperCase();

    if (!node) {
        showNodeMessage("Please enter a node name.", "error");
        return;
    }

    if (!/^[A-Z0-9_-]+$/.test(node)) {
        showNodeMessage("Use letters, numbers, hyphen or underscore.", "error");
        return;
    }

    if (nodes.includes(node)) {
        showNodeMessage(`Node ${node} already exists.`, "error");
        return;
    }

    nodes.push(node);
    nodes.sort(naturalSort);
    input.value = "";

    renderNodeControls();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast(`Node ${node} added`);
}


/* =========================================================
   REMOVE NODE
========================================================= */

function removeNode(node) {

    if (!confirm(`Delete node ${node} and all connected edges?`)) return;

    nodes = nodes.filter(item => item !== node);
    edges = edges.filter(edge => edge.source !== node && edge.destination !== node);
    failedNodes = failedNodes.filter(item => item !== node);

    renderNodeControls();
    renderEdgeTable();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast(`Node ${node} removed`);
}


/* =========================================================
   NODE CONTROLS
========================================================= */

function renderNodeControls() {

    const nodeList = document.getElementById("nodeList");

    if (nodeList) {

        nodeList.innerHTML = "";

        nodes.forEach(node => {

            const wrapper = document.createElement("div");
            wrapper.className = "node-chip";

            wrapper.innerHTML = `
                <span class="node-chip-circle">${escapeHtml(node.charAt(0))}</span>
                <span>${escapeHtml(node)}</span>
                <button type="button" title="Delete node"
                    onclick="removeNode('${escapeAttribute(node)}')"
                    style="border:0;background:transparent;color:#dc2626;cursor:pointer;margin-left:3px;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            nodeList.appendChild(wrapper);
        });
    }

    updateNodeSelect("edgeSource");
    updateNodeSelect("edgeDestination");
    updateNodeSelect("source");
    updateNodeSelect("destination");

    const badge = document.getElementById("nodeBadge");
    if (badge) {
        badge.textContent = `${nodes.length} Node${nodes.length === 1 ? "" : "s"}`;
    }
}


function updateNodeSelect(id) {

    const select = document.getElementById(id);
    if (!select) return;

    const oldValue = select.value;
    select.innerHTML = "";

    nodes.forEach(node => {
        const option = document.createElement("option");
        option.value = node;
        option.textContent = node;
        select.appendChild(option);
    });

    if (nodes.includes(oldValue)) select.value = oldValue;
}


/* =========================================================
   ADD EDGE
========================================================= */

function addEdge() {

    const sourceElement = document.getElementById("edgeSource");
    const destinationElement = document.getElementById("edgeDestination");
    const weightElement = document.getElementById("edgeWeight");
    const latencyElement = document.getElementById("edgeLatency");
    const capacityElement = document.getElementById("edgeCapacity");
    const trafficElement = document.getElementById("edgeTraffic");

    if (!sourceElement || !destinationElement || !weightElement) return;

    const source = sourceElement.value;
    const destination = destinationElement.value;
    const weight = Number(weightElement.value);
    const latency = Number(latencyElement ? latencyElement.value : 0);
    const capacity = Number(capacityElement ? capacityElement.value : 100);
    const trafficLevel = trafficElement ? trafficElement.value : "LOW";

    if (!source || !destination) {
        showEdgeMessage("Select source and destination.", "error");
        return;
    }

    if (source === destination) {
        showEdgeMessage("Source and destination cannot be the same.", "error");
        return;
    }

    if (!Number.isFinite(weight) || weight < 0) {
        showEdgeMessage("Enter a valid non-negative weight.", "error");
        return;
    }

    const duplicate = edges.some(edge => edge.source === source && edge.destination === destination);
    if (duplicate) {
        showEdgeMessage("This edge already exists.", "error");
        return;
    }

    edges.push({
        source: source,
        destination: destination,
        weight: weight,
        latency: Number.isFinite(latency) && latency >= 0 ? latency : 0,
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 100,
        trafficLevel: trafficLevel,
        disabled: false
    });

    weightElement.value = "";

    renderEdgeTable();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast(`Edge ${source} → ${destination} added`);
}


/* =========================================================
   DELETE EDGE
========================================================= */

function deleteEdge(index) {

    if (index < 0 || index >= edges.length) return;

    const edge = edges[index];
    edges.splice(index, 1);

    renderEdgeTable();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast(`Edge ${edge.source} → ${edge.destination} deleted`);
}


/* =========================================================
   EDGE TABLE
========================================================= */

function renderEdgeTable() {

    const tbody = document.getElementById("edgeTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (edges.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No edges created yet.</td></tr>`;
        return;
    }

    edges.forEach((edge, index) => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td><span class="table-node">${escapeHtml(edge.source)}</span></td>
            <td><span class="table-node">${escapeHtml(edge.destination)}</span></td>
            <td>${edge.weight}</td>
            <td>${edge.latency || 0} ms</td>
            <td>${trafficBadge(edge.trafficLevel)}</td>
            <td>
                <button class="delete-button" onclick="deleteEdge(${index})" title="Delete edge">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}


function trafficBadge(level) {

    const key = (level || "LOW").toUpperCase();
    const label = key.charAt(0) + key.slice(1).toLowerCase();
    return `<span class="traffic-badge ${key.toLowerCase()}">${label}</span>`;
}


/* =========================================================
   DIRECTED MODE
========================================================= */

function toggleDirected() {

    const toggle = document.getElementById("directedToggle");
    directed = toggle ? toggle.checked : true;

    const label = document.getElementById("directedLabel");
    if (label) label.textContent = directed ? "Directed" : "Undirected";

    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast(directed ? "Directed mode" : "Undirected mode");
}


/* =========================================================
   NETWORK TEMPLATES
========================================================= */

const TEMPLATES = {

    small: {
        nodes: ["A", "B", "C", "D"],
        edges: [
            { source: "A", destination: "B", weight: 4 },
            { source: "A", destination: "C", weight: 2 },
            { source: "C", destination: "B", weight: 1 },
            { source: "B", destination: "D", weight: 3 },
            { source: "C", destination: "D", weight: 7 }
        ]
    },

    campus: {
        nodes: ["Router", "Library", "Admin", "CSE", "Hostel", "Lab"],
        edges: [
            { source: "Router", destination: "Library", weight: 3 },
            { source: "Router", destination: "Admin", weight: 2 },
            { source: "Router", destination: "CSE", weight: 4 },
            { source: "Router", destination: "Hostel", weight: 5 },
            { source: "CSE", destination: "Lab", weight: 1 },
            { source: "Admin", destination: "Library", weight: 6 }
        ]
    },

    datacenter: {
        nodes: ["Core1", "Core2", "Agg1", "Agg2", "Web1", "Web2", "DB"],
        edges: [
            { source: "Core1", destination: "Core2", weight: 1 },
            { source: "Core1", destination: "Agg1", weight: 2 },
            { source: "Core2", destination: "Agg2", weight: 2 },
            { source: "Agg1", destination: "Web1", weight: 3 },
            { source: "Agg1", destination: "Web2", weight: 3 },
            { source: "Agg2", destination: "DB", weight: 4 },
            { source: "Agg2", destination: "Web2", weight: 5 }
        ]
    }
};

function loadTemplate(value) {

    if (!value) return;

    const template = TEMPLATES[value];
    if (!template) return;

    nodes = [...template.nodes];
    edges = template.edges.map(e => ({
        source: e.source,
        destination: e.destination,
        weight: e.weight,
        latency: e.latency || 0,
        capacity: e.capacity || 100,
        trafficLevel: e.trafficLevel || "LOW",
        disabled: false
    }));

    failedNodes = [];

    const select = document.getElementById("templateSelect");
    if (select) select.value = "";

    renderNodeControls();
    renderEdgeTable();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast("Example network loaded");
}


/* =========================================================
   IMPORT / EXPORT
========================================================= */

function exportNetwork() {

    const data = {
        nodes: nodes,
        directed: directed,
        edges: edges.map(e => ({
            source: e.source,
            destination: e.destination,
            weight: e.weight,
            latency: e.latency,
            capacity: e.capacity,
            trafficLevel: e.trafficLevel
        }))
    };

    downloadJson(data, "network.json");
    showToast("Network exported");
}

function importNetwork(event) {

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

        try {

            const data = JSON.parse(reader.result);

            if (Array.isArray(data.nodes)) nodes = data.nodes.map(String);

            if (Array.isArray(data.edges)) {
                edges = data.edges.map(e => ({
                    source: String(e.source),
                    destination: String(e.destination),
                    weight: Number(e.weight) || 0,
                    latency: Number(e.latency) || 0,
                    capacity: Number(e.capacity) || 100,
                    trafficLevel: (e.trafficLevel || "LOW").toUpperCase(),
                    disabled: false
                }));
            }

            if (typeof data.directed === "boolean") {
                directed = data.directed;
                const toggle = document.getElementById("directedToggle");
                if (toggle) toggle.checked = directed;
                const label = document.getElementById("directedLabel");
                if (label) label.textContent = directed ? "Directed" : "Undirected";
            }

            failedNodes = [];

            renderNodeControls();
            renderEdgeTable();
            updateStatistics();
            renderNetworkGraph();
            renderDashboardGraph();
            renderRouteGraph();
            refreshHealthIndicator();

            showToast("Network imported");

        } catch (err) {
            showToast("Invalid JSON file");
        }
    };

    reader.readAsText(file);
    event.target.value = "";
}



/* =========================================================
   EFFECTIVE COST (mirror of backend formula)
========================================================= */

function trafficPenalty(edge) {

    const w = Number(edge.weight) || 0;
    const level = (edge.trafficLevel || "LOW").toUpperCase();

    if (level === "HIGH") return Math.round(w * 0.8);
    if (level === "MEDIUM") return Math.round(w * 0.3);
    return 0;
}

function effectiveCost(edge) {

    return (Number(edge.weight) || 0) + trafficPenalty(edge) + (Number(edge.latency) || 0);
}

function activeCost(edge) {
    return useTraffic ? effectiveCost(edge) : (Number(edge.weight) || 0);
}

function isEdgeDown(edge) {
    return edge.disabled === true || failedNodes.includes(edge.source) || failedNodes.includes(edge.destination);
}


/* =========================================================
   REQUEST BUILDER
========================================================= */

function buildRequest(source, destination, algorithm) {

    return {
        nodes: nodes,
        edges: edges,
        source: source,
        destination: destination,
        algorithm: algorithm || currentAlgorithm(),
        directed: directed,
        useTraffic: useTraffic,
        failedNodes: failedNodes,
        failedEdges: []
    };
}

async function apiPost(url, body) {

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}


/* =========================================================
   FIND SHORTEST PATH
========================================================= */

async function findPath() {

    const sourceElement = document.getElementById("source");
    const destinationElement = document.getElementById("destination");
    const result = document.getElementById("result");
    const button = document.getElementById("findPathBtn");

    if (!sourceElement || !destinationElement || !result || !button) return;

    const source = sourceElement.value;
    const destination = destinationElement.value;

    if (!source || !destination) return;

    if (source === destination) {
        renderResult({
            found: true, path: [source], cost: 0, hops: 0,
            algorithm: currentAlgorithm(), executionTimeMs: 0, animation: []
        });
        return;
    }

    setLoading(button, result, true);

    const algorithm = currentAlgorithm();

    let data;

    try {
        data = await apiPost("/api/routing/shortest-path", buildRequest(source, destination, algorithm));
    } catch (err) {
        console.warn("Backend unavailable, using local engine.", err);
        data = localRoute(buildRequest(source, destination, algorithm));
    }

    setLoading(button, result, false);

    if (!data || !data.found) {

        result.className = "result";
        result.innerHTML = `
            <div class="result-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3>Path Not Found</h3>
            <p>${escapeHtml((data && data.message) || `No valid route between ${source} and ${destination}.`)}</p>
        `;

        renderRouteGraph();
        return;
    }

    lastResult = data;
    animFrames = data.animation || [];
    animIndex = 0;
    stopAutoPlay();

    pathCount++;
    addHistory(data);

    renderResult(data);
    renderHistory();
    updateStatistics();
    refreshHealthIndicator();

    renderRouteGraph(data.path);
    updateStepCounter();

    showToast("Route calculated");
}


function setLoading(button, result, loading) {

    button.disabled = loading;

    if (loading) {

        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Calculating...`;
        result.className = "result";
        result.innerHTML = `
            <div class="result-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
            <h3>Calculating Route</h3>
            <p>${escapeHtml((ALGO_INFO[currentAlgorithm()] || ALGO_INFO.DIJKSTRA).name)} is processing your network.</p>
        `;
    } else {
        button.innerHTML = `<i class="fa-solid fa-route"></i> Find Shortest Path`;
    }
}


/* =========================================================
   RESULT RENDER
========================================================= */

function renderResult(data) {

    const result = document.getElementById("result");
    if (!result) return;

    const algoKey = (data.algorithm || currentAlgorithm());
    const algoName = (ALGO_INFO[algoKey] || ALGO_INFO.DIJKSTRA).name;

    result.className = "result success";

    const m = data.metrics || localRouteMetrics(data.path || []);

    result.innerHTML = `
        <div class="result-icon"><i class="fa-solid fa-route"></i></div>
        <h3>Optimal Route Found</h3>
        <div class="result-path">${escapeHtml((data.path || []).join(" → "))}</div>

        <div class="result-meta">
            <span><b>Algorithm:</b> ${escapeHtml(algoName)}</span>
            <span><b>Cost:</b> ${data.cost}</span>
            <span><b>Hops:</b> ${data.hops}</span>
            <span><b>Time:</b> ${formatMs(data.executionTimeMs)}</span>
        </div>

        <div class="result-meta result-quality">
            <span><b>Latency:</b> ${m.totalLatencyMs} ms</span>
            <span><b>Capacity:</b> ${m.averageCapacity}%</span>
            <span><b>Traffic:</b> ${escapeHtml(m.trafficLevel)}</span>
        </div>
    `;

    const status = document.getElementById("animStatus");
    if (status && animFrames.length) {
        status.textContent = `Ready to animate ${animFrames.length} exploration steps.`;
    }

    renderDecision(data, m);
}


/* =========================================================
   INTELLIGENT ROUTE DECISION PANEL
========================================================= */

function renderDecision(data, metrics) {

    const card = document.getElementById("decisionCard");
    if (!card) return;

    const decision = data.decision || buildLocalDecision(data, metrics);

    const factorsList = document.getElementById("decisionFactors");
    const reasonsList = document.getElementById("decisionReasons");
    const metricsBox = document.getElementById("decisionMetrics");
    const trafficBadge = document.getElementById("decisionTrafficBadge");

    if (factorsList) {
        factorsList.innerHTML = (decision.factors || []).map(f => `
            <li class="${f.applied ? "on" : "off"}">
                <i class="fa-solid ${f.applied ? "fa-circle-check" : "fa-circle-minus"}"></i>
                ${escapeHtml(f.name)}
            </li>
        `).join("");
    }

    if (reasonsList) {
        reasonsList.innerHTML = (decision.reasons || []).map(r =>
            `<li>${escapeHtml(r)}</li>`).join("");
    }

    if (metricsBox) {
        metricsBox.innerHTML = `
            <div class="metric-tile"><span>Route</span><strong>${escapeHtml((data.path || []).join(" → "))}</strong></div>
            <div class="metric-tile"><span>Total Cost</span><strong>${data.cost}</strong></div>
            <div class="metric-tile"><span>Latency</span><strong>${metrics.totalLatencyMs} ms</strong></div>
            <div class="metric-tile"><span>Capacity</span><strong>${metrics.averageCapacity}%</strong></div>
        `;
    }

    if (trafficBadge) {
        trafficBadge.textContent = metrics.trafficLevel;
        trafficBadge.className = `badge traffic-${metrics.trafficLevel.toLowerCase()}`;
    }

    card.classList.remove("hidden");
}

function buildLocalDecision(data, metrics) {

    const anyLatency = edges.some(e => (e.latency || 0) > 0);
    const anyCapacity = edges.some(e => (e.capacity || 100) !== 100);
    const failureAware = failedNodes.length > 0 || edges.some(e => e.disabled);

    const factors = [
        { name: "Distance (base link cost)", applied: true },
        { name: "Latency weighting", applied: anyLatency },
        { name: "Traffic congestion penalty", applied: useTraffic },
        { name: "Link availability (failure bypass)", applied: failureAware },
        { name: "Link capacity awareness", applied: anyCapacity }
    ];

    const reasons = [`Lowest total cost (${data.cost}) across ${data.hops} hop(s).`];
    if (useTraffic) reasons.push("Traffic penalties included — congested links were deprioritized.");
    if (failureAware) reasons.push("Failed nodes/links excluded from the search space.");
    reasons.push(`End-to-end latency: ${metrics.totalLatencyMs} ms.`);

    return { factors, reasons };
}

function localRouteMetrics(path) {

    let latency = 0, bottleneck = Infinity, utilSum = 0, links = 0;
    let high = false, medium = false;

    for (let i = 0; i < path.length - 1; i++) {
        const edge = findEdgeBetween(path[i], path[i + 1]);
        if (!edge) continue;
        links++;
        latency += Number(edge.latency) || 0;
        bottleneck = Math.min(bottleneck, Number(edge.capacity) || 0);
        utilSum += utilFor(edge.trafficLevel);
        const level = (edge.trafficLevel || "LOW").toUpperCase();
        if (level === "HIGH") high = true;
        if (level === "MEDIUM") medium = true;
    }

    return {
        totalLatencyMs: latency,
        bottleneckCapacity: links === 0 ? 0 : bottleneck,
        averageCapacity: links === 0 ? 0 : Math.round(utilSum / links),
        trafficLevel: high ? "HIGH" : medium ? "MEDIUM" : "LOW"
    };
}

function findEdgeBetween(from, to) {
    return edges.find(e =>
        (e.source === from && e.destination === to) ||
        (!directed && e.source === to && e.destination === from));
}


function formatMs(value) {

    if (value === undefined || value === null) return "-";
    return `${Number(value).toFixed(2)} ms`;
}


/* =========================================================
   COMPARISON
========================================================= */

async function compareAlgorithms() {

    const sourceElement = document.getElementById("source");
    const destinationElement = document.getElementById("destination");

    if (!sourceElement || !destinationElement) return;

    const source = sourceElement.value;
    const destination = destinationElement.value;

    if (!source || !destination || source === destination) {
        showToast("Select two different nodes");
        return;
    }

    let results;

    try {
        results = await apiPost("/api/routing/compare", buildRequest(source, destination, null));
    } catch (err) {
        results = ["DIJKSTRA", "BFS", "BELLMAN_FORD", "A_STAR", "FLOYD_WARSHALL"]
            .map(a => localRoute(buildRequest(source, destination, a)));
    }

    const tbody = document.getElementById("compareTableBody");
    const card = document.getElementById("compareCard");

    if (tbody) {

        tbody.innerHTML = "";

        (results || []).forEach(r => {

            const info = ALGO_INFO[r.algorithm] || { name: r.algorithm };
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><strong>${escapeHtml(info.name)}</strong></td>
                <td class="path-text">${r.found ? escapeHtml((r.path || []).join(" → ")) : "No route"}</td>
                <td>${r.found ? r.cost : "-"}</td>
                <td>${r.found ? r.hops : "-"}</td>
                <td>${r.visitedNodes != null ? r.visitedNodes : "-"}</td>
                <td>${formatMs(r.executionTimeMs)}</td>
            `;

            tbody.appendChild(row);
        });
    }

    if (card) card.classList.remove("hidden");
    showToast("Comparison ready");
}


/* =========================================================
   STEP-BY-STEP ANIMATION
========================================================= */

function startAnimation() {

    if (!animFrames.length) {
        showToast("Run a route first");
        return;
    }

    stopAutoPlay();

    if (animIndex >= animFrames.length) animIndex = 0;

    animTimer = setInterval(() => {

        if (animIndex >= animFrames.length) {
            stopAutoPlay();
            finishAnimation();
            return;
        }

        applyAnimFrame(animFrames[animIndex]);
        animIndex++;
        updateStepCounter();

    }, 800);
}

function pauseAnimation() {
    stopAutoPlay();
    showToast("Paused");
}

function stepAnimation() {

    if (!animFrames.length) {
        showToast("Run a route first");
        return;
    }

    stopAutoPlay();

    if (animIndex < animFrames.length) {
        applyAnimFrame(animFrames[animIndex]);
        animIndex++;
        updateStepCounter();
    } else {
        finishAnimation();
    }
}

function resetAnimation() {

    stopAutoPlay();
    animIndex = 0;

    const status = document.getElementById("animStatus");
    if (status && animFrames.length) status.textContent = `Ready to animate ${animFrames.length} exploration steps.`;

    updateStepCounter();
    renderRouteGraph(lastResult ? lastResult.path : []);
}

function stopAutoPlay() {
    if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
    }
}

function finishAnimation() {

    if (lastResult && lastResult.found) {
        renderRouteGraph(lastResult.path);
        const status = document.getElementById("animStatus");
        if (status) status.textContent = "Complete. Final route highlighted.";
    }
}

function applyAnimFrame(frame) {

    renderRouteGraphWithFrame(frame);

    const status = document.getElementById("animStatus");
    if (status) status.textContent = frame.message || `Step ${frame.stepNumber}`;
}

function updateStepCounter() {

    const el = document.getElementById("stepCounter");
    if (el) el.textContent = `Step ${Math.min(animIndex, animFrames.length)} / ${animFrames.length}`;
}


/* =========================================================
   TRAFFIC SIMULATION
========================================================= */

function toggleTrafficMode() {

    const toggle = document.getElementById("useTrafficToggle");
    useTraffic = toggle ? toggle.checked : false;

    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    renderTrafficTable();
    refreshHealthIndicator();

    showToast(useTraffic ? "Traffic-aware routing ON" : "Traffic-aware routing OFF");
}

function renderTrafficTable() {

    const tbody = document.getElementById("trafficTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!edges.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No links yet.</td></tr>`;
        return;
    }

    edges.forEach((edge, index) => {

        const row = document.createElement("tr");

        const status = edge.trafficLevel === "HIGH"
            ? '<span class="status-tag congested">Congested</span>'
            : edge.trafficLevel === "MEDIUM"
                ? '<span class="status-tag busy">Busy</span>'
                : '<span class="status-tag clear">Clear</span>';

        row.innerHTML = `
            <td><span class="table-node">${escapeHtml(edge.source)}</span> →
                <span class="table-node">${escapeHtml(edge.destination)}</span></td>
            <td>${edge.weight}</td>
            <td>${edge.latency || 0} ms</td>
            <td>
                <select onchange="setEdgeTraffic(${index}, this.value)">
                    <option value="LOW" ${edge.trafficLevel === "LOW" ? "selected" : ""}>Low</option>
                    <option value="MEDIUM" ${edge.trafficLevel === "MEDIUM" ? "selected" : ""}>Medium</option>
                    <option value="HIGH" ${edge.trafficLevel === "HIGH" ? "selected" : ""}>High</option>
                </select>
            </td>
            <td><strong>${effectiveCost(edge)}</strong></td>
            <td>${status}</td>
        `;

        tbody.appendChild(row);
    });
}

function setEdgeTraffic(index, value) {

    if (!edges[index]) return;

    edges[index].trafficLevel = value;

    renderTrafficTable();
    renderEdgeTable();
    renderNetworkGraph();
    renderRouteGraph();
    refreshHealthIndicator();
}

function randomizeTraffic() {

    const levels = ["LOW", "LOW", "MEDIUM", "HIGH"];

    edges.forEach(edge => {
        edge.trafficLevel = levels[Math.floor(Math.random() * levels.length)];
    });

    renderTrafficTable();
    renderEdgeTable();
    renderNetworkGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    showToast("Traffic pattern changed");
}


/* =========================================================
   FAILURE SIMULATION
========================================================= */

function renderFailureLists() {

    const nodeList = document.getElementById("failureNodeList");
    const edgeList = document.getElementById("failureEdgeList");

    if (nodeList) {

        nodeList.innerHTML = "";

        nodes.forEach(node => {

            const down = failedNodes.includes(node);
            const chip = document.createElement("button");
            chip.className = `failure-chip ${down ? "down" : "up"}`;
            chip.innerHTML = `
                <span class="failure-dot"></span>
                ${escapeHtml(node)}
                <small>${down ? "Offline" : "Online"}</small>
            `;
            chip.onclick = () => toggleNodeFailure(node);
            nodeList.appendChild(chip);
        });
    }

    if (edgeList) {

        edgeList.innerHTML = "";

        edges.forEach((edge, index) => {

            const down = edge.disabled;
            const chip = document.createElement("button");
            chip.className = `failure-chip ${down ? "down" : "up"}`;
            chip.innerHTML = `
                <span class="failure-dot"></span>
                ${escapeHtml(edge.source)} → ${escapeHtml(edge.destination)}
                <small>${down ? "Down" : "Active"}</small>
            `;
            chip.onclick = () => toggleEdgeFailure(index);
            edgeList.appendChild(chip);
        });
    }
}

function toggleNodeFailure(node) {

    if (failedNodes.includes(node)) {
        failedNodes = failedNodes.filter(n => n !== node);
    } else {
        failedNodes.push(node);
    }

    renderFailureLists();
    renderNetworkGraph();
    renderRouteGraph();
    refreshHealthIndicator();
}

function toggleEdgeFailure(index) {

    if (!edges[index]) return;

    edges[index].disabled = !edges[index].disabled;

    renderFailureLists();
    renderNetworkGraph();
    renderRouteGraph();
    refreshHealthIndicator();
}

function clearFailures() {

    failedNodes = [];
    edges.forEach(edge => edge.disabled = false);

    renderFailureLists();
    renderNetworkGraph();
    renderRouteGraph();
    refreshHealthIndicator();

    const alert = document.getElementById("rerouteAlert");
    if (alert) alert.classList.add("hidden");

    showToast("All links restored");
}

async function recalculateAfterFailure() {

    const sourceElement = document.getElementById("source");
    const destinationElement = document.getElementById("destination");

    if (!sourceElement || !destinationElement) {
        showToast("Pick source & destination on the route page");
        return;
    }

    const source = sourceElement.value;
    const destination = destinationElement.value;

    let data;

    try {
        data = await apiPost("/api/routing/shortest-path", buildRequest(source, destination, currentAlgorithm()));
    } catch (err) {
        data = localRoute(buildRequest(source, destination, currentAlgorithm()));
    }

    lastResult = data;
    animFrames = data.animation || [];
    animIndex = 0;

    const alertBox = document.getElementById("rerouteAlert");
    const alertText = document.getElementById("rerouteAlertText");

    if (alertBox && alertText) {

        alertBox.classList.remove("hidden");

        if (data.found) {
            alertText.textContent = `⚠️ Failure detected · 🔄 Route recalculated: ${data.path.join(" → ")} (cost ${data.cost})`;
        } else {
            alertText.textContent = "⚠️ Failure isolated the network — no alternate route is available.";
        }
    }

    renderRouteGraph(data.found ? data.path : []);
    refreshHealthIndicator();

    showToast(data.found ? "Network rerouted" : "No route available");
}


/* =========================================================
   ANALYTICS + HEALTH
========================================================= */

function computeLocalAnalytics() {

    const failedCount = edges.filter(isEdgeDown).length;
    const congested = edges.filter(e => e.trafficLevel === "HIGH" && !isEdgeDown(e)).length;
    const warning = edges.filter(e => e.trafficLevel === "MEDIUM" && !isEdgeDown(e)).length;

    const active = edges.filter(e => !isEdgeDown(e));

    const avgLatency = active.length
        ? active.reduce((s, e) => s + (Number(e.latency) || 0), 0) / active.length
        : 0;

    const avgCost = active.length
        ? active.reduce((s, e) => s + activeCost(e), 0) / active.length
        : 0;

    const utilization = active.length
        ? active.reduce((s, e) => s + utilFor(e.trafficLevel), 0) / active.length
        : 0;

    const n = nodes.length;
    const density = n < 2 ? 0
        : directed ? edges.length / (n * (n - 1))
            : (2 * edges.length) / (n * (n - 1));

    let health = "HEALTHY";
    let message = "All links operating normally.";

    if (failedNodes.length || failedCount > 0 || utilization >= 75) {
        health = "CRITICAL";
        message = "Network critical: failures or heavy congestion detected.";
    } else if (congested > 0 || utilization >= 55) {
        health = "WARNING";
        message = "Network degraded: congested links detected.";
    }

    // Composite health score (mirrors backend AnalyticsService)
    const healthyLinks = edges.filter(e => !isEdgeDown(e)).length;
    let score = 100;
    score -= Math.min(45, failedCount * 9);
    score -= Math.min(25, failedNodes.length * 12);
    score -= Math.min(24, congested * 6);
    score -= Math.min(10, warning * 2);
    score -= Math.min(10, avgLatency / 20);
    score -= Math.min(10, Math.max(0, utilization - 50) / 5);
    const healthScore = Math.round(Math.max(5, Math.min(100, score)));
    const healthStatus = healthScore >= 80 ? "Healthy"
        : healthScore >= 55 ? "Warning" : "Critical";

    return {
        health, message,
        healthScore, healthStatus,
        healthyLinks,
        totalNodes: nodes.length,
        activeNodes: nodes.length - failedNodes.length,
        totalEdges: edges.length,
        activeConnections: edges.length - failedCount,
        congestedLinks: congested,
        highTrafficLinks: congested,
        warningLinks: warning,
        failedLinks: failedCount,
        failedNodes: failedNodes.length,
        averageEffectiveCost: Math.round(avgCost * 10) / 10,
        averageLatency: Math.round(avgLatency * 10) / 10,
        networkDensity: Math.round(density * 1000) / 10,
        utilization: Math.round(utilization)
    };
}

function utilFor(level) {
    const key = (level || "LOW").toUpperCase();
    if (key === "HIGH") return 85;
    if (key === "MEDIUM") return 55;
    return 15;
}

async function loadAnalytics() {

    let a;

    try {
        a = await apiPost("/api/routing/analytics", buildRequest(null, null, currentAlgorithm()));
        if (a.healthScore == null) Object.assign(a, applyLocalScore(a));
    } catch (err) {
        a = computeLocalAnalytics();
    }

    renderHealth(a);
    renderAnalyticsGrid(a);
    renderHealthScore(a);
    recordAnalytics(a);
    updateHealthIndicator(a);
}

function applyLocalScore(a) {
    const local = computeLocalAnalytics();
    return {
        healthScore: local.healthScore,
        healthStatus: local.healthStatus,
        healthyLinks: local.healthyLinks,
        highTrafficLinks: local.highTrafficLinks
    };
}

/* ---- Health score ring + breakdown ---- */

function renderHealthScore(a) {

    const score = a.healthScore != null ? a.healthScore : computeLocalAnalytics().healthScore;
    const status = a.healthStatus || (score >= 80 ? "Healthy" : score >= 55 ? "Warning" : "Critical");

    const value = document.getElementById("healthScoreValue");
    const fill = document.getElementById("ringFill");
    const statusText = document.getElementById("healthStatusText");
    const breakdown = document.getElementById("healthBreakdown");

    if (value) value.textContent = `${score}%`;

    if (fill) {
        const circumference = 2 * Math.PI * 52;
        const offset = circumference * (1 - score / 100);
        fill.style.strokeDasharray = `${circumference}`;
        fill.style.strokeDashoffset = `${offset}`;
        if (fill.setAttribute) fill.setAttribute("class", `ring-fill ${status.toLowerCase()}`);
    }

    if (statusText) {
        const icon = status === "Healthy" ? "🟢" : status === "Warning" ? "🟡" : "🔴";
        statusText.textContent = `${icon} ${status}`;
        statusText.className = `health-status-text ${status.toLowerCase()}`;
    }

    if (breakdown) {
        const rows = [
            { label: "Healthy Links", value: a.healthyLinks != null ? a.healthyLinks : "-" },
            { label: "High Traffic", value: a.highTrafficLinks != null ? a.highTrafficLinks : a.congestedLinks },
            { label: "Failed Links", value: a.failedLinks },
            { label: "Average Latency", value: `${a.averageLatency} ms` },
            { label: "Network Load", value: `${a.utilization}%` }
        ];
        breakdown.innerHTML = rows.map(r => `
            <div class="hb-row">
                <span>${r.label}</span>
                <strong>${r.value}</strong>
            </div>
        `).join("");
    }
}

/* ---- Live analytics time-series + charts ---- */

function recordAnalytics(a) {

    analyticsSeries.utilization.push(a.utilization || 0);
    analyticsSeries.latency.push(a.averageLatency || 0);

    if (analyticsSeries.utilization.length > 30) {
        analyticsSeries.utilization = analyticsSeries.utilization.slice(-30);
        analyticsSeries.latency = analyticsSeries.latency.slice(-30);
    }

    drawSparkline("chartTraffic", analyticsSeries.utilization, "#3b82f6", 100);
    drawSparkline("chartLatency", analyticsSeries.latency, "#f59e0b",
        Math.max(10, ...analyticsSeries.latency));
}

function drawSparkline(canvasId, data, color, maxHint) {

    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height, pad = 16;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(120,130,150,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    if (!data.length) return;

    const max = Math.max(maxHint, ...data) || 1;
    const step = data.length > 1 ? (w - 2 * pad) / (data.length - 1) : 0;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = pad + i * step;
        const y = h - pad - (v / max) * (h - 2 * pad);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    const lastX = pad + (data.length - 1) * step;
    const lastY = h - pad - (data[data.length - 1] / max) * (h - 2 * pad);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();
}

function renderHealth(a) {

    const banner = document.getElementById("healthBanner");
    const dot = document.getElementById("healthDot");
    const title = document.getElementById("healthTitle");
    const message = document.getElementById("healthMessage");
    const fill = document.getElementById("utilFill");
    const utilText = document.getElementById("utilText");

    const key = (a.health || "HEALTHY").toLowerCase();

    if (banner) banner.className = `health-banner ${key}`;
    if (dot) dot.className = `health-dot ${key}`;
    if (title) title.textContent =
        a.health === "CRITICAL" ? "Network Critical" :
            a.health === "WARNING" ? "Network Warning" : "Network Healthy";
    if (message) message.textContent = a.healthMessage || a.message || "";

    if (fill) {
        fill.style.width = `${a.utilization || 0}%`;
        fill.className = `util-fill ${key}`;
    }
    if (utilText) utilText.textContent = `${a.utilization || 0}%`;
}

function renderAnalyticsGrid(a) {

    const grid = document.getElementById("analyticsGrid");
    if (!grid) return;

    const cards = [
        { label: "Active Nodes", value: `${a.activeNodes}/${a.totalNodes}`, icon: "circle-nodes", color: "blue" },
        { label: "Active Links", value: `${a.activeConnections}/${a.totalEdges}`, icon: "share-nodes", color: "purple" },
        { label: "Avg Path Cost", value: a.averageEffectiveCost, icon: "gauge", color: "green" },
        { label: "Avg Latency", value: `${a.averageLatency} ms`, icon: "stopwatch", color: "orange" },
        { label: "Network Density", value: `${a.networkDensity}%`, icon: "density-large", color: "blue" },
        { label: "Congested Links", value: a.congestedLinks, icon: "traffic-light", color: "orange" },
        { label: "Failed Links", value: a.failedLinks, icon: "plug-circle-xmark", color: "red" },
        { label: "Utilization", value: `${a.utilization}%`, icon: "battery-three-quarters", color: "green" }
    ];

    grid.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-icon ${c.color}">
                <i class="fa-solid fa-${c.icon}"></i>
            </div>
            <div>
                <span>${c.label}</span>
                <strong>${c.value}</strong>
                <small>Live metric</small>
            </div>
        </div>
    `).join("");
}

function refreshHealthIndicator() {

    const a = computeLocalAnalytics();
    renderHealth(a);
    updateHealthIndicator(a);
}

function updateHealthIndicator(a) {

    a = a || computeLocalAnalytics();

    const status = document.getElementById("systemStatus");
    const dot = status ? status.querySelector(".status-dot") : null;
    const text = document.getElementById("systemStatusText");

    const key = (a.health || "HEALTHY").toLowerCase();
    if (dot) dot.className = `status-dot ${key}`;
    if (text) text.textContent =
        a.health === "CRITICAL" ? "Network Critical" :
            a.health === "WARNING" ? "Network Warning" : "Network Healthy";
}


/* =========================================================
   EXPORT REPORT
========================================================= */

async function exportReport() {

    let a;
    try {
        a = await apiPost("/api/routing/analytics", buildRequest(null, null, currentAlgorithm()));
        if (a.healthScore == null) Object.assign(a, applyLocalScore(a));
    } catch (err) {
        a = computeLocalAnalytics();
    }

    const route = lastResult && lastResult.found
        ? (lastResult.path || []).join(" -> ")
        : "None computed";
    const algo = lastResult
        ? (ALGO_INFO[lastResult.algorithm] || { name: lastResult.algorithm }).name
        : currentAlgorithm();
    const metrics = lastResult && lastResult.found
        ? (lastResult.metrics || localRouteMetrics(lastResult.path || []))
        : { totalLatencyMs: 0, averageCapacity: 0, trafficLevel: "N/A" };

    const lines = [];
    lines.push("======================================");
    lines.push("   NETWORK ROUTING REPORT");
    lines.push("======================================");
    lines.push(`Generated:        ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push(`Network Health:   ${a.healthScore}% (${a.healthStatus})`);
    lines.push("");
    lines.push(`Nodes:            ${a.totalNodes}`);
    lines.push(`Links:            ${a.totalEdges}`);
    lines.push(`Healthy Links:    ${a.healthyLinks}`);
    lines.push(`Failed Links:     ${a.failedLinks}`);
    lines.push(`High Traffic:     ${a.highTrafficLinks}`);
    lines.push(`Avg Latency:      ${a.averageLatency} ms`);
    lines.push(`Network Load:     ${a.utilization}%`);
    lines.push("");
    lines.push(`Selected Algorithm: ${algo}`);
    lines.push(`Current Route:      ${route}`);
    lines.push(`Total Cost:         ${lastResult && lastResult.found ? lastResult.cost : "-"}`);
    lines.push(`Latency:            ${metrics.totalLatencyMs} ms`);
    lines.push(`Capacity:           ${metrics.averageCapacity}%`);
    lines.push(`Traffic:            ${metrics.trafficLevel}`);
    lines.push("");
    lines.push(`Rerouting Events:   ${rerouteLog.length}`);
    rerouteLog.slice(0, 10).forEach(e =>
        lines.push(`   ${e.time}  [${e.trigger}]  ${e.oldPath}  =>  ${e.newPath}`));
    lines.push("");
    lines.push("--- Recent Routing History ---");
    routingHistory.slice(0, 10).forEach((h, i) =>
        lines.push(`${i + 1}. ${(h.path || []).join(" -> ")}  cost=${h.cost}  [${h.condition || "Normal"}]`));
    lines.push("======================================");

    const text = lines.join("\n");

    // Full structured JSON alongside the human report
    downloadJson({
        generatedAt: new Date().toISOString(),
        directed: directed,
        trafficAwareRouting: useTraffic,
        network: { nodes: nodes, edges: edges, failedNodes: failedNodes },
        analytics: a,
        currentRoute: lastResult,
        rerouteEvents: rerouteLog,
        routingHistory: routingHistory.slice(0, 20)
    }, "routing-report.json");

    downloadText(text, "routing-report.txt");
    showToast("Report downloaded");
}

function downloadText(content, filename) {

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}


/* =========================================================
   HISTORY
========================================================= */

function addHistory(data) {

    routingHistory.unshift({
        source: data.source,
        destination: data.destination,
        algorithm: (ALGO_INFO[data.algorithm] || { name: data.algorithm }).name,
        path: [...(data.path || [])],
        cost: data.cost,
        hops: data.hops,
        executionTimeMs: data.executionTimeMs,
        condition: detectCondition(data),
        date: new Date()
    });

    if (routingHistory.length > 50) routingHistory = routingHistory.slice(0, 50);
}

function detectCondition(data) {

    if (failedNodes.length > 0 || edges.some(e => e.disabled)) {
        return "Link Failure";
    }
    const metrics = data.metrics || localRouteMetrics(data.path || []);
    if (metrics.trafficLevel === "HIGH") return "High Traffic";
    if (metrics.trafficLevel === "MEDIUM") return "Medium Traffic";
    return "Normal";
}

function conditionBadge(condition) {
    const key = (condition || "Normal").toLowerCase().replace(/\s+/g, "-");
    return `<span class="cond-badge cond-${key}">${escapeHtml(condition || "Normal")}</span>`;
}

function renderHistory() {

    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!routingHistory.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No routing history yet.</td></tr>`;
        return;
    }

    routingHistory.forEach((item, index) => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(item.source)}</td>
            <td>${escapeHtml(item.destination)}</td>
            <td>${escapeHtml(item.algorithm || "Dijkstra")}</td>
            <td class="path-text">${escapeHtml((item.path || []).join(" → "))}</td>
            <td><span class="cost-badge">${escapeHtml(String(item.cost))}</span></td>
            <td>${conditionBadge(item.condition)}</td>
            <td>${formatDate(item.date)}</td>
        `;

        tbody.appendChild(row);
    });
}

function clearHistory() {

    routingHistory = [];
    pathCount = 0;

    renderHistory();
    updateStatistics();

    fetch("/api/networks/history", { method: "DELETE" }).catch(() => {});

    showToast("Routing history cleared");
}


/* =========================================================
   SAVE / LOAD NETWORKS (MySQL)
========================================================= */

async function saveCurrentGraph() {

    const nameEl = document.getElementById("saveNetworkName");
    const name = nameEl && nameEl.value.trim()
        ? nameEl.value.trim()
        : `Network ${new Date().toLocaleTimeString()}`;

    const payload = {
        name: name,
        directed: directed,
        nodes: nodes,
        edges: edges.map(e => ({
            source: e.source, destination: e.destination, weight: e.weight,
            latency: e.latency, capacity: e.capacity, trafficLevel: e.trafficLevel
        }))
    };

    try {
        const response = await fetch("/api/networks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        if (nameEl) nameEl.value = "";
        showToast(`Saved "${name}" to MySQL`);
        loadSavedList();

    } catch (err) {
        console.error(err);
        showToast("Could not save — is MySQL running?");
    }
}

async function loadSavedList() {

    const container = document.getElementById("savedList");
    if (!container) return;

    try {

        const response = await fetch("/api/networks");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const list = await response.json();

        if (!list.length) {
            container.innerHTML = `<div class="empty-inline">No saved networks yet.</div>`;
            updateSavedCount(0);
            return;
        }

        container.innerHTML = list.map(n => `
            <div class="saved-item">
                <div>
                    <strong>${escapeHtml(n.name)}</strong>
                    <small>${escapeHtml(n.createdAt || "")} · ${n.directed ? "Directed" : "Undirected"}</small>
                </div>
                <div class="saved-actions">
                    <button class="btn small primary" onclick="loadSavedNetwork(${n.id})">Load</button>
                    <button class="delete-button" onclick="deleteSavedNetwork(${n.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join("");

        updateSavedCount(list.length);

    } catch (err) {
        container.innerHTML = `<div class="empty-inline">MySQL not reachable. Start the database to enable save/load.</div>`;
        updateSavedCount(0);
    }
}

async function loadSavedNetwork(id) {

    try {

        const response = await fetch(`/api/networks/${id}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        nodes = data.nodes || [];
        edges = (data.edges || []).map(e => ({
            source: e.source,
            destination: e.destination,
            weight: Number(e.weight) || 0,
            latency: Number(e.latency) || 0,
            capacity: Number(e.capacity) || 100,
            trafficLevel: (e.trafficLevel || "LOW").toUpperCase(),
            disabled: false
        }));

        directed = data.directed !== false;
        const toggle = document.getElementById("directedToggle");
        if (toggle) toggle.checked = directed;
        const label = document.getElementById("directedLabel");
        if (label) label.textContent = directed ? "Directed" : "Undirected";

        failedNodes = [];

        renderNodeControls();
        renderEdgeTable();
        updateStatistics();
        renderNetworkGraph();
        renderDashboardGraph();
        renderRouteGraph();
        refreshHealthIndicator();

        showPage("graph");
        showToast(`Loaded "${data.name}"`);

    } catch (err) {
        showToast("Could not load network");
    }
}

async function deleteSavedNetwork(id) {

    try {
        await fetch(`/api/networks/${id}`, { method: "DELETE" });
        showToast("Network deleted");
        loadSavedList();
    } catch (err) {
        showToast("Delete failed");
    }
}

function updateSavedCount(count) {

    // Dashboard "Saved Graphs" card (4th stat card strong element)
    const cards = document.querySelectorAll(".stats-grid .stat-card strong");
    if (cards.length >= 4) cards[3].textContent = count;
}


/* =========================================================
   NODE DETAIL MODAL
========================================================= */

function openNodeModal(node) {

    const modal = document.getElementById("nodeModal");
    const title = document.getElementById("nodeModalTitle");
    const body = document.getElementById("nodeModalBody");

    if (!modal || !body) return;

    const incoming = edges.filter(e => e.destination === node && !isEdgeDown(e));
    const outgoing = edges.filter(e => e.source === node && !isEdgeDown(e));
    const online = !failedNodes.includes(node);

    const traffic = edges.filter(e => e.source === node || e.destination === node);
    const avgTraffic = traffic.length
        ? Math.round(traffic.reduce((s, e) => s + utilFor(e.trafficLevel), 0) / traffic.length)
        : 0;

    title.textContent = `Node ${node}`;

    body.innerHTML = `
        <div class="detail-row">
            <span>Status</span>
            <strong class="${online ? "ok" : "bad"}">${online ? "Online" : "Offline"}</strong>
        </div>
        <div class="detail-row">
            <span>Connections</span>
            <strong>${incoming.length + outgoing.length}</strong>
        </div>
        <div class="detail-row">
            <span>Traffic</span>
            <strong>${avgTraffic}%</strong>
        </div>
        <div class="detail-section">
            <h4>Incoming</h4>
            ${incoming.length ? incoming.map(e => `<div class="mini-link">${escapeHtml(e.source)} → ${escapeHtml(node)}</div>`).join("") : '<div class="mini-link muted">None</div>'}
        </div>
        <div class="detail-section">
            <h4>Outgoing</h4>
            ${outgoing.length ? outgoing.map(e => `<div class="mini-link">${escapeHtml(node)} → ${escapeHtml(e.destination)}</div>`).join("") : '<div class="mini-link muted">None</div>'}
        </div>
        <button class="btn ${online ? "secondary" : "primary"} full" onclick="toggleNodeFailure('${escapeAttribute(node)}'); closeNodeModal(); renderFailureLists();">
            ${online ? "Simulate Failure" : "Restore Node"}
        </button>
    `;

    modal.classList.remove("hidden");
}

function closeNodeModal(event) {

    const modal = document.getElementById("nodeModal");
    if (!modal) return;

    if (!event || event.target === modal) modal.classList.add("hidden");
}


/* =========================================================
   GRAPH DRAWING
========================================================= */

function renderNetworkGraph() {
    const svg = document.getElementById("networkGraph");
    if (svg) drawGraph(svg, 1000, 600, {});
}

function renderDashboardGraph() {
    const svg = document.getElementById("dashboardGraph");
    if (svg) drawGraph(svg, 700, 380, {});
}

function renderRouteGraph(highlightedPath = []) {
    const svg = document.getElementById("routeGraph");
    if (svg) drawGraph(svg, 900, 500, { highlightPath: highlightedPath });
}

function renderRouteGraphWithFrame(frame) {
    const svg = document.getElementById("routeGraph");
    if (svg) drawGraph(svg, 900, 500, { frame: frame });
}


function drawGraph(svg, width, height, opts) {

    opts = opts || {};

    const highlightPath = opts.highlightPath || [];
    const frame = opts.frame || null;

    svg.innerHTML = "";

    if (nodes.length === 0) return;

    const positions = createNodePositions(nodes, width, height);

    const highlightSet = new Set();
    for (let i = 0; i < highlightPath.length - 1; i++) {
        highlightSet.add(`${highlightPath[i]}=>${highlightPath[i + 1]}`);
    }

    const visitedSet = new Set(frame ? frame.visited || [] : []);
    const relaxedSet = new Set(frame ? frame.relaxedEdges || [] : []);
    const frontierSet = new Set(frame ? frame.frontier || [] : []);
    const current = frame ? frame.currentNode : null;

    /* Arrow marker defs */
    const defs = svgElement("defs");
    defs.appendChild(makeMarker("arrow", "#94a3b8"));
    defs.appendChild(makeMarker("arrow-highlight", "#5b21d6"));
    svg.appendChild(defs);

    /* Edges */
    edges.forEach(edge => {

        const start = positions[edge.source];
        const end = positions[edge.destination];

        if (!start || !end) return;

        const down = isEdgeDown(edge);
        const key = `${edge.source}=>${edge.destination}`;
        const relaxedKey = `${edge.source}->${edge.destination}`;

        const isHighlighted = highlightSet.has(key);
        const isRelaxed = relaxedSet.has(relaxedKey);

        const adjusted = adjustLineForNodes(start.x, start.y, end.x, end.y, 28);

        const line = svgElement("line");
        line.setAttribute("x1", adjusted.x1);
        line.setAttribute("y1", adjusted.y1);
        line.setAttribute("x2", adjusted.x2);
        line.setAttribute("y2", adjusted.y2);

        let cls = "graph-edge";

        if (down) cls += " down";
        else if (isHighlighted) cls += " highlight";
        else if (isRelaxed) cls += " relaxed";

        if (useTraffic && !down) {
            cls += edge.trafficLevel === "HIGH"
                ? " congested"
                : edge.trafficLevel === "MEDIUM" ? " busy" : "";
        }

        line.setAttribute("class", cls);

        if (directed) {
            line.setAttribute("marker-end", isHighlighted ? "url(#arrow-highlight)" : "url(#arrow)");
        }

        svg.appendChild(line);

        /* Weight label */
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        const label = svgElement("text");
        label.setAttribute("x", midX);
        label.setAttribute("y", midY - 8);
        label.setAttribute("class", "edge-label");
        label.textContent = useTraffic ? effectiveCost(edge) : edge.weight;
        svg.appendChild(label);
    });

    /* Nodes */
    nodes.forEach(node => {

        const position = positions[node];
        if (!position) return;

        const group = svgElement("g");
        group.style.cursor = "pointer";
        group.addEventListener("click", () => openNodeModal(node));

        const circle = svgElement("circle");
        circle.setAttribute("cx", position.x);
        circle.setAttribute("cy", position.y);
        circle.setAttribute("r", "25");

        const down = failedNodes.includes(node);
        const isPath = highlightPath.includes(node);
        const isCurrent = current === node;
        const isVisited = visitedSet.has(node);
        const isFrontier = frontierSet.has(node);

        let cls = "graph-node";

        if (down) cls += " failed";
        else if (isCurrent) cls += " current";
        else if (isPath) cls += " selected";
        else if (isVisited) cls += " visited";
        else if (isFrontier) cls += " frontier";

        circle.setAttribute("class", cls);
        group.appendChild(circle);

        const text = svgElement("text");
        text.setAttribute("x", position.x);
        text.setAttribute("y", position.y + 1);
        text.setAttribute("class", "graph-node-label");
        text.textContent = node;
        group.appendChild(text);

        svg.appendChild(group);
    });
}

function makeMarker(id, color) {

    const marker = svgElement("marker");
    marker.setAttribute("id", id);
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");

    const path = svgElement("path");
    path.setAttribute("d", "M0,0 L0,6 L7,3 z");
    path.setAttribute("fill", color);

    marker.appendChild(path);
    return marker;
}


/* =========================================================
   NODE POSITIONING
========================================================= */

function createNodePositions(nodeArray, width, height) {

    const result = {};
    const count = nodeArray.length;
    const centerX = width / 2;
    const centerY = height / 2;

    if (count === 1) {
        result[nodeArray[0]] = { x: centerX, y: centerY };
        return result;
    }

    const radius = Math.min(width, height) * 0.32;

    nodeArray.forEach((node, index) => {
        const angle = (-Math.PI / 2) + (index * 2 * Math.PI / count);
        result[node] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    });

    return result;
}

function adjustLineForNodes(x1, y1, x2, y2, radius) {

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return { x1, y1, x2, y2 };

    const unitX = dx / distance;
    const unitY = dy / distance;

    return {
        x1: x1 + unitX * radius,
        y1: y1 + unitY * radius,
        x2: x2 - unitX * radius,
        y2: y2 - unitY * radius
    };
}


/* =========================================================
   LOCAL FALLBACK ENGINE (Dijkstra) when backend offline
========================================================= */

function localRoute(request) {

    const { source, destination, directed: dir, useTraffic: traffic, failedNodes: failed } = request;

    const alive = new Set(nodes.filter(n => !failed.includes(n)));

    const adjacency = {};
    nodes.forEach(n => adjacency[n] = []);

    edges.forEach(edge => {
        if (edge.disabled) return;
        if (!alive.has(edge.source) || !alive.has(edge.destination)) return;

        const cost = traffic ? effectiveCost(edge) : Number(edge.weight);
        adjacency[edge.source].push({ to: edge.destination, cost, key: `${edge.source}->${edge.destination}` });

        if (!dir) {
            adjacency[edge.destination].push({ to: edge.source, cost, key: `${edge.destination}->${edge.source}` });
        }
    });

    const dist = {};
    const prev = {};
    const visited = new Set();
    nodes.forEach(n => dist[n] = Infinity);
    dist[source] = 0;

    const animation = [];
    let step = 1;

    while (true) {

        let current = null;
        let best = Infinity;

        nodes.forEach(n => {
            if (!visited.has(n) && dist[n] < best) { best = dist[n]; current = n; }
        });

        if (current === null) break;

        visited.add(current);

        const relaxed = [];
        const frontier = [];

        adjacency[current].forEach(({ to, cost, key }) => {
            if (dist[current] + cost < dist[to]) {
                dist[to] = dist[current] + cost;
                prev[to] = current;
                relaxed.push(key);
            }
            if (!visited.has(to)) frontier.push(to);
        });

        const snapshot = {};
        nodes.forEach(n => snapshot[n] = dist[n] === Infinity ? -1 : dist[n]);

        animation.push({
            stepNumber: step++,
            currentNode: current,
            visited: [...visited],
            frontier: frontier,
            relaxedEdges: relaxed,
            distances: snapshot,
            message: `Visiting ${current} (cost ${dist[current]}).`
        });
    }

    if (!alive.has(source) || !alive.has(destination) || dist[destination] === Infinity) {
        return {
            found: false, algorithm: request.algorithm, source, destination,
            path: [], cost: 0, hops: 0, executionTimeMs: 0.01,
            message: "No route available (local engine).", animation
        };
    }

    const path = [];
    let cur = destination;
    while (cur != null) { path.unshift(cur); cur = prev[cur]; }

    const result = {
        found: true, algorithm: request.algorithm, source, destination,
        path, cost: dist[destination], hops: path.length - 1,
        visitedNodes: visited.size,
        executionTimeMs: 0.05, message: "Route found (local engine).", animation
    };

    result.metrics = localRouteMetrics(path);
    result.decision = buildLocalDecision(result, result.metrics);
    return result;
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {

    const nodeCount = document.getElementById("nodeCount");
    const edgeCount = document.getElementById("edgeCount");
    const pathCounter = document.getElementById("pathCount");

    if (nodeCount) nodeCount.textContent = nodes.length;
    if (edgeCount) edgeCount.textContent = edges.length;
    if (pathCounter) pathCounter.textContent = pathCount;

    const badge = document.getElementById("nodeBadge");
    if (badge) badge.textContent = `${nodes.length} Node${nodes.length === 1 ? "" : "s"}`;
}


/* =========================================================
   MESSAGE HELPERS
========================================================= */

function showNodeMessage(message, type) {

    const box = document.getElementById("nodeMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `message ${type}`;
    setTimeout(() => box.classList.add("hidden"), 3000);
}

function showEdgeMessage(message, type) {

    const box = document.getElementById("edgeMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `message ${type}`;
    setTimeout(() => box.classList.add("hidden"), 3000);
}

function showToast(message) {

    const toast = document.getElementById("toast");
    const text = document.getElementById("toastMessage");

    if (!toast || !text) return;

    text.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}


/* =========================================================
   ENTER KEY
========================================================= */

function setupEnterKey() {

    const nodeInput = document.getElementById("newNodeName");
    const weightInput = document.getElementById("edgeWeight");

    if (nodeInput) {
        nodeInput.addEventListener("keydown", e => { if (e.key === "Enter") addNode(); });
    }

    if (weightInput) {
        weightInput.addEventListener("keydown", e => { if (e.key === "Enter") addEdge(); });
    }
}


/* =========================================================
   DATE / SORT / SVG / SECURITY
========================================================= */

function formatDate(value) {

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function svgElement(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function downloadJson(data, filename) {

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}



/* =========================================================
   AUTOPILOT · DEMO SCENARIOS · AUTO REROUTING
========================================================= */

/* Offline fallback scenarios (mirror of backend ScenarioService) */
const LOCAL_SCENARIOS = [
    scenario("NORMAL", "Normal Network", "Balanced traffic, every link operational."),
    scenario("HEAVY_TRAFFIC", "Heavy Traffic", "Primary corridor saturated — watch rerouting.",
        ["HIGH", "HIGH", "LOW", "LOW", "MEDIUM", "LOW", "LOW"]),
    scenario("NETWORK_FAILURE", "Network Failure", "Link B → C goes down — an alternate path is found.",
        null, ["B->C"], []),
    scenario("MULTIPLE_FAILURES", "Multiple Failures", "Two links and node E offline — resilience test.",
        null, ["B->C", "C->F"], ["E"]),
    scenario("CONGESTED", "Congested Network", "Most links carry HIGH traffic — costs spike.",
        ["HIGH", "HIGH", "HIGH", "MEDIUM", "HIGH", "MEDIUM", "HIGH"]),
    scenario("LARGE", "Large Network", "12-node metro topology for stress testing.", null, [], [], true)
];

function scenario(id, label, description, levels, disabledEdges, failedNodes, large) {

    const linkDefs = [
        ["A", "B", 4, 5], ["A", "D", 3, 8], ["B", "C", 3, 6],
        ["D", "E", 4, 9], ["C", "F", 5, 12], ["E", "F", 3, 7], ["F", "G", 2, 4]
    ];

    let nodesList, edgeList, directed = true, src = "A", dst = "G";

    if (large) {
        nodesList = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12"];
        const pairs = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
            [8, 9], [9, 10], [10, 11], [11, 12], [12, 1], [1, 5], [3, 9], [7, 11], [2, 6], [8, 12]];
        let seed = 42;
        const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        const lv = ["LOW", "LOW", "MEDIUM", "HIGH"];
        edgeList = pairs.map(([a, b]) => ({
            source: `N${a}`, destination: `N${b}`,
            weight: 2 + Math.floor(rnd() * 9),
            latency: 2 + Math.floor(rnd() * 18),
            capacity: [100, 200, 400, 800][Math.floor(rnd() * 4)],
            trafficLevel: lv[Math.floor(rnd() * lv.length)],
            disabled: false
        }));
        directed = false; src = "N1"; dst = "N12";
    } else {
        nodesList = ["A", "B", "C", "D", "E", "F", "G"];
        edgeList = linkDefs.map((d, i) => ({
            source: d[0], destination: d[1], weight: d[2], latency: d[3],
            capacity: 100,
            trafficLevel: (levels ? levels[i] : "LOW"),
            disabled: disabledEdges && disabledEdges.includes(`${d[0]}->${d[1]}`)
        }));
    }

    return {
        id, label, description,
        directed, useTraffic: true, source: src, destination: dst,
        nodes: nodesList, edges: edgeList,
        failedNodes: failedNodes || [],
        disabledEdges: disabledEdges || []
    };
}

async function initAutopilot() {

    renderScenarioGrid();
    await loadRerouteEvents();
    renderMonitorConsole();
}

async function loadScenarios() {

    try {
        const res = await fetch("/api/routing/scenarios");
        if (res.ok) {
            scenarios = await res.json();
        } else {
            scenarios = LOCAL_SCENARIOS;
        }
    } catch (err) {
        scenarios = LOCAL_SCENARIOS;
    }

    renderScenarioGrid();
}

function getScenario(id) {

    const fromApi = (scenarios || []).find(s => s.id === id);
    if (fromApi) return fromApi;
    return LOCAL_SCENARIOS.find(s => s.id === id);
}

function renderScenarioGrid() {

    const grid = document.getElementById("scenarioGrid");
    if (!grid) return;

    const list = (scenarios && scenarios.length ? scenarios : LOCAL_SCENARIOS);

    grid.innerHTML = list.map(s => `
        <button class="scenario-card" onclick="applyScenario('${escapeAttribute(s.id)}')">
            <strong>${escapeHtml(s.label)}</strong>
            <small>${escapeHtml(s.description)}</small>
            <span class="scenario-run"><i class="fa-solid fa-play"></i> Load</span>
        </button>
    `).join("");
}

function applyScenario(id) {

    const s = getScenario(id);
    if (!s) { showToast("Scenario unavailable"); return; }

    nodes = [...s.nodes];
    edges = s.edges.map(e => ({
        source: e.source,
        destination: e.destination,
        weight: Number(e.weight) || 0,
        latency: Number(e.latency) || 0,
        capacity: Number(e.capacity) || 100,
        trafficLevel: (e.trafficLevel || "LOW").toUpperCase(),
        disabled: e.disabled === true || (s.disabledEdges || []).includes(`${e.source}->${e.destination}`)
    }));

    failedNodes = [...(s.failedNodes || [])];
    useTraffic = s.useTraffic !== false;

    const directedToggle = document.getElementById("directedToggle");
    if (directedToggle) {
        directed = !!s.directed;
        directedToggle.checked = directed;
        const label = document.getElementById("directedLabel");
        if (label) label.textContent = directed ? "Directed" : "Undirected";
    }

    const trafficToggle = document.getElementById("useTrafficToggle");
    if (trafficToggle) trafficToggle.checked = useTraffic;

    renderNodeControls();

    const src = document.getElementById("source");
    const dst = document.getElementById("destination");
    if (src && s.source) src.value = s.source;
    if (dst && s.destination) dst.value = s.destination;

    renderEdgeTable();
    updateStatistics();
    renderNetworkGraph();
    renderDashboardGraph();
    renderRouteGraph();
    renderTrafficTable();
    renderFailureLists();
    refreshHealthIndicator();

    showToast(`${s.label} loaded`);

    // Auto-run a route so the dashboard lights up immediately
    findPath();
}

/* ---- Automatic dynamic rerouting watch cycle ---- */

async function runMonitorCycle() {

    const src = document.getElementById("source");
    const dst = document.getElementById("destination");

    if (!src || !dst || !src.value || !dst.value) {
        showToast("Pick source & destination first");
        return;
    }

    let data;

    try {
        data = await apiPost("/api/routing/monitor", buildRequest(src.value, dst.value, "DIJKSTRA"));
    } catch (err) {
        data = localMonitorCycle(src.value, dst.value);
    }

    logMonitorResult(data);
    refreshHealthIndicator();
}

function logMonitorResult(data) {

    if (data.rerouted) {
        rerouteLog.unshift({
            time: data.timestamp || new Date().toLocaleTimeString(),
            trigger: data.trigger,
            oldPath: data.oldPath,
            newPath: data.newPath,
            oldCost: data.oldCost,
            newCost: data.newCost
        });
    }

    renderMonitorConsole(data);
}

function renderMonitorConsole(latest) {

    const consoleBox = document.getElementById("monitorConsole");
    if (!consoleBox) return;

    if (!rerouteLog.length && !latest) {
        consoleBox.innerHTML = `
            <div class="console-empty">
                <i class="fa-solid fa-satellite-dish"></i>
                Monitor is idle. Load a scenario and run a watch cycle.
            </div>`;
        return;
    }

    const header = latest ? monitorLine(latest) : "";

    const rows = rerouteLog.map(e => `
        <div class="console-line ${e.trigger === 'LINK_FAILURE' ? 'failure' : 'congestion'}">
            <span class="console-time">${escapeHtml(e.time)}</span>
            <span class="console-tag">${e.trigger === 'LINK_FAILURE' ? '🚨 Failure' : '⚠️ Congestion'}</span>
            <span class="console-body">
                <s>${escapeHtml(e.oldPath)}</s> → <strong>${escapeHtml(e.newPath)}</strong>
                <em>(cost ${e.oldCost} → ${e.newCost})</em>
            </span>
        </div>
    `).join("");

    consoleBox.innerHTML = header + (rows || `<div class="console-empty">No rerouting events yet.</div>`);
}

function monitorLine(data) {

    if (data.status === "REROUTED") {
        return `<div class="console-line success">
            <span class="console-time">${escapeHtml(data.timestamp || "")}</span>
            <span class="console-tag">✅ Rerouted</span>
            <span class="console-body">${escapeHtml(data.message || "")}</span>
        </div>`;
    }
    if (data.status === "MONITORING") {
        return `<div class="console-line ok">
            <span class="console-time">${escapeHtml(data.timestamp || "")}</span>
            <span class="console-tag">🟢 Healthy</span>
            <span class="console-body">${escapeHtml(data.message || "All nominal.")}</span>
        </div>`;
    }
    return `<div class="console-line warn">
        <span class="console-time">${escapeHtml(data.timestamp || "")}</span>
        <span class="console-tag">${escapeHtml(data.status || "INFO")}</span>
        <span class="console-body">${escapeHtml(data.message || "")}</span>
    </div>`;
}

async function loadRerouteEvents() {
    try {
        const res = await fetch("/api/routing/reroute-events");
        if (res.ok) {
            const events = await res.json();
            if (Array.isArray(events) && events.length) {
                rerouteLog = events.map(e => ({
                    time: e.time, trigger: e.trigger,
                    oldPath: e.oldPath, newPath: e.newPath,
                    oldCost: e.oldCost, newCost: e.newCost
                }));
            }
        }
    } catch (err) { /* keep local log */ }
}

function toggleAutoMonitor() {

    const toggle = document.getElementById("autoMonitorToggle");
    const on = toggle && toggle.checked;

    if (on) {
        runMonitorCycle();
        monitorTimer = setInterval(runMonitorCycle, 4000);
        showToast("Live monitor ON");
    } else {
        clearInterval(monitorTimer);
        monitorTimer = null;
        showToast("Live monitor OFF");
    }
}

/* Offline monitor engine (mirrors backend when Spring Boot is not reachable) */
function localMonitorCycle(source, destination) {

    const timestamp = new Date().toLocaleTimeString();

    // Baseline route ignoring traffic
    const baseline = localRoute(buildRequest(source, destination, "DIJKSTRA"));
    if (!baseline.found) {
        return { timestamp, status: "DOWN", message: "No active route exists." };
    }

    const congested = [], broken = [];

    for (let i = 0; i < baseline.path.length - 1; i++) {
        const from = baseline.path[i], to = baseline.path[i + 1];
        const edge = findEdgeBetween(from, to);
        if (!edge || edge.disabled || failedNodes.includes(from) || failedNodes.includes(to)) {
            broken.push(`${from} → ${to}`);
        } else if ((edge.trafficLevel || "LOW") === "HIGH") {
            congested.push(`${from} → ${to}`);
        }
    }

    if (!broken.length && !congested.length) {
        return {
            timestamp, status: "MONITORING",
            activePath: baseline.path.join(" → "), cost: baseline.cost,
            message: "All links on the active route are healthy."
        };
    }

    const aware = localRoute(Object.assign(
        buildRequest(source, destination, "DIJKSTRA"), { useTraffic: true }));

    const trigger = broken.length ? "LINK_FAILURE" : "CONGESTION";
    const oldPath = baseline.path.join(" → ");

    if (aware.found && aware.path.join(" → ") !== oldPath) {
        return {
            timestamp, rerouted: true, status: "REROUTED", trigger,
            affectedLinks: broken.length ? broken : congested,
            oldPath, oldCost: baseline.cost,
            newPath: aware.path.join(" → "), newCost: aware.cost,
            message: `⚠️ ${trigger === 'LINK_FAILURE' ? 'Link failure' : 'Congestion'} detected → 🔄 Recalculated: ${aware.path.join(" → ")} (cost ${aware.cost})`
        };
    }

    return {
        timestamp, status: "OPTIMAL", trigger,
        message: "⚠️ Anomaly detected but current route remains optimal."
    };
}
