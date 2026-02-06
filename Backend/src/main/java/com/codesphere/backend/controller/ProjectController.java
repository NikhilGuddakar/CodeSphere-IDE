package com.codesphere.backend.controller;

import com.codesphere.backend.dto.ApiResponse;
import com.codesphere.backend.dto.ProjectRequest;
import com.codesphere.backend.dto.RunConfigRequest;
import com.codesphere.backend.entity.ProjectEntity;
import com.codesphere.backend.entity.UserEntity;
import com.codesphere.backend.repository.ExecutionRepository;
import com.codesphere.backend.repository.FileRepository;
import com.codesphere.backend.repository.ProjectRepository;
import com.codesphere.backend.repository.UserRepository;



import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;


import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.FileVisitResult;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;

import com.codesphere.backend.util.WorkspacePaths;
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final FileRepository fileRepository;
    private final ExecutionRepository executionRepository;


    public ProjectController(ProjectRepository projectRepository,
                             UserRepository userRepository,
                             FileRepository fileRepository,
                             ExecutionRepository executionRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
        this.executionRepository = executionRepository;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<String>> createProject(
            @Valid @RequestBody ProjectRequest request) throws IOException {
    	Authentication auth =
    	        SecurityContextHolder.getContext().getAuthentication();
    	String username = auth.getName();

    	UserEntity user = userRepository.findByUsername(username)
    	        .orElseThrow(() -> new RuntimeException("User not found"));

        String projectName = request == null ? "" : request.getName();
        projectName = projectName == null ? "" : projectName.trim();
        if (!WorkspacePaths.isSafeProjectName(projectName)) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid project name", null));
        }

        // 1 Check DB
        if (projectRepository.existsByNameAndUser(projectName, user)) {

            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Project already exists", null));
        }

        // 2 Save in DB
        ProjectEntity project = new ProjectEntity();
        project.setName(request.getName());
        project.setUser(user);  
        projectRepository.save(project);


        // 3 Create folder
        Path basePath = WorkspacePaths.userDir(user);
        Files.createDirectories(basePath);

        Path projectPath = WorkspacePaths.projectDir(user, projectName);
        Files.createDirectories(projectPath);

        
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Project created successfully", projectName)
        );
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<String>>> listProjects() {

        // 1️⃣ Get logged-in user
        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 2️⃣ Fetch ONLY this user's projects
        List<String> projects = projectRepository.findByUser(user)
                .stream()
                .map(ProjectEntity::getName)
                .toList();

        return ResponseEntity.ok(
                new ApiResponse<>(true, "Projects fetched", projects)
        );
    }

    @DeleteMapping("/{projectName}")
    @Transactional
    public ResponseEntity<ApiResponse<String>> deleteProject(
            @PathVariable String projectName) {

        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401)
                .body(new ApiResponse<>(false, "User not found", null));
        }

        ProjectEntity project = projectRepository
                .findByNameAndUser(projectName, user)
                .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404)
                .body(new ApiResponse<>(false, "Project not found", null));
        }

        try {
            // Delete related DB records first (avoid FK issues)
            executionRepository.deleteByProject(project);
            fileRepository.deleteByProject(project);
            projectRepository.delete(project);

            String cleanupWarning = null;
            try {
                // Delete files on disk
                Path projectPath = WorkspacePaths.projectDir(user, projectName);
                if (Files.exists(projectPath)) {
                    Files.walkFileTree(projectPath, new SimpleFileVisitor<Path>() {
                        @Override
                        public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                                throws java.io.IOException {
                            Files.deleteIfExists(file);
                            return FileVisitResult.CONTINUE;
                        }

                        @Override
                        public FileVisitResult postVisitDirectory(Path dir, java.io.IOException exc)
                                throws java.io.IOException {
                            Files.deleteIfExists(dir);
                            return FileVisitResult.CONTINUE;
                        }
                    });
                }
            } catch (Exception cleanupError) {
                cleanupWarning = cleanupError.getMessage();
            }

            String message = cleanupWarning == null
                ? "Project deleted"
                : "Project deleted (workspace cleanup failed: " + cleanupWarning + ")";

            return ResponseEntity.ok(
                new ApiResponse<>(true, message, projectName)
            );
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body(new ApiResponse<>(false, "Failed to delete project: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{projectName}/run-config")
    public ResponseEntity<ApiResponse<String>> getRunConfig(@PathVariable String projectName) {
        String username = SecurityContextHolder
            .getContext()
            .getAuthentication()
            .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401)
                .body(new ApiResponse<>(false, "User not found", null));
        }

        ProjectEntity project = projectRepository
            .findByNameAndUser(projectName, user)
            .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404)
                .body(new ApiResponse<>(false, "Project not found", null));
        }

        return ResponseEntity.ok(
            new ApiResponse<>(true, "Run config fetched", project.getMainFile())
        );
    }

    @PutMapping("/{projectName}/run-config")
    public ResponseEntity<ApiResponse<String>> setRunConfig(
            @PathVariable String projectName,
            @Valid @RequestBody RunConfigRequest request) {

        String username = SecurityContextHolder
            .getContext()
            .getAuthentication()
            .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401)
                .body(new ApiResponse<>(false, "User not found", null));
        }

        ProjectEntity project = projectRepository
            .findByNameAndUser(projectName, user)
            .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404)
                .body(new ApiResponse<>(false, "Project not found", null));
        }

        String mainFile = request.getMainFile();
        if (mainFile != null && !mainFile.isBlank()) {
            if (!WorkspacePaths.isSafeFilename(mainFile)) {
                return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid filename", null));
            }
            project.setMainFile(mainFile.trim());
        } else {
            project.setMainFile(null);
        }

        projectRepository.save(project);
        return ResponseEntity.ok(
            new ApiResponse<>(true, "Run config saved", project.getMainFile())
        );
    }
    
    

}
