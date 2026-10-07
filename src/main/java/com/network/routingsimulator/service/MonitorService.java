package com.network.routingsimulator.service;

import com.network.routingsimulator.dto.GraphRequest;
import com.network.routingsimulator.dto.RouteResult;
import com.network.routingsimulator.model.Edge;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Continuous network monitoring loop that powers AUTOMATIC DYNAMIC REROUTING.
 *
 * A "watch cycle" inspects the active route; if any traversed link is
 * congested (HIGH traffic) or has failed, the engine recalculates the best
 * alternative and logs a rerouting event — exactly like a self-healing network.
 */
@Service
public class MonitorService {

    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("HH:mm:ss");

    private final RoutingService routingService;

    private final List<Map<String, Object>> rerouteLog =
            Collections.synchronizedList(new ArrayList<>());

    public MonitorService(RoutingService routingService) {
        this.routingService = routingService;
    }

    /**
     * One monitoring tick: verify the current route and reroute on demand.
     */
    public Map<String, Object> watchCycle(GraphRequest request) {

        // Baseline = the "pre-incident" route: it ignores congestion and is
        // allowed to cross failed links, so we can detect *which* links on the
        // active route have degraded or gone down.
        GraphRequest baseline = copy(request);
        baseline.setAlgorithm("DIJKSTRA");
        baseline.setUseTraffic(false);
        baseline.setFailedNodes(List.of());
        baseline.setFailedEdges(List.of());
        baseline.setEdges(unblockedEdges(request));

        RouteResult current = routingService.route(baseline);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalTime.now().format(TIME_FMT));
        response.put("rerouted", false);
        response.put("status", "MONITORING");

        if (!current.isFound()) {
            response.put("status", "DOWN");
            response.put("message", "No active route exists between the selected nodes.");
            return response;
        }

        // Inspect every link the active route traverses
        List<String> congested = new ArrayList<>();
        List<String> broken = new ArrayList<>();
        List<String> failedNodes = request.getFailedNodes() == null ? List.of() : request.getFailedNodes();

        for (int i = 0; i < current.getPath().size() - 1; i++) {
            String from = current.getPath().get(i);
            String to = current.getPath().get(i + 1);
            Edge edge = findEdge(from, to, request);

            if (edge == null || edge.isDisabled()
                    || isEdgeFailed(edge, request)
                    || failedNodes.contains(from)
                    || failedNodes.contains(to)) {
                broken.add(from + " → " + to);
            } else if ("HIGH".equalsIgnoreCase(edge.getTrafficLevel())) {
                congested.add(from + " → " + to);
            }
        }

        if (broken.isEmpty() && congested.isEmpty()) {
            response.put("activePath", String.join(" → ", current.getPath()));
            response.put("cost", current.getCost());
            response.put("message", "All links on the active route are healthy.");
            return response;
        }

        // Anomaly detected → recalculate using the traffic-aware cost engine
        GraphRequest aware = copy(request);
        aware.setAlgorithm("DIJKSTRA");
        aware.setUseTraffic(true);

        RouteResult alternative = routingService.route(aware);

        String trigger = broken.isEmpty() ? "CONGESTION" : "LINK_FAILURE";
        response.put("trigger", trigger);
        response.put("affectedLinks", broken.isEmpty() ? congested : broken);
        response.put("oldPath", String.join(" → ", current.getPath()));
        response.put("oldCost", current.getCost());

        String message;

        if (alternative.isFound()
                && !alternative.getPath().equals(current.getPath())) {

            message = "⚠️ " + describe(trigger, congested, broken)
                    + " → 🔄 Route recalculated: "
                    + String.join(" → ", alternative.getPath())
                    + " (cost " + alternative.getCost() + ")";

            response.put("rerouted", true);
            response.put("status", "REROUTED");
            response.put("newPath", String.join(" → ", alternative.getPath()));
            response.put("newCost", alternative.getCost());

            rerouteLog.add(0, event(trigger,
                    String.join(" → ", current.getPath()),
                    String.join(" → ", alternative.getPath()),
                    current.getCost(), alternative.getCost()));

        } else if (alternative.isFound()) {
            message = "⚠️ " + describe(trigger, congested, broken)
                    + " — current route remains optimal.";
            response.put("status", "OPTIMAL");
            response.put("newPath", String.join(" → ", alternative.getPath()));
            response.put("newCost", alternative.getCost());
        } else {
            message = "🚨 " + describe(trigger, congested, broken)
                    + " — no alternate route available!";
            response.put("status", "ISOLATED");
        }

        response.put("message", message);
        return response;
    }

    public List<Map<String, Object>> rerouteEvents() {
        return List.copyOf(rerouteLog);
    }

    public int rerouteCount() {
        return rerouteLog.size();
    }

    public void clearEvents() {
        rerouteLog.clear();
    }

    /* ================= helpers ================= */

    private Map<String, Object> event(String trigger,
                                      String oldPath, String newPath,
                                      int oldCost, int newCost) {

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("time", LocalTime.now().format(TIME_FMT));
        event.put("trigger", trigger);
        event.put("oldPath", oldPath);
        event.put("newPath", newPath);
        event.put("oldCost", oldCost);
        event.put("newCost", newCost);
        return event;
    }

    private String describe(String trigger, List<String> congested, List<String> broken) {
        if ("LINK_FAILURE".equals(trigger)) {
            return "Link failure on " + String.join(", ", broken);
        }
        return "Congestion detected on " + String.join(", ", congested);
    }

    private boolean isEdgeFailed(Edge edge, GraphRequest request) {
        String key = edge.getSource() + "->" + edge.getDestination();
        String reverse = edge.getDestination() + "->" + edge.getSource();
        List<String> failed = request.getFailedEdges();
        return failed != null
                && (failed.contains(key) || (!request.isDirected() && failed.contains(reverse)));
    }

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

    private GraphRequest copy(GraphRequest source) {

        GraphRequest copy = new GraphRequest();
        copy.setEdges(source.getEdges());
        copy.setNodes(source.getNodes());
        copy.setSource(source.getSource());
        copy.setDestination(source.getDestination());
        copy.setDirected(source.isDirected());
        copy.setUseTraffic(source.isUseTraffic());
        copy.setFailedNodes(source.getFailedNodes() == null ? List.of() : source.getFailedNodes());
        copy.setFailedEdges(source.getFailedEdges() == null ? List.of() : source.getFailedEdges());
        return copy;
    }

    /**
     * Shallow copy of every edge with failure flags cleared, so the baseline
     * route reflects the network *before* the incident.
     */
    private List<Edge> unblockedEdges(GraphRequest request) {

        if (request.getEdges() == null) {
            return List.of();
        }

        List<Edge> copies = new ArrayList<>();

        for (Edge edge : request.getEdges()) {
            Edge clone = new Edge(edge.getSource(), edge.getDestination(), edge.getWeight());
            clone.setLatency(edge.getLatency());
            clone.setCapacity(edge.getCapacity());
            clone.setTrafficLevel(edge.getTrafficLevel());
            clone.setDisabled(false);
            copies.add(clone);
        }

        return copies;
    }
}
