package com.codesphere.backend.util;

import java.nio.file.Path;

import com.codesphere.backend.entity.UserEntity;

public final class WorkspacePaths {
    private WorkspacePaths() {}
    public static final int MAX_PROJECT_NAME = 64;
    public static final int MAX_FILENAME = 180;
    public static final int MAX_CONTENT_BYTES = 1024 * 1024; // 1MB

    public static Path baseDir() {
        String override = System.getProperty("codesphere.workspace");
        if (override != null && !override.isBlank()) {
            return Path.of(override);
        }
        String env = System.getenv("CODESPHERE_WORKSPACE");
        if (env != null && !env.isBlank()) {
            return Path.of(env);
        }
        return Path.of(System.getProperty("user.home"), "codesphere_workspace");
    }

    public static Path userDir(UserEntity user) {
        return baseDir().resolve("user_" + user.getId());
    }

    public static Path projectDir(UserEntity user, String projectName) {
        return userDir(user).resolve(projectName);
    }

    public static boolean isSafeProjectName(String projectName) {
        if (projectName == null) return false;
        String trimmed = projectName.trim();
        if (trimmed.isEmpty()) return false;
        if (trimmed.length() > MAX_PROJECT_NAME) return false;
        if (!trimmed.matches("[A-Za-z0-9 _.-]+")) return false;
        if (trimmed.contains("/") || trimmed.contains("\\") || trimmed.contains("..")) {
            return false;
        }
        return true;
    }

    public static boolean isSafeFilename(String filename) {
        if (filename == null) return false;
        String trimmed = filename.trim();
        if (trimmed.isEmpty()) return false;
        if (trimmed.length() > MAX_FILENAME) return false;
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c == '\r' || c == '\n' || c == '\t' || c == '\u0000') {
                return false;
            }
        }
        if (trimmed.startsWith("/") || trimmed.startsWith("\\") || trimmed.contains("..")) {
            return false;
        }
        if (trimmed.contains("\\")) {
            return false;
        }
        return true;
    }
}
