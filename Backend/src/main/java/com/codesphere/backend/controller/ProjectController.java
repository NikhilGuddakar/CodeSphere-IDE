package com.codesphere.backend.controller;

import com.codesphere.backend.dto.ApiResponse;
import com.codesphere.backend.dto.ProjectRequest;
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


import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.FileVisitResult;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

	private static final String BASE_DIR =
	        System.getProperty("user.home") + "/codesphere_workspace";

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
            @RequestBody ProjectRequest request) throws IOException {
    	System.out.println("CREATE PROJECT CONTROLLER HIT");

    	Authentication auth =
    	        SecurityContextHolder.getContext().getAuthentication();
    	System.out.println("AUTH USER = " + auth.getName());
    	String username = auth.getName();

    	UserEntity user = userRepository.findByUsername(username)
    	        .orElseThrow(() -> new RuntimeException("User not found"));

    	
//    	String username = SecurityContextHolder
//    	        .getContext()
//    	        .getAuthentication()
//    	        .getName();
//
//    	UserEntity user = userRepository.findByUsername(username)
//    	        .orElseThrow(() -> new RuntimeException("User not found"));


        String projectName = request.getName().trim();

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
        Path basePath = Path.of(BASE_DIR);
        Files.createDirectories(basePath);

        Path projectPath = basePath.resolve(projectName);
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
                Path projectPath = Path.of(BASE_DIR, projectName);
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
    
    

}
