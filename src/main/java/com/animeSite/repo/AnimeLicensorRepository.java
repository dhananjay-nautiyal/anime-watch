package com.animeSite.repo;

import com.animeSite.persist.AnimeLicensor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeLicensorRepository extends JpaRepository<AnimeLicensor, UUID> {
    Optional<AnimeLicensor> findByMalId(Integer malId);
    List<AnimeLicensor> findAllByMalIdIn(java.util.Collection<Integer> malIds);
}
