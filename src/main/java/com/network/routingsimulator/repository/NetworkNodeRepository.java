package com.network.routingsimulator.repository;

import com.network.routingsimulator.entity.NetworkNodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NetworkNodeRepository extends JpaRepository<NetworkNodeEntity, Long> {

    List<NetworkNodeEntity> findByNetworkId(Long networkId);

    void deleteByNetworkId(Long networkId);
}
