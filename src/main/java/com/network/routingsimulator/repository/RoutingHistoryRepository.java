package com.network.routingsimulator.repository;

import com.network.routingsimulator.entity.RoutingHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoutingHistoryRepository extends JpaRepository<RoutingHistoryEntity, Long> {

    List<RoutingHistoryEntity> findAllByOrderByCreatedAtDesc();
}
