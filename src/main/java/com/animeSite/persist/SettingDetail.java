package com.animeSite.persist;

import com.animeSite.core.audit.Auditable;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "setting_detail", indexes = {
    @Index(name = "idx_setting_detail_setting_id", columnList = "setting_id"),
    @Index(name = "idx_setting_detail_key", columnList = "setting_key")
})
@SQLRestriction("is_active = 1")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SettingDetail extends Auditable implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "setting_id")
    private Setting setting;

    @Column(name = "setting_key")
    private String settingKey;

    @Column(name = "setting_value", columnDefinition = "TEXT")
    private String settingValue;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active")
    private Integer isActive = 1;
}
