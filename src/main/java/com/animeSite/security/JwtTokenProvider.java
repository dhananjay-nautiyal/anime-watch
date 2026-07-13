package com.animeSite.security;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private static final String[] KNOWN_WEAK_SECRETS = {
            "dev-secret-key-change-in-production-123456789",
            "change-this-to-a-secure-random-secret-at-least-32-chars",
            "change-this-to-a-secure-random-secret"
    };

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs) {

        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("JWT_SECRET must be configured.");
        }

        for (String weak : KNOWN_WEAK_SECRETS) {
            if (weak.equals(secret)) {
                throw new IllegalArgumentException(
                        "JWT_SECRET is using a known insecure default value."
                );
            }
        }

        byte[] keyBytes;

        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "JWT_SECRET must be a valid Base64 encoded string.",
                    ex
            );
        }

        if (keyBytes.length < 32) {
            throw new IllegalArgumentException(
                    "JWT_SECRET must contain at least 256 bits (32 bytes) after Base64 decoding."
            );
        }

        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    @PostConstruct
    public void init() {
        log.info("JWT Token Provider initialized successfully.");
    }

    public String generateToken(String email, String role) {

        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    public String getEmailFromToken(String token) {

        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public String getRoleFromToken(String token) {

        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role", String.class);
    }

    public boolean validateToken(String token) {

        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);

            return true;

        } catch (JwtException | IllegalArgumentException ex) {

            log.debug("Invalid JWT token: {}", ex.getMessage());

            return false;
        }
    }
}