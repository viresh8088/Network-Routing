package com.network.routingsimulator.service;

import com.network.routingsimulator.dto.GraphRequest;
import com.network.routingsimulator.dto.NetworkDto;
import com.network.routingsimulator.dto.RouteResult;
import com.network.routingsimulator.entity.NetworkEdgeEntity;
import com.network.routingsimulator.entity.NetworkEntity;
import com.network.routingsimulator.entity.NetworkNodeEntity;
import com.network.routingsimulator.entity.RoutingHistoryEntity;
import com.network.routingsimulator.model.Edge;
import com.network.routingsimulator.repository.NetworkEdgeRepository;
import com.network.routingsimulator.repository.NetworkNodeRepository;
import com.network.routingsimulator.repository.NetworkRepository;
import com.network.routingsimulator.repository.RoutingHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class NetworkService {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final NetworkRepository networkRepository;
    private final NetworkNodeRepository nodeRepository;
    private final NetworkEdgeRepository edgeRepository;
    private final RoutingHistoryRepository historyRepository;

    public NetworkService(NetworkRepository networkRepository,
                          NetworkNodeRepository nodeRepository,
                          NetworkEdgeRepository edgeRepository,
                          RoutingHistoryRepository historyRepository) {

        this.networkRepository = networkRepository;
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.historyRepository = historyRepository;
    }

    /* =====================================================
       NETWORK SAVE / LOAD
    ===================================================== */

    @Transactional
    public NetworkDto saveNetwork(NetworkDto dto) {

        NetworkEntity network = new NetworkEntity();
        network.setName(dto.getName() == null || dto.getName().isBlank()
                ? "Untitled Network"
                : dto.getName().trim());
        network.setDirected(dto.isDirected());
        network = networkRepository.save(network);

        if (dto.getNodes() != null) {
            for (String nodeName : dto.getNodes()) {

                NetworkNodeEntity node = new NetworkNodeEntity();
                node.setNetwork(network);
                node.setNodeName(nodeName);
                nodeRepository.save(node);
            }
        }

        if (dto.getEdges() != null) {
            for (Edge edge : dto.getEdges()) {

                NetworkEdgeEntity entity = new NetworkEdgeEntity();
                entity.setNetwork(network);
                entity.setSource(edge.getSource());
                entity.setDestination(edge.getDestination());
                entity.setWeight(edge.getWeight());
                entity.setLatency(edge.getLatency());
                entity.setCapacity(edge.getCapacity());
                entity.setTrafficLevel(edge.getTrafficLevel());
                edgeRepository.save(entity);
            }
        }

        return toDto(network, false);
    }

    public List<NetworkDto> listNetworks() {

        List<NetworkDto> list = new ArrayList<>();

        for (NetworkEntity network : networkRepository.findAll()) {
            list.add(toDto(network, false));
        }

        list.sort(Comparator.comparing(NetworkDto::getId).reversed());
        return list;
    }

    public NetworkDto loadNetwork(Long id) {

        NetworkEntity network = networkRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Network not found: " + id));

        return toDto(network, true);
    }

    @Transactional
    public void deleteNetwork(Long id) {

        nodeRepository.deleteByNetworkId(id);
        edgeRepository.deleteByNetworkId(id);
        networkRepository.deleteById(id);
    }

    private NetworkDto toDto(NetworkEntity network, boolean includeGraph) {

        NetworkDto dto = new NetworkDto();
        dto.setId(network.getId());
        dto.setName(network.getName());
        dto.setDirected(network.isDirected());
        dto.setCreatedAt(network.getCreatedAt() == null
                ? null
                : network.getCreatedAt().format(FORMATTER));

        if (includeGraph) {

            List<String> nodes = new ArrayList<>();
            nodeRepository.findByNetworkId(network.getId())
                    .forEach(node -> nodes.add(node.getNodeName()));

            List<Edge> edges = new ArrayList<>();
            for (NetworkEdgeEntity entity : edgeRepository.findByNetworkId(network.getId())) {

                Edge edge = new Edge(entity.getSource(), entity.getDestination(), entity.getWeight());
                edge.setLatency(entity.getLatency());
                edge.setCapacity(entity.getCapacity());
                edge.setTrafficLevel(entity.getTrafficLevel());
                edges.add(edge);
            }

            dto.setNodes(nodes);
            dto.setEdges(edges);
        } else {

            dto.setNodes(List.of());
            dto.setEdges(List.of());
        }

        return dto;
    }

    /* =====================================================
       ROUTING HISTORY
    ===================================================== */

    public RoutingHistoryEntity recordHistory(RouteResult result) {
        return recordHistory(result, null);
    }

    public RoutingHistoryEntity recordHistory(RouteResult result, GraphRequest request) {

        RoutingHistoryEntity entity = new RoutingHistoryEntity();
        entity.setSourceNode(result.getSource());
        entity.setDestinationNode(result.getDestination());
        entity.setAlgorithm(RoutingService.prettyName(result.getAlgorithm()));
        entity.setPath(String.join(" -> ", result.getPath()));
        entity.setCost(result.getCost());
        entity.setHops(result.getHops());
        entity.setExecutionTimeMs(result.getExecutionTimeMs());
        entity.setConditionLabel(routeCondition(result, request));

        return historyRepository.save(entity);
    }

    /**
     * Human readable context for a route: was it computed under normal
     * conditions, heavy traffic or a link/node failure?
     */
    private String routeCondition(RouteResult result, GraphRequest request) {

        if (request != null) {
            boolean linkDown = (request.getFailedEdges() != null && !request.getFailedEdges().isEmpty())
                    || (request.getFailedNodes() != null && !request.getFailedNodes().isEmpty())
                    || (request.getEdges() != null
                        && request.getEdges().stream().anyMatch(Edge::isDisabled));
            if (linkDown) {
                return "Link Failure";
            }
        }

        if (result.getMetrics() != null) {
            Object traffic = result.getMetrics().get("trafficLevel");
            if ("HIGH".equals(traffic)) {
                return "High Traffic";
            }
            if ("MEDIUM".equals(traffic)) {
                return "Medium Traffic";
            }
        }

        return "Normal";
    }

    public List<Map<String, Object>> listHistory() {

        List<Map<String, Object>> list = new ArrayList<>();

        for (RoutingHistoryEntity entity : historyRepository.findAllByOrderByCreatedAtDesc()) {

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", entity.getId());
            entry.put("source", entity.getSourceNode() == null ? "-" : entity.getSourceNode());
            entry.put("destination", entity.getDestinationNode() == null ? "-" : entity.getDestinationNode());
            entry.put("algorithm", entity.getAlgorithm() == null ? "-" : entity.getAlgorithm());
            entry.put("path", entity.getPath() == null ? "-" : entity.getPath());
            entry.put("cost", entity.getCost());
            entry.put("hops", entity.getHops());
            entry.put("executionTimeMs", entity.getExecutionTimeMs());
            entry.put("condition", entity.getConditionLabel() == null ? "Normal" : entity.getConditionLabel());
            entry.put("date", entity.getCreatedAt() == null
                    ? ""
                    : entity.getCreatedAt().format(FORMATTER));
            list.add(entry);
        }

        return list;
    }

    @Transactional
    public void clearHistory() {
        historyRepository.deleteAll();
    }

    @Transactional
    public void deleteHistoryEntry(Long id) {
        historyRepository.deleteById(id);
    }
}
