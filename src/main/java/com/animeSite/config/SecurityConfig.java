package com.animeSite.config;

import com.animeSite.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, Environment environment) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource(environment)))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                // The stream proxy serves third-party player pages that must be
                // embeddable and run their own scripts; per-route CSP below.
                .frameOptions(frame -> frame.disable())
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self'; frame-src 'none'; connect-src 'self' https:;")
                )
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Watching is anonymous. Episode sync is a read-through cache
                // fill (resolve the provider episode list and store it), not a
                // user-owned write, so guests may trigger it too — otherwise
                // nobody can start a title that was never imported.
                // Only genuinely user-owned writes need an account.
                .requestMatchers(HttpMethod.POST, "/api/anime/*/review").authenticated()
                .requestMatchers("/api/auth/**").permitAll()
                // Destructive/bulk episode maintenance must not be reachable anonymously.
                // These specific rules have to precede the blanket /api/anime/** permitAll.
                .requestMatchers(HttpMethod.POST, "/api/anime/episodes/sync-all").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/anime/*/episodes/clear").hasRole("ADMIN")
                .requestMatchers("/api/anime/**").permitAll()
                .requestMatchers("/api/image-proxy").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/watchlist/**").authenticated()
                .requestMatchers("/api/favorites/**").authenticated()
                .requestMatchers("/api/stream/**").permitAll()
                .requestMatchers("/api/reviews/**").authenticated()
                .requestMatchers("/api/user/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/news/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/app/version").permitAll()
                .requestMatchers("/api/news/**").hasRole("ADMIN")
                .requestMatchers("/api/notifications/register").authenticated()
                .requestMatchers("/api/notifications/unregister").authenticated()
                .requestMatchers("/api/notifications/preferences").authenticated()
                .requestMatchers("/api/notifications/send-test").authenticated()
                .requestMatchers("/api/notifications/broadcast").hasRole("ADMIN")
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/api-docs/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(Environment environment) {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = new java.util.ArrayList<>(List.of(
            frontendUrl,
            "https://anime-watch-theta.vercel.app"
        ));
        // In dev Vite silently falls back to 5174/5175/... when 5173 is taken,
        // and the browser's Origin is forwarded through the Vite proxy. Without
        // this, POSTs (register/login) get a 403 while GETs still work — the
        // browser only sends Origin on unsafe methods.
        if (environment.acceptsProfiles(Profiles.of("dev"))) {
            origins.add("http://localhost:*");
            origins.add("http://127.0.0.1:*");
        }
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
