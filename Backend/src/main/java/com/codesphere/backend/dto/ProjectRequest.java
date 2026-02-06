package com.codesphere.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class ProjectRequest {

    @NotBlank(message = "Project name is required")
    @Size(max = 64, message = "Project name must be 64 characters or less")
    @Pattern(regexp = "^[A-Za-z0-9 _.-]+$", message = "Project name has invalid characters")
    private String name;

    public ProjectRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
