package com.network.routingsimulator.repository;

import com.network.routingsimulator.entity.NetworkEdgeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NetworkEdgeRepository extends JpaRepository<NetworkEdgeEntity, Long> {

    List<NetworkEdgeEntity> findByNetworkId(Long networkId);

    void deleteByNetworkId(Long networkId);
}
