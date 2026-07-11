package com.animeSite.pipeline;

import java.util.ArrayList;
import java.util.List;

public class StreamResult {
    private final String provider;
    private final String type;
    private final List<ServerOption> servers;
    private final String error;

    private StreamResult(String provider, String type, List<ServerOption> servers, String error) {
        this.provider = provider;
        this.type = type;
        this.servers = servers;
        this.error = error;
    }

    public static StreamResult success(String provider, String type, List<ServerOption> servers) {
        return new StreamResult(provider, type, servers, null);
    }

    public static StreamResult failure(String provider, String error) {
        return new StreamResult(provider, null, List.of(), error);
    }

    public boolean isSuccess() { return error == null && !servers.isEmpty(); }
    public String getProvider() { return provider; }
    public String getType() { return type; }
    public List<ServerOption> getServers() { return servers; }
    public String getError() { return error; }
    public String getPrimaryUrl() { return servers.isEmpty() ? null : servers.get(0).url; }

    public static class ServerOption {
        public final String url;
        public final String label;
        public final boolean isBackup;

        public ServerOption(String url, String label, boolean isBackup) {
            this.url = url;
            this.label = label;
            this.isBackup = isBackup;
        }

        public ServerOption(String url, String label) { this(url, label, false); }
    }
}
