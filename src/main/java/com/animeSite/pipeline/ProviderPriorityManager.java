package com.animeSite.pipeline;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProviderPriorityManager {

    private static final Logger log = LoggerFactory.getLogger(ProviderPriorityManager.class);

    @Value("${app.providers.priority:AnimeSuge,Anineko,GoGoAnime}")
    private String priorityConfig;

    @Value("${app.providers.disabled:}")
    private String disabledConfig;

    private final List<StreamProvider> allProviders;
    private volatile List<String> priorityList;
    private volatile Set<String> disabledSet;

    public ProviderPriorityManager(List<StreamProvider> allProviders) {
        this.allProviders = allProviders;
        this.priorityList = List.of();
        this.disabledSet = Set.of();
    }

    @PostConstruct
    public void init() {
        reload();
    }

    public synchronized void reload() {
        this.priorityList = parseList(this.priorityConfig);
        this.disabledSet = parseSet(this.disabledConfig);

        List<String> active = getActiveProviders().stream()
            .map(StreamProvider::getName)
            .collect(Collectors.toList());

        log.info("[PRIORITY] Reloaded | config={} disabled={} active={}",
            priorityList, disabledSet, active);
    }

    public List<StreamProvider> getActiveProviders() {
        return priorityList.stream()
            .map(String::trim)
            .filter(name -> !name.isEmpty())
            .filter(name -> !disabledSet.contains(name.toLowerCase()))
            .map(this::findProvider)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    public List<StreamProvider> getAllProviders() {
        return allProviders;
    }

    public boolean isEnabled(String name) {
        return !disabledSet.contains(name.toLowerCase());
    }

    public boolean existsInPriority(String name) {
        return priorityList.stream().anyMatch(p -> p.equalsIgnoreCase(name.trim()));
    }

    public List<String> getPriorityList() {
        return new ArrayList<>(priorityList);
    }

    public Set<String> getDisabledProviders() {
        return new HashSet<>(disabledSet);
    }

    private StreamProvider findProvider(String name) {
        return allProviders.stream()
            .filter(p -> p.getName().equalsIgnoreCase(name))
            .findFirst().orElse(null);
    }

    private List<String> parseList(String config) {
        if (config == null || config.isBlank()) return List.of();
        return Arrays.stream(config.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
    }

    private Set<String> parseSet(String config) {
        if (config == null || config.isBlank()) return Set.of();
        return Arrays.stream(config.split(","))
            .map(s -> s.trim().toLowerCase())
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toSet());
    }
}
