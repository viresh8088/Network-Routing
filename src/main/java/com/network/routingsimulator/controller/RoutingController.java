package com.network.routingsimulator.controller;

import com.network.routingsimulator.dto.GraphRequest;
import com.network.routingsimulator.dto.RouteResult;
import com.network.routingsimulator.service.AnalyticsService;
import com.network.routingsimulator.service.MonitorService;
import com.network.routingsimulator.service.NetworkService;
import com.network.routingsimulator.service.RoutingService;
import com.network.routingsimulator.service.ScenarioService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routing")
@CrossOrigin("*")
public class RoutingController {

    private final RoutingService routingService;
    private final NetworkService networkService;
    private final AnalyticsService analyticsService;
    private final MonitorService monitorService;
    private final ScenarioService scenarioService;

    public RoutingController(RoutingService routingService,
                             NetworkService networkService,
                             AnalyticsService analyticsService,
                             MonitorService monitorService,
                             ScenarioService scenarioService) {

        this.routingService = routingService;
        this.networkService = networkService;
        this.analyticsService = analyticsService;
        this.monitorService = monitorService;
        this.scenarioService = scenarioService;
    }

    @PostMapping("/shortest-path")
    public RouteResult shortestPath(@RequestBody GraphRequest request) {

        RouteResult result = routingService.route(request);

        // Record history in MySQL (ignore DB outages so routing still works)
        if (result.isFound()) {
            try {
                networkService.recordHistory(result, request);
            } catch (Exception ignored) {
                // persistence is optional during demo
            }
        }

        return result;
    }

    @PostMapping("/compare")
    public List<RouteResult> compare(@RequestBody GraphRequest request) {
        return routingService.compareAll(request);
    }

    @PostMapping("/analytics")
    public Map<String, Object> analytics(@RequestBody GraphRequest request) {
        return analyticsService.analyze(request);
    }

    /* ============ AUTOMATIC DYNAMIC REROUTING ============ */

    @PostMapping("/monitor")
    public Map<String, Object> monitor(@RequestBody GraphRequest request) {
        return monitorService.watchCycle(request);
    }

    @GetMapping("/reroute-events")
    public List<Map<String, Object>> rerouteEvents() {
        return monitorService.rerouteEvents();
    }

    /* ============ ONE-CLICK DEMO SCENARIOS ============ */

    @GetMapping("/scenarios")
    public List<Map<String, Object>> scenarios() {
        return scenarioService.all();
    }
}
