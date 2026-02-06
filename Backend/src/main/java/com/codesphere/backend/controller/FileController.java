package com.codesphere.backend.controller;

import com.codesphere.backend.dto.ApiResponse;
import com.codesphere.backend.dto.FileRequest;
import com.codesphere.backend.entity.FileEntity;
import com.codesphere.backend.entity.ProjectEntity;
import com.codesphere.backend.entity.UserEntity;
import com.codesphere.backend.repository.FileRepository;
import com.codesphere.backend.repository.ProjectRepository;
import com.codesphere.backend.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import com.codesphere.backend.util.WorkspacePaths;

@RestController
@RequestMapping("/api/projects/{projectName}/files")
public class FileController {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final FileRepository fileRepository;

    public FileController(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          FileRepository fileRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
    }

    @PutMapping
    public ResponseEntity<ApiResponse<String>> saveFile(
            @PathVariable String projectName,
            @Valid @RequestBody FileRequest request) {

        if (request == null || request.getFilename() == null || request.getFilename().isBlank()) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Filename is required", null));
        }
        if (request.getContent() != null
            && request.getContent().getBytes().length > WorkspacePaths.MAX_CONTENT_BYTES) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "File content too large", null));
        }
        if (!WorkspacePaths.isSafeProjectName(projectName)) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid project name", null));
        }
        if (!WorkspacePaths.isSafeFilename(request.getFilename())) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid filename", null));
        }

        // 1️⃣ Get logged-in user
        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401)
                .body(new ApiResponse<>(false, "User not found", null));
        }

        // 2️⃣ Validate project ownership
        ProjectEntity project = projectRepository
                .findByNameAndUser(projectName, user)
                .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404)
                .body(new ApiResponse<>(false, "Project not found", null));
        }

        try {
            // 3️⃣ Write file to filesystem
            Path projectPath = WorkspacePaths.projectDir(user, projectName);
            Files.createDirectories(projectPath);
            if (!Files.isWritable(projectPath)) {
                return ResponseEntity.internalServerError()
                    .body(new ApiResponse<>(false, "Workspace is not writable", null));
            }

            Path filePath = projectPath.resolve(request.getFilename()).normalize();
            if (!filePath.startsWith(projectPath)) {
                return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid filename path", null));
            }

            Path parentDir = filePath.getParent();
            if (parentDir != null) {
                Files.createDirectories(parentDir);
            }

            String content = request.getContent() == null ? "" : request.getContent();

            FileEntity existing = fileRepository
                .findByFilenameAndProjectId(request.getFilename(), project.getId())
                .orElse(null);

            // 4️⃣ Write file content
            Files.writeString(filePath, content);
           
            // 5️⃣ Save / update file metadata in DB
            String language = getLanguageFromFilename(request.getFilename());
            if (existing == null) {
                FileEntity file = new FileEntity();
                file.setFilename(request.getFilename());
                file.setProject(project);
                file.setLanguage(language);
                fileRepository.save(file);
            } else if (!language.equals(existing.getLanguage())) {
                existing.setLanguage(language);
                fileRepository.save(existing);
            }

            return ResponseEntity.ok(
                    new ApiResponse<>(true, "File saved successfully", request.getFilename())
            );

        } catch (Exception e) {
            e.printStackTrace(); // ⭐ IMPORTANT
            return ResponseEntity.internalServerError()
                .body(new ApiResponse<>(false, "Failed to save file: " + e.getMessage(), null));
        }

    }
    
    private String getLanguageFromFilename(String filename) {
        int index = filename.lastIndexOf('.');
        if (index == -1) return "unknown";

        return switch (filename.substring(index + 1).toLowerCase()) {
            case "java" -> "java";
            case "py" -> "python";
            case "js" -> "javascript";
            case "html" -> "html";
            case "css" -> "css";
            case "c" -> "c";
            case "cpp", "cc", "cxx" -> "cpp";
            case "go" -> "go";
            case "cs" -> "csharp";
            default -> "unknown";
        };
    }
    
    @GetMapping
    public ResponseEntity<ApiResponse<List<String>>> listFiles(
            @PathVariable String projectName) {

        if (!WorkspacePaths.isSafeProjectName(projectName)) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid project name", null));
        }
        // 1️⃣ Get logged-in user
        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401)
                .body(new ApiResponse<>(false, "User not found", null));
        }

        // 2️⃣ Validate project ownership
        ProjectEntity project = projectRepository
                .findByNameAndUser(projectName, user)
                .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404)
                .body(new ApiResponse<>(false, "Project not found", null));
        }

        // 3️⃣ Fetch files ONLY for this project
        List<String> files = fileRepository.findByProject(project)
                .stream()
                .map(FileEntity::getFilename)
                .toList();

        return ResponseEntity.ok(
                new ApiResponse<>(true, "Files fetched", files)
        );
    }

    @GetMapping("/read")
    public ResponseEntity<String> readFile(
            @PathVariable String projectName,
            @RequestParam String filename) {

        if (filename == null || filename.isBlank()) {
            return ResponseEntity.badRequest().body("Filename is required");
        }
        if (!WorkspacePaths.isSafeProjectName(projectName)) {
            return ResponseEntity.badRequest().body("Invalid project name");
        }
        if (!WorkspacePaths.isSafeFilename(filename)) {
            return ResponseEntity.badRequest().body("Invalid filename");
        }

        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body("User not found");
        }

        ProjectEntity project = projectRepository
                .findByNameAndUser(projectName, user)
                .orElse(null);
        if (project == null) {
            return ResponseEntity.status(404).body("Project not found");
        }

        try {
            Path projectPath = WorkspacePaths.projectDir(user, projectName);
            Path filePath = projectPath.resolve(filename).normalize();
            if (!filePath.startsWith(projectPath)) {
                return ResponseEntity.badRequest().body("Invalid filename path");
            }

            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            String content = Files.readString(filePath);
            if (content.getBytes().length > WorkspacePaths.MAX_CONTENT_BYTES) {
                return ResponseEntity.status(413).body("File content too large");
            }
            return ResponseEntity
                    .ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(content);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("Failed to read file");
        }
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<String>> deleteFile(
            @PathVariable String projectName,
            @RequestParam String filename) {

        if (filename == null || filename.isBlank()) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Filename is required", null));
        }
        if (!WorkspacePaths.isSafeProjectName(projectName)) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid project name", null));
        }
        if (!WorkspacePaths.isSafeFilename(filename)) {
            return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Invalid filename", null));
        }

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
            Path projectPath = WorkspacePaths.projectDir(user, projectName);
            Path filePath = projectPath.resolve(filename).normalize();
            if (!filePath.startsWith(projectPath)) {
                return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid filename path", null));
            }

            boolean deletedFromDisk = Files.deleteIfExists(filePath);

            boolean deletedFromDb = fileRepository
                .findByFilenameAndProject(filename, project)
                .map(file -> {
                    fileRepository.delete(file);
                    return true;
                })
                .orElse(false);

            if (!deletedFromDisk && !deletedFromDb) {
                return ResponseEntity.status(404)
                    .body(new ApiResponse<>(false, "File not found", null));
            }

            return ResponseEntity.ok(
                new ApiResponse<>(true, "File deleted", filename)
            );
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body(new ApiResponse<>(false, "Failed to delete file", null));
        }
    }

}
