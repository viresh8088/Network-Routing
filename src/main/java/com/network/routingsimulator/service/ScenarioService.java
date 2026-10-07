package com.network.routingsimulator.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * One-click demo scenarios for presentations: each scenario returns a full
 * network configuration (topology + traffic pattern + failures) so the
 * dashboard can be set up instantly without manual data entry.
 */
@Service
public class ScenarioService {

    public List<Map<String, Object>> all() {

        List<Map<String, Object>> scenarios = new ArrayList<>();
        scenarios.add(build("NORMAL", "Normal Network",
                "Balanced traffic, every link operational."));
        scenarios.add(build("HEAVY_TRAFFIC", "Heavy Traffic",
                "Primary corridor saturated — watch automatic rerouting kick in."));
        scenarios.add(build("NETWORK_FAILURE", "Network Failure",
                "Link B → C goes down — the engine searches an alternate path."));
        scenarios.add(build("MULTIPLE_FAILURES", "Multiple Failures",
                "Two links and one node offline — full resilience test."));
        scenarios.add(build("CONGESTED", "Congested Network",
                "Most links carry HIGH traffic — costs spike across the topology."));
        scenarios.add(build("LARGE", "Large Network",
                "12-node metro topology for algorithm stress testing."));
        return scenarios;
    }

    private Map<String, Object> build(String id, String label, String description) {

        Map<String, Object> scenario = new LinkedHashMap<>();
        scenario.put("id", id);
        scenario.put("label", label);
        scenario.put("description", description);

        switch (id) {

            case "NORMAL" -> {
                scenario.put("directed", true);
                scenario.put("useTraffic", true);
                scenario.put("source", "A");
                scenario.put("destination", "G");
                scenario.put("nodes", List.of("A", "B", "C", "D", "E", "F", "G"));
                scenario.put("edges", corridor("LOW", "LOW", "LOW", "LOW", "LOW", "LOW", "LOW"));
                scenario.put("failedNodes", List.of());
                scenario.put("disabledEdges", List.of());
            }

            case "HEAVY_TRAFFIC" -> {
                scenario.put("directed", true);
                scenario.put("useTraffic", true);
                scenario.put("source", "A");
                scenario.put("destination", "G");
                scenario.put("nodes", List.of("A", "B", "C", "D", "E", "F", "G"));
                scenario.put("edges", corridor("HIGH", "HIGH", "LOW", "LOW", "MEDIUM", "LOW", "LOW"));
                scenario.put("failedNodes", List.of());
                scenario.put("disabledEdges", List.of());
            }

            case "NETWORK_FAILURE" -> {
                scenario.put("directed", true);
                scenario.put("useTraffic", true);
                scenario.put("source", "A");
                scenario.put("destination", "G");
                scenario.put("nodes", List.of("A", "B", "C", "D", "E", "F", "G"));
                List<Map<String, Object>> edges = corridor("LOW", "LOW", "LOW", "LOW", "LOW", "LOW", "LOW");
                edges.get(1).put("disabled", true); // B → C down
                scenario.put("edges", edges);
                scenario.put("failedNodes", List.of());
                scenario.put("disabledEdges", List.of("B->C"));
            }

            case "MULTIPLE_FAILURES" -> {
                scenario.put("directed", true);
                scenario.put("useTraffic", true);
                scenario.put("source", "A");
                scenario.put("destination", "G");
                scenario.put("nodes", List.of("A", "B", "C", "D", "E", "F", "G"));
                List<Map<String, Object>> edges = corridor("LOW", "LOW", "LOW", "LOW", "LOW", "LOW", "LOW");
                edges.get(1).put("disabled", true); // B → C down
                edges.get(4).put("disabled", true); // C → F down
                scenario.put("edges", edges);
                scenario.put("failedNodes", List.of("E"));
                scenario.put("disabledEdges", List.of("B->C", "C->F"));
            }

            case "CONGESTED" -> {
                scenario.put("directed", true);
                scenario.put("useTraffic", true);
                scenario.put("source", "A");
                scenario.put("destination", "G");
                scenario.put("nodes", List.of("A", "B", "C", "D", "E", "F", "G"));
                scenario.put("edges", corridor("HIGH", "HIGH", "HIGH", "MEDIUM", "HIGH", "MEDIUM", "HIGH"));
                scenario.put("failedNodes", List.of());
                scenario.put("disabledEdges", List.of());
            }

            default -> { // LARGE metro topology (12 nodes)
                scenario.put("directed", false);
                scenario.put("useTraffic", true);
                scenario.put("source", "N1");
                scenario.put("destination", "N12");
                scenario.put("nodes", List.of(
                        "N1", "N2", "N3", "N4", "N5", "N6",
                        "N7", "N8", "N9", "N10", "N11", "N12"));

                Random random = new Random(42);
                List<String> levels = List.of("LOW", "LOW", "MEDIUM", "HIGH");
                List<Map<String, Object>> edges = new ArrayList<>();

                // Ring backbone + chords for alternate paths
                int[][] pairs = {
                        {1, 2}, {2, 3}, {3, 4}, {4, 5}, {5, 6}, {6, 7}, {7, 8},
                        {8, 9}, {9, 10}, {10, 11}, {11, 12}, {12, 1},
                        {1, 5}, {3, 9}, {7, 11}, {2, 6}, {8, 12}
                };

                for (int[] pair : pairs) {
                    Map<String, Object> edge = new LinkedHashMap<>();
                    edge.put("source", "N" + pair[0]);
                    edge.put("destination", "N" + pair[1]);
                    edge.put("weight", 2 + random.nextInt(9));
                    edge.put("latency", 2 + random.nextInt(18));
                    edge.put("capacity", new int[]{100, 200, 400, 800}[random.nextInt(4)]);
                    edge.put("trafficLevel", levels.get(random.nextInt(levels.size())));
                    edge.put("disabled", false);
                    edges.add(edge);
                }

                scenario.put("edges", edges);
                scenario.put("failedNodes", List.of());
                scenario.put("disabledEdges", List.of());
            }
        }

        return scenario;
    }

    /**
     * 7-node corridor: A→B, A→D, B→C, D→E, C→F, E→F, F→G
     * with the given traffic level per link.
     */
    private List<Map<String, Object>> corridor(String ab, String ad, String bc,
                                               String de, String cf, String ef, String fg) {

        String[] levels = {ab, ad, bc, de, cf, ef, fg};
        String[][] links = {
                {"A", "B"}, {"A", "D"}, {"B", "C"},
                {"D", "E"}, {"C", "F"}, {"E", "F"}, {"F", "G"}
        };
        int[] weights = {4, 3, 3, 4, 5, 3, 2};
        int[] latencies = {5, 8, 6, 9, 12, 7, 4};

        List<Map<String, Object>> edges = new ArrayList<>();

        for (int i = 0; i < links.length; i++) {
            Map<String, Object> edge = new LinkedHashMap<>();
            edge.put("source", links[i][0]);
            edge.put("destination", links[i][1]);
            edge.put("weight", weights[i]);
            edge.put("latency", latencies[i]);
            edge.put("capacity", 100);
            edge.put("trafficLevel", levels[i]);
            edge.put("disabled", false);
            edges.add(edge);
        }

        return edges;
    }
}
