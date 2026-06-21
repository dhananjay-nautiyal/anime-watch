package com.animeSite.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URISyntaxException;

@Configuration
public class DatabaseConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        String databaseUrl = System.getenv("DATABASE_URL");
        if (databaseUrl != null && !databaseUrl.isEmpty()) {
            try {
                URI uri = new URI(databaseUrl);
                String userInfo = uri.getUserInfo();
                if (userInfo != null) {
                    String[] creds = userInfo.split(":", 2);
                    properties.setUsername(creds[0]);
                    if (creds.length > 1) {
                        properties.setPassword(creds[1]);
                    }
                }
                properties.setUrl("jdbc:postgresql://" + uri.getHost() + ":" + uri.getPort() + uri.getPath());
            } catch (URISyntaxException e) {
                // Fallback to properties from application.yml
            }
        }
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }
}
