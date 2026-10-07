package com.network.routingsimulator.dto;

import java.util.List;
import java.util.Map;

/**
 * Structured JSON result returned by the routing engine.
 */
public class RouteResult {

    private boolean found;
    private String algorithm;
    private String source;
    private String destination;
    private List<String> path;
    private int cost;
    private int hops;
    private double executionTimeMs;
    private String message;
    private int visitedNodes;

    // Route quality metrics (latency / capacity / traffic on the chosen path)
    private Map<String, Object> metrics;

    // Intelligent "why this route" explanation
    private Map<String, Object> decision;

    // Step-by-step trace for animation
    private List<AnimationStep> animation;

    public static class AnimationStep {

        private int stepNumber;
        private String currentNode;
        private List<String> visited;
        private List<String> frontier;
        private List<String> relaxedEdges; // "A->C"
        private Map<String, Integer> distances;
        private String message;

        public int getStepNumber() {
            return stepNumber;
        }

        public void setStepNumber(int stepNumber) {
            this.stepNumber = stepNumber;
        }

        public String getCurrentNode() {
            return currentNode;
        }

        public void setCurrentNode(String currentNode) {
            this.currentNode = currentNode;
        }

        public List<String> getVisited() {
            return visited;
        }

        public void setVisited(List<String> visited) {
            this.visited = visited;
        }

        public List<String> getFrontier() {
            return frontier;
        }

        public void setFrontier(List<String> frontier) {
            this.frontier = frontier;
        }

        public List<String> getRelaxedEdges() {
            return relaxedEdges;
        }

        public void setRelaxedEdges(List<String> relaxedEdges) {
            this.relaxedEdges = relaxedEdges;
        }

        public Map<String, Integer> getDistances() {
            return distances;
        }

        public void setDistances(Map<String, Integer> distances) {
            this.distances = distances;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }

    public boolean isFound() {
        return found;
    }

    public void setFound(boolean found) {
        this.found = found;
    }

    public String getAlgorithm() {
        return algorithm;
    }

    public void setAlgorithm(String algorithm) {
        this.algorithm = algorithm;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public List<String> getPath() {
        return path;
    }

    public void setPath(List<String> path) {
        this.path = path;
    }

    public int getCost() {
        return cost;
    }

    public void setCost(int cost) {
        this.cost = cost;
    }

    public int getHops() {
        return hops;
    }

    public void setHops(int hops) {
        this.hops = hops;
    }

    public double getExecutionTimeMs() {
        return executionTimeMs;
    }

    public void setExecutionTimeMs(double executionTimeMs) {
        this.executionTimeMs = executionTimeMs;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<AnimationStep> getAnimation() {
        return animation;
    }

    public void setAnimation(List<AnimationStep> animation) {
        this.animation = animation;
    }

    public int getVisitedNodes() {
        return visitedNodes;
    }

    public void setVisitedNodes(int visitedNodes) {
        this.visitedNodes = visitedNodes;
    }

    public Map<String, Object> getMetrics() {
        return metrics;
    }

    public void setMetrics(Map<String, Object> metrics) {
        this.metrics = metrics;
    }

    public Map<String, Object> getDecision() {
        return decision;
    }

    public void setDecision(Map<String, Object> decision) {
        this.decision = decision;
    }
}
