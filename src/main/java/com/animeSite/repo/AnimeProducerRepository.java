package com.animeSite.repo;

import com.animeSite.persist.AnimeProducer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeProducerRepository extends JpaRepository<AnimeProducer, UUID> {
    Optional<AnimeProducer> findByMalId(Integer malId);
    List<AnimeProducer> findAllByMalIdIn(java.util.Collection<Integer> malIds);
}
