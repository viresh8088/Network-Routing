package com.network.routingsimulator.repository;

import com.network.routingsimulator.entity.NetworkEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NetworkRepository extends JpaRepository<NetworkEntity, Long> {
}
