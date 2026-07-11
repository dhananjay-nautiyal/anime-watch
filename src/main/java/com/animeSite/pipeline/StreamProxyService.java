package com.animeSite.pipeline;

import com.animeSite.repo.AnimeProviderCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class StreamProxyService {

    private static final Logger log = LoggerFactory.getLogger(StreamProxyService.class);
    private static final int CONNECT_TIMEOUT = 10000;
    private static final int READ_TIMEOUT = 30000;
    private static final int MAX_CACHED_PLAYLIST_KB = 500;
    
    private final RestTemplate restTemplate;
    private final ProviderResolver providerResolver;
    private final AnimeProviderCacheRepository cacheRepository;
    
    private final ConcurrentHashMap<String, CachedEntry> cache = new ConcurrentHashMap<>();
    
    public StreamProxyService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
                               ProviderResolver providerResolver,
                               AnimeProviderCacheRepository cacheRepository) {
        this.restTemplate = restTemplate;
        this.providerResolver = providerResolver;
        this.cacheRepository = cacheRepository;
    }
    
    public ProxyResult proxyStream(String url, String referer, String acceptHeader) {
        long start = System.currentTimeMillis();
        log.info("[PROXY] REQUEST | url='{}' referer='{}'", url, referer);
        
        String cacheKey = "proxy:" + url;
        CachedEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[PROXY] CACHE_HIT | url='{}' size={} age={}ms duration={}ms", 
                url, cached.result().data().length, System.currentTimeMillis() - cached.timestamp(), elapsed);
            return cached.result();
        }
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.set("Referer", referer != null ? referer : "https://anineko.to/");
            headers.set("Origin", referer != null ? referer : "https://anineko.to/");
            if (acceptHeader != null) {
                headers.set("Accept", acceptHeader);
            }
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                URI.create(url), HttpMethod.GET, entity, byte[].class);
            
            long elapsed = System.currentTimeMillis() - start;
            HttpStatusCode status = response.getStatusCode();
            byte[] body = response.getBody();
            String contentType = response.getHeaders().getContentType() != null ? 
                response.getHeaders().getContentType().toString() : "application/octet-stream";
            
            log.info("[PROXY] RESPONSE | url='{}' status={} contentType='{}' size={} duration={}ms",
                url, status.value(), contentType, body != null ? body.length : 0, elapsed);
            
            if (!status.is2xxSuccessful()) {
                log.warn("[PROXY] HTTP_{} | url='{}' duration={}ms", status.value(), url, elapsed);
                return new ProxyResult(status.value(), ("HTTP " + status.value()).getBytes(), contentType, elapsed);
            }
            
            if (body == null || body.length == 0) {
                log.warn("[PROXY] EMPTY_BODY | url='{}'", url);
                return new ProxyResult(204, new byte[0], contentType, elapsed);
            }
            
            boolean isPlaylist = contentType.contains("m3u8") || contentType.contains("vnd.apple.mpegurl") || 
                                 url.contains(".m3u8") || 
                                 (body.length < MAX_CACHED_PLAYLIST_KB && new String(body, java.nio.charset.StandardCharsets.UTF_8).contains("#EXTM3U"));
            
            if (isPlaylist) {
                String playlistContent = new String(body, java.nio.charset.StandardCharsets.UTF_8);
                String baseUrl = HlsPlaylistRewriter.detectBaseUrl(url, url);
                String rewritten = HlsPlaylistRewriter.rewritePlaylist(playlistContent, baseUrl, referer);
                byte[] rewrittenBytes = rewritten.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                
                ProxyResult result = new ProxyResult(status.value(), rewrittenBytes, "application/vnd.apple.mpegurl", elapsed);
                
                cache.put(cacheKey, new CachedEntry(result, System.currentTimeMillis(), TimeUnit.SECONDS.toMillis(30)));
                
                return result;
            }
            
            ProxyResult result = new ProxyResult(status.value(), body, contentType, elapsed);
            if (body.length < 1024 * 1024) {
                cache.put(cacheKey, new CachedEntry(result, System.currentTimeMillis(), TimeUnit.MINUTES.toMillis(5)));
            }
            
            return result;
            
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[PROXY] FAILED | url='{}' error='{}' duration={}ms", url, e.getMessage(), elapsed);
            return new ProxyResult(502, ("Proxy error: " + e.getMessage()).getBytes(), "text/plain", elapsed);
        }
    }
    
    public void clearCache() {
        cache.clear();
        log.info("[PROXY] CACHE_CLEARED");
    }
    
    public void clearCacheForUrl(String url) {
        String cacheKey = "proxy:" + url;
        cache.remove(cacheKey);
        log.info("[PROXY] CACHE_CLEARED | url='{}'", url);
    }
    
    public record ProxyResult(int status, byte[] data, String contentType, long durationMs) {
        public boolean isSuccess() { return status >= 200 && status < 300; }
    }
    
    private record CachedEntry(ProxyResult result, long timestamp, long ttl) {
        public boolean isExpired() { return System.currentTimeMillis() - timestamp > ttl; }
    }
}
