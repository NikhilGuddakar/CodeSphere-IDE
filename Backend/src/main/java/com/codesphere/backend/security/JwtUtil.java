package com.codesphere.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

public class JwtUtil {

    private static final String SECRET = resolveSecret();

    private static final Key KEY =
            Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    private static final long EXPIRATION = resolveExpiration();

    public static String generateToken(String username) {
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION))
                .signWith(KEY, SignatureAlgorithm.HS256)
                .compact();
    }

    public static String validateToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(KEY)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            return claims.getSubject();
        } catch (JwtException e) {
            return null;
        }
    }

    private static String resolveSecret() {
        String env = System.getenv("JWT_SECRET");
        String prop = System.getProperty("jwt.secret");
        String candidate = (env != null && !env.isBlank()) ? env : prop;
        if (candidate != null && candidate.length() >= 32) {
            return candidate;
        }
        return "codesphere-super-secret-key-should-be-long";
    }

    private static long resolveExpiration() {
        String env = System.getenv("JWT_EXPIRATION_MS");
        String prop = System.getProperty("jwt.expirationMs");
        String candidate = (env != null && !env.isBlank()) ? env : prop;
        if (candidate != null) {
            try {
                return Long.parseLong(candidate);
            } catch (NumberFormatException ignored) {
            }
        }
        return 1000L * 60 * 60; // 1 hour
    }
}
