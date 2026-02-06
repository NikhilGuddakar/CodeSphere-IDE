package com.codesphere.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ExecuteRequest {

    @NotBlank(message = "Filename is required")
    @Size(max = 180, message = "Filename must be 180 characters or less")
    private String filename;
    @Size(max = 1000000, message = "Input too large")
    private String input;

    public String getFilename() {
        return filename;
    }

    public String getInput() {
        return input;
    }
}
