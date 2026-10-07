package com.network.routingsimulator.controller;

import com.network.routingsimulator.dto.NetworkDto;
import com.network.routingsimulator.service.NetworkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/networks")
@CrossOrigin("*")
public class NetworkController {

    private final NetworkService networkService;

    public NetworkController(NetworkService networkService) {
        this.networkService = networkService;
    }

    @PostMapping
    public NetworkDto save(@RequestBody NetworkDto dto) {
        return networkService.saveNetwork(dto);
    }

    @GetMapping
    public List<NetworkDto> list() {
        return networkService.listNetworks();
    }

    @GetMapping("/{id}")
    public NetworkDto load(@PathVariable Long id) {
        return networkService.loadNetwork(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        networkService.deleteNetwork(id);
        return ResponseEntity.ok().build();
    }

    /* ============ ROUTING HISTORY ============ */

    @GetMapping("/history")
    public List<Map<String, Object>> history() {
        return networkService.listHistory();
    }

    @DeleteMapping("/history")
    public ResponseEntity<Void> clearHistory() {
        networkService.clearHistory();
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<Void> deleteHistory(@PathVariable Long id) {
        networkService.deleteHistoryEntry(id);
        return ResponseEntity.ok().build();
    }
}
