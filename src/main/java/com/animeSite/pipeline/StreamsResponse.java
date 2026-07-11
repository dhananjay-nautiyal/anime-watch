package com.animeSite.pipeline;

import java.util.List;
import java.util.Map;

public class StreamsResponse {
    private final String provider;
    private final String type;
    private final List<LanguageGroup> languages;

    public StreamsResponse(String provider, String type, List<LanguageGroup> languages) {
        this.provider = provider;
        this.type = type;
        this.languages = languages;
    }

    public String getProvider() { return provider; }
    public String getType() { return type; }
    public List<LanguageGroup> getLanguages() { return languages; }

    public static class LanguageGroup {
        private final String language;
        private final List<ServerInfo> servers;

        public LanguageGroup(String language, List<ServerInfo> servers) {
            this.language = language;
            this.servers = servers;
        }

        public String getLanguage() { return language; }
        public List<ServerInfo> getServers() { return servers; }
    }

    public static class ServerInfo {
        private final String label;
        private final String url;
        private final String proxyUrl;
        private final List<String> qualities;
        private final List<SubtitleInfo> subtitles;
        private final List<AudioTrack> audioTracks;
        private final String status;
        private final long latencyMs;
        private final boolean verified;

        public ServerInfo(String label, String url, String proxyUrl, List<String> qualities,
                          List<SubtitleInfo> subtitles, List<AudioTrack> audioTracks,
                          String status, long latencyMs, boolean verified) {
            this.label = label;
            this.url = url;
            this.proxyUrl = proxyUrl;
            this.qualities = qualities;
            this.subtitles = subtitles;
            this.audioTracks = audioTracks;
            this.status = status;
            this.latencyMs = latencyMs;
            this.verified = verified;
        }

        public String getLabel() { return label; }
        public String getUrl() { return url; }
        public String getProxyUrl() { return proxyUrl; }
        public List<String> getQualities() { return qualities; }
        public List<SubtitleInfo> getSubtitles() { return subtitles; }
        public List<AudioTrack> getAudioTracks() { return audioTracks; }
        public String getStatus() { return status; }
        public long getLatencyMs() { return latencyMs; }
        public boolean isVerified() { return verified; }
    }

    public static class SubtitleInfo {
        private final String label;
        private final String language;
        private final String url;

        public SubtitleInfo(String label, String language, String url) {
            this.label = label;
            this.language = language;
            this.url = url;
        }

        public String getLabel() { return label; }
        public String getLanguage() { return language; }
        public String getUrl() { return url; }
    }

    public static class AudioTrack {
        private final String label;
        private final String language;

        public AudioTrack(String label, String language) {
            this.label = label;
            this.language = language;
        }

        public String getLabel() { return label; }
        public String getLanguage() { return language; }
    }
}
