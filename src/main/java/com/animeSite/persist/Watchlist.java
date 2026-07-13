package com.animeSite.persist;

import com.animeSite.constant.WatchlistStatus;
import com.animeSite.core.audit.Auditable;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.UUID;

@Entity
@Table(name = "watchlist", indexes = {
    @Index(name = "idx_watchlist_user_id", columnList = "user_id"),
    @Index(name = "idx_watchlist_anime_id", columnList = "anime_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Watchlist extends Auditable {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anime_id", nullable = false)
    private Anime anime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WatchlistStatus status;
}
