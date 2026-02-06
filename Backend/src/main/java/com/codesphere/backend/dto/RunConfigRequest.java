package com.codesphere.backend.dto;

import jakarta.validation.constraints.Size;

public class RunConfigRequest {
    @Size(max = 180, message = "Filename must be 180 characters or less")
    private String mainFile;

    public String getMainFile() {
        return mainFile;
    }

    public void setMainFile(String mainFile) {
        this.mainFile = mainFile;
    }
}
