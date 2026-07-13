package com.animeSite.persist;

import com.animeSite.core.audit.Auditable;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "push_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PushToken extends Auditable {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private UUID userId;

    @Column(name = "expo_push_token", nullable = false, length = 512)
    private String expoPushToken;

    @Column(nullable = false, length = 20)
    private String platform;

    @Column(nullable = false)
    private boolean active = true;
}
