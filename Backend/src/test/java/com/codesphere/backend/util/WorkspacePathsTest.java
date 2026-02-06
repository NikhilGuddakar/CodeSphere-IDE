package com.codesphere.backend.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class WorkspacePathsTest {

    @Test
    void validatesProjectNames() {
        assertTrue(WorkspacePaths.isSafeProjectName("DemoProject"));
        assertTrue(WorkspacePaths.isSafeProjectName("demo_project-1"));
        assertFalse(WorkspacePaths.isSafeProjectName(""));
        assertFalse(WorkspacePaths.isSafeProjectName("  "));
        assertFalse(WorkspacePaths.isSafeProjectName("../escape"));
        assertFalse(WorkspacePaths.isSafeProjectName("bad/name"));
        assertFalse(WorkspacePaths.isSafeProjectName("bad\\name"));
    }

    @Test
    void validatesFilenames() {
        assertTrue(WorkspacePaths.isSafeFilename("Main.java"));
        assertTrue(WorkspacePaths.isSafeFilename("src/Main.java"));
        assertFalse(WorkspacePaths.isSafeFilename(""));
        assertFalse(WorkspacePaths.isSafeFilename(".."));
        assertFalse(WorkspacePaths.isSafeFilename("../Main.java"));
        assertFalse(WorkspacePaths.isSafeFilename("\\Main.java"));
        assertFalse(WorkspacePaths.isSafeFilename("C:\\Main.java"));
    }
}
