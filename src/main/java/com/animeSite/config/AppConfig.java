package com.animeSite.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
@EnableCaching
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        RestTemplate restTemplate = new RestTemplate(factory);
        restTemplate.setInterceptors(List.of((request, body, execution) -> {
            request.getHeaders().set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            return execution.execute(request, body);
        }));
        return restTemplate;
    }

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("anime", "trending", "seasonal", "search");
    }
}
