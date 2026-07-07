package com.animeSite.persist;

import com.animeSite.core.audit.Auditable;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.UUID;

@Entity
@Table(name = "reviews", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"anime_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Review extends Auditable {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anime_id", nullable = false)
    private Anime anime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"password", "email", "role", "isVerified", "createdAt", "updatedAt", "createdBy", "updatedBy"})
    private User user;

    @Column(nullable = false)
    private int starRating;

    @Column(columnDefinition = "TEXT")
    private String comment;
}
