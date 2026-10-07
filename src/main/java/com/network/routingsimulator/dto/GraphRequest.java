package com.network.routingsimulator.dto;

import com.network.routingsimulator.model.Edge;

import java.util.List;

public class GraphRequest {

    private List<Edge> edges;
    private List<String> nodes;
    private String source;
    private String destination;
    private String algorithm = "DIJKSTRA";
    private boolean directed = true;
    private boolean useTraffic = false;
    private List<String> failedNodes = List.of();
    private List<String> failedEdges = List.of(); // "A->B" format

    public GraphRequest() {
    }

    public List<Edge> getEdges() {
        return edges;
    }

    public void setEdges(List<Edge> edges) {
        this.edges = edges;
    }

    public List<String> getNodes() {
        return nodes;
    }

    public void setNodes(List<String> nodes) {
        this.nodes = nodes;
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

    public String getAlgorithm() {
        return algorithm;
    }

    public void setAlgorithm(String algorithm) {
        this.algorithm = algorithm;
    }

    public boolean isDirected() {
        return directed;
    }

    public void setDirected(boolean directed) {
        this.directed = directed;
    }

    public boolean isUseTraffic() {
        return useTraffic;
    }

    public void setUseTraffic(boolean useTraffic) {
        this.useTraffic = useTraffic;
    }

    public List<String> getFailedNodes() {
        return failedNodes;
    }

    public void setFailedNodes(List<String> failedNodes) {
        this.failedNodes = failedNodes;
    }

    public List<String> getFailedEdges() {
        return failedEdges;
    }

    public void setFailedEdges(List<String> failedEdges) {
        this.failedEdges = failedEdges;
    }
}
