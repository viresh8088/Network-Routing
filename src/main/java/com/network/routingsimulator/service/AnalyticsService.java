package com.network.routingsimulator.service;

import com.network.routingsimulator.dto.GraphRequest;
import com.network.routingsimulator.model.Edge;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Computes network performance analytics and health status.
 */
@Service
public class AnalyticsService {

    public Map<String, Object> analyze(GraphRequest request) {

        List<Edge> edges = request.getEdges() == null ? List.of() : request.getEdges();
        List<String> nodes = request.getNodes() == null ? List.of() : request.getNodes();
        List<String> failedNodes = request.getFailedNodes() == null ? List.of() : request.getFailedNodes();
        List<String> failedEdges = request.getFailedEdges() == null ? List.of() : request.getFailedEdges();

        int nodeCount = nodes.size();
        int edgeCount = edges.size();

        long congestedLinks = edges.stream()
                .filter(e -> "HIGH".equalsIgnoreCase(e.getTrafficLevel()) && !e.isDisabled())
                .count();

        long warningLinks = edges.stream()
                .filter(e -> "MEDIUM".equalsIgnoreCase(e.getTrafficLevel()) && !e.isDisabled())
                .count();

        long disabledLinks = edges.stream().filter(Edge::isDisabled).count()
                + failedEdges.size();

        double averageWeight = edges.stream()
                .mapToInt(Edge::getWeight)
                .average()
                .orElse(0);

        double averageEffectiveCost = edges.stream()
                .mapToInt(e -> request.isUseTraffic() ? e.effectiveCost() : e.getWeight())
                .average()
                .orElse(0);

        double averageLatency = edges.stream()
                .mapToInt(Edge::getLatency)
                .average()
                .orElse(0);

        // Utilization: LOW = 15%, MEDIUM = 55%, HIGH = 85%
        double utilization = edges.isEmpty()
                ? 0
                : edges.stream()
                    .filter(e -> !e.isDisabled())
                    .mapToInt(e -> switch (e.getTrafficLevel() == null ? "LOW" : e.getTrafficLevel().toUpperCase()) {
                        case "HIGH" -> 85;
                        case "MEDIUM" -> 55;
                        default -> 15;
                    })
                    .average()
                    .orElse(0);

        // Network density
        double density;
        if (nodeCount < 2 || edgeCount == 0) {
            density = 0;
        } else if (request.isDirected()) {
            density = (double) edgeCount / (nodeCount * (nodeCount - 1));
        } else {
            density = (2.0 * edgeCount) / (nodeCount * (nodeCount - 1.0));
        }

        String health;
        String healthMessage;

        if (!failedNodes.isEmpty() || disabledLinks > 0 || utilization >= 75) {
            health = "CRITICAL";
            healthMessage = "Network critical: failures or heavy congestion detected.";
        } else if (congestedLinks > 0 || utilization >= 55) {
            health = "WARNING";
            healthMessage = "Network degraded: congested links detected.";
        } else {
            health = "HEALTHY";
            healthMessage = "All links operating normally.";
        }

        // ---- Composite health score (0-100) -------------------------------
        // Penalises failed links/nodes, congestion, latency and load.
        long healthyLinks = edges.stream().filter(e -> !e.isDisabled()).count()
                - failedEdges.size();

        long highTrafficAlive = edges.stream()
                .filter(e -> !e.isDisabled() && "HIGH".equalsIgnoreCase(e.getTrafficLevel()))
                .count();

        long mediumTrafficAlive = edges.stream()
                .filter(e -> !e.isDisabled() && "MEDIUM".equalsIgnoreCase(e.getTrafficLevel()))
                .count();

        double score = 100.0;
        score -= Math.min(45, disabledLinks * 9.0);            // outages dominate
        score -= Math.min(25, failedNodes.size() * 12.0);      // node loss
        score -= Math.min(24, highTrafficAlive * 6.0);         // congestion
        score -= Math.min(10, mediumTrafficAlive * 2.0);       // mild load
        score -= Math.min(10, averageLatency / 20.0);          // latency drag
        score -= Math.min(10, Math.max(0, utilization - 50) / 5.0); // overload

        int healthScore = (int) Math.round(Math.max(5, Math.min(100, score)));

        String status = healthScore >= 80 ? "Healthy"
                : healthScore >= 55 ? "Warning" : "Critical";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("health", health);
        result.put("healthMessage", healthMessage);
        result.put("healthScore", healthScore);
        result.put("healthStatus", status);
        result.put("healthyLinks", Math.max(healthyLinks, 0));
        result.put("highTrafficLinks", highTrafficAlive);
        result.put("totalNodes", nodeCount);
        result.put("activeNodes", nodeCount - failedNodes.size());
        result.put("totalEdges", edgeCount);
        result.put("activeConnections", edgeCount - disabledLinks);
        result.put("congestedLinks", congestedLinks);
        result.put("warningLinks", warningLinks);
        result.put("failedLinks", disabledLinks);
        result.put("failedNodes", failedNodes.size());
        result.put("averageWeight", Math.round(averageWeight * 10) / 10.0);
        result.put("averageEffectiveCost", Math.round(averageEffectiveCost * 10) / 10.0);
        result.put("averageLatency", Math.round(averageLatency * 10) / 10.0);
        result.put("networkDensity", Math.round(density * 1000) / 10.0);
        result.put("utilization", Math.round(utilization));

        return result;
    }
}
