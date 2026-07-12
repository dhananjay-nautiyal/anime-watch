package com.animeSite.repo;

import com.animeSite.persist.AnimeTheme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AnimeThemeRepository extends JpaRepository<AnimeTheme, UUID> {
}
