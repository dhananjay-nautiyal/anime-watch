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
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.setInterceptors(List.of((request, body, execution) -> {
            request.getHeaders().set("User-Agent", "animewatch/1.0");
            return execution.execute(request, body);
        }));
        return restTemplate;
    }

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("anime", "trending", "seasonal", "search");
    }
}
