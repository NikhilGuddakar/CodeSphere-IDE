package com.codesphere.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FileRequest {

    @NotBlank(message = "Filename is required")
    @Size(max = 180, message = "Filename must be 180 characters or less")
    private String filename;
    @Size(max = 1000000, message = "File content too large")
    private String content;

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
