// js/main.js
import { registerShortcuts } from "./shortcuts.js";
import { state } from "./state.js";
import * as api from "./api.js";
import * as ui from "./ui.js";
import { createNewFile } from "./files.js";
import { initEditorShortcuts } from "./editor.js";
import { isAuthenticated, logout } from "./auth.js";
import { loadProjects, handleCreateProject, handleDeleteProject } from "./projects.js";

if (!isAuthenticated()) {
    window.location.href = "login.html";
}

// initial load
loadProjects();


window.loadFiles = function () {
    const project = state.currentProject;
    if (!project) {
        return Promise.resolve();
    }
    return api.fetchFiles(project).then(response => {
        if (!response.success) {
            throw new Error(response.message || "Failed to load files");
        }
        ui.renderFileList(response.data, openFile, state.currentFile);
    });
};

function openFile(filename) {
    const project = state.currentProject;
    if (!project) {
        alert("Select a project first");
        return;
    }
    state.currentFile = filename;

    api.readFile(project, filename).then(content => {
        ui.setEditorContent(content);
        const filenameInput = document.getElementById("filename");
        if (filenameInput) {
            filenameInput.value = filename;
        }
    }).catch(err => {
        console.error(err);
        ui.setEditorContent("");
        ui.setStatus("Failed to load file", "error");
        alert("Failed to load file");
    });
}

window.saveFile = function () {
    if (!state.currentFile) return alert("No file selected");

    const project = state.currentProject;
    if (!project) return alert("Select a project first");
    const content = document.getElementById("editor").value;

    api.saveFile(project, state.currentFile, content).then(response => {
        if (!response.success) {
            throw new Error(response.message || "Failed to save file");
        }
        ui.setStatus("File saved", "success");
        ui.setSaveStatus("Saved", "success");
    }).catch(err => {
        console.error(err);
        alert("Failed to save file");
        ui.setStatus("Save failed", "error");
        ui.setSaveStatus("Save failed", "error");
    });
};

window.runCode = function () {
    if (!state.currentFile) return alert("No file selected");

    ui.setStatus("Running...", "running");

    const project = state.currentProject;
    if (!project) return alert("Select a project first");
    const inputData = document.getElementById("inputData").value;

    api.executeCode(project, state.currentFile, inputData).then(response => {
        if (!response.success) {
            const message = response.message || "Execution failed";
            ui.renderOutput(message);
            ui.setStatus(message, "error");
            return;
        }
        ui.renderOutput(response.data ?? "");
        ui.setStatus("Execution finished", "success");
    }).catch(err => {
        console.error(err);
        ui.renderOutput("Execution failed");
        ui.setStatus("Execution failed", "error");
    });
};

window.deleteFile = function () {
    if (!state.currentFile) return alert("No file selected");

    const ok = confirm(`Delete ${state.currentFile}?`);
    if (!ok) return;

    const project = state.currentProject;
    if (!project) return alert("Select a project first");

    api.deleteFile(project, state.currentFile).then(response => {
        if (!response.success) {
            throw new Error(response.message || "Failed to delete file");
        }
        state.currentFile = null;
        ui.clearEditor();
        if (typeof window.loadFiles === "function") {
            window.loadFiles();
        }
        ui.setStatus("File deleted", "success");
    }).catch(err => {
        console.error(err);
        alert("Failed to delete file");
        ui.setStatus("Delete failed", "error");
    });
};

// create new file
document.addEventListener("DOMContentLoaded", () => {
    initEditorShortcuts();
    registerShortcuts({
        onSave: () => window.saveFile(),
        onRun: () => window.runCode(),
        onCreateFile: () => createNewFile(),
        onDeleteFile: () => window.deleteFile()
    });

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }

    const createProjectBtn = document.getElementById("createProjectBtn");
    if (createProjectBtn) {
        createProjectBtn.addEventListener("click", handleCreateProject);
    }

    const btn = document.getElementById("createFileBtn");
    if(btn){
        btn.addEventListener("click", createNewFile)
    } else{
        console.warn("Create File button not found");
    }

    const deleteFileBtn = document.getElementById("deleteFileBtn");
    if (deleteFileBtn) {
        deleteFileBtn.addEventListener("click", (event) => {
            event.preventDefault();
            window.deleteFile();
        });
    }

    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", (event) => {
            event.preventDefault();
            window.saveFile();
        });
    } else {
        console.warn("Save button not found");
    }

    const runBtn = document.getElementById("runBtn");
    if (runBtn) {
        runBtn.addEventListener("click", (event) => {
            event.preventDefault();
            window.runCode();
        });
    } else {
        console.warn("Run button not found");
    }

    const deleteProjectBtn = document.getElementById("deleteProjectBtn");
    if (deleteProjectBtn) {
        deleteProjectBtn.addEventListener("click", (event) => {
            event.preventDefault();
            handleDeleteProject();
        });
    }
})

// registerShortcuts({
//     onSave: () => window.saveFile(),
//     onRun: () => window.runCode()
// });
