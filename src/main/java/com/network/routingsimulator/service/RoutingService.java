package com.network.routingsimulator.service;

import com.network.routingsimulator.dto.GraphRequest;
import com.network.routingsimulator.dto.RouteResult;
import com.network.routingsimulator.model.Edge;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class RoutingService {

    public static final List<String> ALGORITHMS =
            List.of("DIJKSTRA", "BFS", "BELLMAN_FORD", "A_STAR", "FLOYD_WARSHALL");

    /* =====================================================
       PUBLIC API
    ===================================================== */

    public RouteResult route(GraphRequest request) {

        String algorithm = request.getAlgorithm() == null
                ? "DIJKSTRA"
                : request.getAlgorithm().toUpperCase();

        long start = System.nanoTime();
        RouteResult result = switch (algorithm) {
            case "BFS" -> bfs(request);
            case "BELLMAN_FORD" -> bellmanFord(request);
            case "A_STAR" -> aStar(request);
            case "FLOYD_WARSHALL" -> floydWarshall(request);
            default -> dijkstra(request);
        };
        long elapsed = System.nanoTime() - start;

        result.setExecutionTimeMs(Math.max(elapsed / 1_000_000.0, 0.01));

        if (result.isFound()) {
            Map<String, Object> metrics = routeMetrics(result.getPath(), request);
            result.setMetrics(metrics);
            result.setDecision(buildDecision(result, request, metrics));
        }

        return result;
    }

    /* =====================================================
       ROUTE METRICS + INTELLIGENT DECISION
    ===================================================== */

    private Edge findEdge(String from, String to, GraphRequest request) {

        if (request.getEdges() == null) {
            return null;
        }

        for (Edge edge : request.getEdges()) {
            if (edge.getSource().equals(from) && edge.getDestination().equals(to)) {
                return edge;
            }
            if (!request.isDirected()
                    && edge.getSource().equals(to) && edge.getDestination().equals(from)) {
                return edge;
            }
        }

        return null;
    }

    /**
     * Physical quality metrics of a chosen path:
     * end-to-end latency, bottleneck capacity and average utilization.
     */
    public Map<String, Object> routeMetrics(List<String> path, GraphRequest request) {

        int latency = 0;
        int bottleneck = Integer.MAX_VALUE;
        int utilizationSum = 0;
        int links = 0;
        boolean high = false;
        boolean medium = false;

        for (int i = 0; path != null && i < path.size() - 1; i++) {

            Edge edge = findEdge(path.get(i), path.get(i + 1), request);

            if (edge == null) {
                continue;
            }

            links++;
            latency += Math.max(edge.getLatency(), 0);
            bottleneck = Math.min(bottleneck, Math.max(edge.getCapacity(), 0));
            utilizationSum += utilizationOf(edge);

            String level = edge.getTrafficLevel() == null ? "LOW" : edge.getTrafficLevel().toUpperCase();
            if ("HIGH".equals(level)) high = true;
            if ("MEDIUM".equals(level)) medium = true;
        }

        String traffic = high ? "HIGH" : medium ? "MEDIUM" : "LOW";

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("totalLatencyMs", latency);
        metrics.put("bottleneckCapacity", links == 0 ? 0 : bottleneck);
        metrics.put("averageCapacity", links == 0 ? 0 : Math.round(utilizationSum / (double) links));
        metrics.put("trafficLevel", traffic);
        metrics.put("linkCount", links);
        return metrics;
    }

    private int utilizationOf(Edge edge) {
        return switch (edge.getTrafficLevel() == null ? "LOW" : edge.getTrafficLevel().toUpperCase()) {
            case "HIGH" -> 85;
            case "MEDIUM" -> 55;
            default -> 15;
        };
    }

    /**
     * Explains WHY the route was selected — the factors evaluated by the
     * dynamic cost engine — instead of just "an algorithm found a path".
     */
    private Map<String, Object> buildDecision(RouteResult result,
                                              GraphRequest request,
                                              Map<String, Object> metrics) {

        List<String> failed = request.getFailedEdges() == null ? List.of() : request.getFailedEdges();
        boolean congestionAware = request.isUseTraffic();
        boolean failureAware = (request.getFailedNodes() != null && !request.getFailedNodes().isEmpty())
                || !failed.isEmpty()
                || (request.getEdges() != null && request.getEdges().stream().anyMatch(Edge::isDisabled));

        List<Map<String, Object>> factors = List.of(
                Map.of("name", "Distance (base link cost)", "applied", true),
                Map.of("name", "Latency weighting", "applied",
                        request.getEdges() != null && request.getEdges().stream().anyMatch(e -> e.getLatency() > 0)),
                Map.of("name", "Traffic congestion penalty", "applied", congestionAware),
                Map.of("name", "Link availability (failure bypass)", "applied", failureAware),
                Map.of("name", "Link capacity awareness", "applied",
                        request.getEdges() != null && request.getEdges().stream().anyMatch(e -> e.getCapacity() != 100))
        );

        List<String> reasons = new ArrayList<>();
        reasons.add("Lowest total cost (" + result.getCost() + ") across " + result.getHops() + " hop(s).");
        if (congestionAware) {
            reasons.add("Traffic penalties included — congested links were deprioritized.");
        }
        if (failureAware) {
            reasons.add("Failed nodes/links excluded from the search space.");
        }
        reasons.add("End-to-end latency: " + metrics.get("totalLatencyMs") + " ms.");

        Map<String, Object> decision = new LinkedHashMap<>();
        decision.put("algorithm", prettyName(result.getAlgorithm()));
        decision.put("factors", factors);
        decision.put("reasons", reasons);
        decision.put("route", String.join(" -> ", result.getPath()));
        decision.put("cost", result.getCost());
        decision.put("latencyMs", metrics.get("totalLatencyMs"));
        decision.put("capacity", metrics.get("averageCapacity") + "%");
        decision.put("traffic", metrics.get("trafficLevel"));
        return decision;
    }

    public List<RouteResult> compareAll(GraphRequest request) {

        List<RouteResult> results = new ArrayList<>();

        for (String algorithm : ALGORITHMS) {
            GraphRequest copy = copyForAlgorithm(request, algorithm);
            results.add(route(copy));
        }

        return results;
    }

    private GraphRequest copyForAlgorithm(GraphRequest source, String algorithm) {

        GraphRequest copy = new GraphRequest();
        copy.setEdges(source.getEdges());
        copy.setNodes(source.getNodes());
        copy.setSource(source.getSource());
        copy.setDestination(source.getDestination());
        copy.setDirected(source.isDirected());
        copy.setUseTraffic(source.isUseTraffic());
        copy.setFailedNodes(source.getFailedNodes());
        copy.setFailedEdges(source.getFailedEdges());
        copy.setAlgorithm(algorithm);
        return copy;
    }

    /* =====================================================
       GRAPH HELPERS
    ===================================================== */

    private Set<String> collectNodes(GraphRequest request) {

        Set<String> all = new LinkedHashSet<>();

        if (request.getNodes() != null) {
            all.addAll(request.getNodes());
        }

        if (request.getEdges() != null) {
            for (Edge edge : request.getEdges()) {
                all.add(edge.getSource());
                all.add(edge.getDestination());
            }
        }

        if (request.getFailedNodes() != null) {
            all.removeAll(request.getFailedNodes());
        }

        return all;
    }

    private boolean edgeBlocked(Edge edge, GraphRequest request) {

        if (edge.isDisabled()) {
            return true;
        }

        List<String> failed = request.getFailedEdges();

        if (failed != null && !failed.isEmpty()) {
            String key = edge.getSource() + "->" + edge.getDestination();
            String reverse = edge.getDestination() + "->" + edge.getSource();
            if (failed.contains(key) || (!request.isDirected() && failed.contains(reverse))) {
                return true;
            }
        }

        return false;
    }

    private int costOf(Edge edge, GraphRequest request) {
        return request.isUseTraffic() ? edge.effectiveCost() : edge.getWeight();
    }

    private Map<String, List<Edge>> buildAdjacency(GraphRequest request) {

        Map<String, List<Edge>> graph = new HashMap<>();

        if (request.getEdges() == null) {
            return graph;
        }

        Set<String> alive = collectNodes(request);
        Set<String> failedEdges = new HashSet<>(
                request.getFailedEdges() == null ? List.of() : request.getFailedEdges());

        for (Edge edge : request.getEdges()) {

            if (edgeBlocked(edge, request)) {
                continue;
            }

            if (!alive.contains(edge.getSource()) || !alive.contains(edge.getDestination())) {
                continue;
            }

            graph.computeIfAbsent(edge.getSource(), k -> new ArrayList<>()).add(edge);

            if (!request.isDirected()) {
                String reverseKey = edge.getDestination() + "->" + edge.getSource();
                if (!failedEdges.contains(reverseKey)) {
                    Edge reversed = new Edge(edge.getDestination(), edge.getSource(), edge.getWeight());
                    reversed.setLatency(edge.getLatency());
                    reversed.setTrafficLevel(edge.getTrafficLevel());
                    reversed.setCapacity(edge.getCapacity());
                    graph.computeIfAbsent(edge.getDestination(), k -> new ArrayList<>()).add(reversed);
                }
            }
        }

        return graph;
    }

    private RouteResult baseResult(GraphRequest request, String algorithm) {

        RouteResult result = new RouteResult();
        result.setAlgorithm(algorithm);
        result.setSource(request.getSource());
        result.setDestination(request.getDestination());
        result.setPath(List.of());
        result.setAnimation(new ArrayList<>());
        result.setFound(false);
        return result;
    }

    private RouteResult finish(RouteResult result,
                               Map<String, String> previous,
                               Map<String, Integer> distance,
                               Set<String> nodes) {

        String destination = result.getDestination();

        if (destination == null || !distance.containsKey(destination)
                || distance.get(destination) == null
                || distance.get(destination) >= Integer.MAX_VALUE) {
            result.setFound(false);
            result.setMessage("No route available between " + result.getSource()
                    + " and " + result.getDestination() + ".");
            return result;
        }

        List<String> path = new ArrayList<>();
        String current = destination;

        while (current != null) {
            path.add(current);
            current = previous.get(current);
        }

        Collections.reverse(path);

        if (path.isEmpty() || !path.get(0).equals(result.getSource())) {
            result.setFound(false);
            result.setMessage("No route available.");
            return result;
        }

        result.setFound(true);
        result.setPath(path);
        result.setCost(distance.get(destination));
        result.setHops(Math.max(path.size() - 1, 0));
        result.setMessage("Route found using " + prettyName(result.getAlgorithm()) + ".");
        return result;
    }

    public static String prettyName(String algorithm) {
        return switch (algorithm) {
            case "BFS" -> "Breadth-First Search";
            case "BELLMAN_FORD" -> "Bellman-Ford";
            case "A_STAR" -> "A* Search";
            case "FLOYD_WARSHALL" -> "Floyd-Warshall";
            default -> "Dijkstra's Algorithm";
        };
    }

    private RouteResult.AnimationStep step(int number,
                                           String currentNode,
                                           Set<String> visited,
                                           Collection<String> frontier,
                                           List<String> relaxed,
                                           Map<String, Integer> distance,
                                           String message) {

        RouteResult.AnimationStep step = new RouteResult.AnimationStep();
        step.setStepNumber(number);
        step.setCurrentNode(currentNode);
        step.setVisited(new ArrayList<>(visited));
        step.setFrontier(new ArrayList<>(frontier));
        step.setRelaxedEdges(relaxed);

        Map<String, Integer> snapshot = new LinkedHashMap<>();
        distance.forEach((k, v) -> snapshot.put(k, v >= Integer.MAX_VALUE ? -1 : v));
        step.setDistances(snapshot);

        step.setMessage(message);
        return step;
    }

    /* =====================================================
       DIJKSTRA (with animation trace)
    ===================================================== */

    private RouteResult dijkstra(GraphRequest request) {

        RouteResult result = baseResult(request, "DIJKSTRA");

        Map<String, List<Edge>> graph = buildAdjacency(request);
        Set<String> nodes = collectNodes(request);

        if (!nodes.contains(request.getSource()) || !nodes.contains(request.getDestination())) {
            result.setMessage("Source or destination node is unavailable.");
            return result;
        }

        Map<String, Integer> distance = new LinkedHashMap<>();
        Map<String, String> previous = new HashMap<>();
        Set<String> visited = new LinkedHashSet<>();

        nodes.forEach(node -> distance.put(node, Integer.MAX_VALUE));
        distance.put(request.getSource(), 0);

        PriorityQueue<String> pq =
                new PriorityQueue<>(Comparator.comparingInt(distance::get));
        pq.add(request.getSource());

        int stepNumber = 1;

        while (!pq.isEmpty()) {

            String current = pq.poll();

            if (visited.contains(current)) {
                continue;
            }

            visited.add(current);

            List<String> relaxed = new ArrayList<>();
            List<String> frontier = new ArrayList<>();

            for (Edge edge : graph.getOrDefault(current, List.of())) {

                int candidate = distance.get(current) + costOf(edge, request);

                if (candidate < distance.get(edge.getDestination())) {
                    distance.put(edge.getDestination(), candidate);
                    previous.put(edge.getDestination(), current);
                    relaxed.add(current + "->" + edge.getDestination());
                }

                if (!visited.contains(edge.getDestination())) {
                    frontier.add(edge.getDestination());
                    pq.add(edge.getDestination());
                }
            }

            result.getAnimation().add(step(
                    stepNumber++,
                    current,
                    visited,
                    frontier,
                    relaxed,
                    distance,
                    "Visiting " + current + " (cost " + distance.get(current) + ")."
            ));
        }

        RouteResult finished = finish(result, previous, distance, nodes);
        finished.setVisitedNodes(visited.size());
        return finished;
    }

    /* =====================================================
       BFS (fewest hops)
    ===================================================== */

    private RouteResult bfs(GraphRequest request) {

        RouteResult result = baseResult(request, "BFS");

        Map<String, List<Edge>> graph = buildAdjacency(request);
        Set<String> nodes = collectNodes(request);

        if (!nodes.contains(request.getSource()) || !nodes.contains(request.getDestination())) {
            result.setMessage("Source or destination node is unavailable.");
            return result;
        }

        Map<String, Integer> distance = new LinkedHashMap<>();
        Map<String, String> previous = new HashMap<>();
        Set<String> visited = new LinkedHashSet<>();

        nodes.forEach(node -> distance.put(node, Integer.MAX_VALUE));
        distance.put(request.getSource(), 0);

        Queue<String> queue = new LinkedList<>();
        queue.add(request.getSource());

        int stepNumber = 1;

        while (!queue.isEmpty()) {

            String current = queue.poll();

            if (visited.contains(current)) {
                continue;
            }

            visited.add(current);

            List<String> relaxed = new ArrayList<>();
            List<String> frontier = new ArrayList<>();

            for (Edge edge : graph.getOrDefault(current, List.of())) {

                if (!visited.contains(edge.getDestination())
                        && distance.get(edge.getDestination()) == Integer.MAX_VALUE) {

                    distance.put(edge.getDestination(),
                            distance.get(current) + costOf(edge, request));
                    previous.put(edge.getDestination(), current);
                    relaxed.add(current + "->" + edge.getDestination());
                    frontier.add(edge.getDestination());
                    queue.add(edge.getDestination());
                }
            }

            result.getAnimation().add(step(
                    stepNumber++,
                    current,
                    visited,
                    frontier,
                    relaxed,
                    distance,
                    "Exploring neighbours of " + current + "."
            ));
        }

        RouteResult finished = finish(result, previous, distance, nodes);
        finished.setVisitedNodes(visited.size());

        if (finished.isFound()) {
            // Recompute real cost along the hop-shortest path
            finished.setCost(pathCost(finished.getPath(), graph, request));
        }

        return finished;
    }

    private int pathCost(List<String> path,
                         Map<String, List<Edge>> graph,
                         GraphRequest request) {

        int total = 0;

        for (int i = 0; i < path.size() - 1; i++) {

            final String from = path.get(i);
            final String to = path.get(i + 1);

            Optional<Edge> match = graph.getOrDefault(from, List.of()).stream()
                    .filter(e -> e.getDestination().equals(to))
                    .findFirst();

            total += match.map(edge -> costOf(edge, request)).orElse(0);
        }

        return total;
    }

    /* =====================================================
       BELLMAN-FORD
    ===================================================== */

    private RouteResult bellmanFord(GraphRequest request) {

        RouteResult result = baseResult(request, "BELLMAN_FORD");

        Map<String, List<Edge>> graph = buildAdjacency(request);
        Set<String> nodes = collectNodes(request);

        if (!nodes.contains(request.getSource()) || !nodes.contains(request.getDestination())) {
            result.setMessage("Source or destination node is unavailable.");
            return result;
        }

        Map<String, Integer> distance = new LinkedHashMap<>();
        Map<String, String> previous = new HashMap<>();

        nodes.forEach(node -> distance.put(node, Integer.MAX_VALUE));
        distance.put(request.getSource(), 0);

        List<Edge> allEdges = graph.values().stream().flatMap(List::stream).toList();

        Set<String> emptyVisited = new LinkedHashSet<>();
        int stepNumber = 1;

        for (int iteration = 0; iteration < nodes.size() - 1; iteration++) {

            boolean changed = false;
            List<String> relaxed = new ArrayList<>();

            for (Edge edge : allEdges) {

                int fromCost = distance.get(edge.getSource());

                if (fromCost == Integer.MAX_VALUE) {
                    continue;
                }

                int candidate = fromCost + costOf(edge, request);

                if (candidate < distance.get(edge.getDestination())) {
                    distance.put(edge.getDestination(), candidate);
                    previous.put(edge.getDestination(), edge.getSource());
                    relaxed.add(edge.getSource() + "->" + edge.getDestination());
                    changed = true;
                }
            }

            result.getAnimation().add(step(
                    stepNumber++,
                    null,
                    emptyVisited,
                    List.of(),
                    relaxed,
                    distance,
                    "Relaxation round " + iteration + " (" + relaxed.size() + " updates)."
            ));

            if (!changed) {
                break;
            }
        }

        RouteResult finished = finish(result, previous, distance, nodes);
        finished.setVisitedNodes(nodes.size());
        return finished;
    }

    /* =====================================================
       A* (admissible hop-based heuristic)
    ===================================================== */

    private RouteResult aStar(GraphRequest request) {

        RouteResult result = baseResult(request, "A_STAR");

        Map<String, List<Edge>> graph = buildAdjacency(request);
        Set<String> nodes = collectNodes(request);

        if (!nodes.contains(request.getSource()) || !nodes.contains(request.getDestination())) {
            result.setMessage("Source or destination node is unavailable.");
            return result;
        }

        // Heuristic: minEdgeWeight * hopDistanceToDestination (admissible)
        int minEdge = graph.values().stream()
                .flatMap(List::stream)
                .mapToInt(e -> Math.max(costOf(e, request), 1))
                .min()
                .orElse(1);

        Map<String, Integer> hopHeuristic = hopDistanceTo(request, graph, request.getDestination());

        Map<String, Integer> gScore = new LinkedHashMap<>();
        Map<String, String> previous = new HashMap<>();
        Set<String> visited = new LinkedHashSet<>();

        nodes.forEach(node -> gScore.put(node, Integer.MAX_VALUE));
        gScore.put(request.getSource(), 0);

        Comparator<String> byF = Comparator.<String>comparingInt(
                n -> fValue(n, gScore, hopHeuristic, minEdge))
                .thenComparing(Comparator.naturalOrder());

        PriorityQueue<String> open = new PriorityQueue<>(byF);
        open.add(request.getSource());

        int stepNumber = 1;

        while (!open.isEmpty()) {

            String current = open.poll();

            if (visited.contains(current)) {
                continue;
            }

            visited.add(current);

            List<String> relaxed = new ArrayList<>();
            List<String> frontier = new ArrayList<>();

            for (Edge edge : graph.getOrDefault(current, List.of())) {

                int candidate = gScore.get(current) + costOf(edge, request);

                if (candidate < gScore.get(edge.getDestination())) {
                    gScore.put(edge.getDestination(), candidate);
                    previous.put(edge.getDestination(), current);
                    relaxed.add(current + "->" + edge.getDestination());
                }

                if (!visited.contains(edge.getDestination())) {
                    frontier.add(edge.getDestination());
                    open.add(edge.getDestination());
                }
            }

            result.getAnimation().add(step(
                    stepNumber++,
                    current,
                    visited,
                    frontier,
                    relaxed,
                    gScore,
                    "Expanding " + current + " using A* heuristic."
            ));

            if (current.equals(request.getDestination())) {
                break;
            }
        }

        RouteResult finished = finish(result, previous, gScore, nodes);
        finished.setVisitedNodes(visited.size());
        return finished;
    }

    private int fValue(String node,
                        Map<String, Integer> gScore,
                        Map<String, Integer> heuristic,
                        int minEdge) {

        int g = gScore.getOrDefault(node, Integer.MAX_VALUE);

        if (g >= Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }

        int h = heuristic.getOrDefault(node, 0);

        if (h >= Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }

        return g + h * minEdge;
    }

    private Map<String, Integer> hopDistanceTo(GraphRequest request,
                                               Map<String, List<Edge>> graph,
                                               String target) {

        // Reverse BFS to count hops from every node to the target
        Map<String, List<String>> reverse = new HashMap<>();

        graph.forEach((from, edgeList) ->
                edgeList.forEach(edge ->
                        reverse.computeIfAbsent(edge.getDestination(), k -> new ArrayList<>())
                                .add(from)));

        Map<String, Integer> hops = new HashMap<>();
        Queue<String> queue = new LinkedList<>();

        hops.put(target, 0);
        queue.add(target);

        while (!queue.isEmpty()) {

            String current = queue.poll();

            for (String prev : reverse.getOrDefault(current, List.of())) {
                if (!hops.containsKey(prev)) {
                    hops.put(prev, hops.get(current) + 1);
                    queue.add(prev);
                }
            }
        }

        return hops;
    }

    /* =====================================================
       FLOYD-WARSHALL (all pairs)
    ===================================================== */

    private RouteResult floydWarshall(GraphRequest request) {

        RouteResult result = baseResult(request, "FLOYD_WARSHALL");

        Map<String, List<Edge>> graph = buildAdjacency(request);
        List<String> nodes = new ArrayList<>(collectNodes(request));

        if (!nodes.contains(request.getSource()) || !nodes.contains(request.getDestination())) {
            result.setMessage("Source or destination node is unavailable.");
            return result;
        }

        int n = nodes.size();
        Map<String, Integer> index = new HashMap<>();
        for (int i = 0; i < n; i++) {
            index.put(nodes.get(i), i);
        }

        int[][] dist = new int[n][n];
        int[][] next = new int[n][n];

        for (int[] row : dist) {
            Arrays.fill(row, Integer.MAX_VALUE);
        }
        for (int[] row : next) {
            Arrays.fill(row, -1);
        }
        for (int i = 0; i < n; i++) {
            dist[i][i] = 0;
        }

        for (Edge edge : graph.values().stream().flatMap(List::stream).toList()) {
            int u = index.get(edge.getSource());
            int v = index.get(edge.getDestination());
            int cost = costOf(edge, request);
            if (cost < dist[u][v]) {
                dist[u][v] = cost;
                next[u][v] = v;
            }
        }

        Set<String> emptyVisited = new LinkedHashSet<>();
        int stepNumber = 1;

        for (int k = 0; k < n; k++) {
            for (int i = 0; i < n; i++) {
                for (int j = 0; j < n; j++) {
                    if (dist[i][k] == Integer.MAX_VALUE || dist[k][j] == Integer.MAX_VALUE) {
                        continue;
                    }
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                        next[i][j] = next[i][k];
                    }
                }
            }

            Map<String, Integer> distanceSnapshot = new LinkedHashMap<>();
            int s = index.get(request.getSource());
            for (int j = 0; j < n; j++) {
                distanceSnapshot.put(nodes.get(j), dist[s][j]);
            }

            result.getAnimation().add(step(
                    stepNumber++,
                    nodes.get(k),
                    emptyVisited,
                    List.of(),
                    List.of(),
                    distanceSnapshot,
                    "Intermediate node: " + nodes.get(k)
            ));
        }

        int s = index.get(request.getSource());
        int t = index.get(request.getDestination());

        if (dist[s][t] == Integer.MAX_VALUE) {
            result.setMessage("No route available between " + request.getSource()
                    + " and " + request.getDestination() + ".");
            return result;
        }

        List<String> path = new ArrayList<>();
        int current = s;

        while (current != -1) {
            path.add(nodes.get(current));
            current = next[current][t];
        }

        Map<String, Integer> distance = new HashMap<>();
        distance.put(request.getDestination(), dist[s][t]);

        Map<String, String> previous = new HashMap<>();
        for (int i = 0; i < path.size() - 1; i++) {
            previous.put(path.get(i + 1), path.get(i));
        }

        RouteResult finished = finish(result, previous, distance, new LinkedHashSet<>(nodes));
        finished.setVisitedNodes(n * n); // all-pairs matrix cells evaluated
        return finished;
    }
}
