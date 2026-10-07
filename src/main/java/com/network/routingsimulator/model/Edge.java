package com.network.routingsimulator.model;

public class Edge {
 
    private String source;
    private String destination;
    private int weight;

    // Traffic / physical attributes for realistic simulation
    private int latency;               // ms
    private int capacity = 100;        // Mbps
    private String trafficLevel = "LOW"; // LOW | MEDIUM | HIGH
    private boolean disabled;          // failure simulation

    public Edge() {
    }

    public Edge(String source, String destination, int weight) {
        this.source = source;
        this.destination = destination;
        this.weight = weight;
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

    public int getWeight() {
        return weight;
    }

    public void setWeight(int weight) {
        this.weight = weight;
    }

    public int getLatency() {
        return latency;
    }

    public void setLatency(int latency) {
        this.latency = latency;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public String getTrafficLevel() {
        return trafficLevel;
    }

    public void setTrafficLevel(String trafficLevel) {
        this.trafficLevel = trafficLevel;
    }

    public boolean isDisabled() {
        return disabled;
    }

    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
    }

    /**
     * Dynamic cost used by routing algorithms:
     * Current Cost = Distance(weight) + Traffic Penalty + Latency
     */
    public int effectiveCost() {

        int penalty = switch (trafficLevel == null ? "LOW" : trafficLevel.toUpperCase()) {
            case "HIGH" -> (int) Math.round(weight * 0.8);
            case "MEDIUM" -> (int) Math.round(weight * 0.3);
            default -> 0;
        };

        return weight + penalty + latency;
    }
}