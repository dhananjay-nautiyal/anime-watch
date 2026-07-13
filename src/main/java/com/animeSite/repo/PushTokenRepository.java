package com.animeSite.repo;

import com.animeSite.persist.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PushTokenRepository extends JpaRepository<PushToken, UUID> {
    List<PushToken> findByUserIdAndActiveTrue(UUID userId);
    Optional<PushToken> findByExpoPushTokenAndActiveTrue(String expoPushToken);
    List<PushToken> findByActiveTrue();
}
