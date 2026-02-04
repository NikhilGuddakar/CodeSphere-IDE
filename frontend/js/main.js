// js/main.js
// import { registerShortcuts } from "./shortcuts.js";
import { state } from "./state.js";
import * as api from "./api.js";
import * as ui from "./ui.js";
import { createNewFile } from "./files.js";
import { isAuthenticated, logout } from "./auth.js";
import { loadProjects, handleCreateProject } from "./projects.js";

if (!isAuthenticated()) {
    window.location.href = "login.html";
}

// logout
document.getElementById("logoutBtn").onclick = logout;

// project actions
document.getElementById("createProjectBtn").onclick = handleCreateProject;

//file actions
document.getElementById("createFileBtn").onclick = createNewFile;

// initial load
loadProjects();


window.loadFiles = function () {
    const project = document.getElementById("projectName").value;
    api.fetchFiles(project).then(files => {
        ui.renderFileList(files, openFile);
    });
};

function openFile(filename) {
    const project = document.getElementById("projectName").value;
    state.currentFile = filename;

    api.readFile(project, filename).then(content => {
        ui.setEditorContent(content);
        document.getElementById("filename").value = filename;
    });
}

window.saveFile = function () {
    if (!state.currentFile) return alert("No file selected");

    const project = document.getElementById("projectName").value;
    const content = document.getElementById("editor").value;

    api.saveFile(project, state.currentFile, content).then(msg => {
        alert(msg);
        ui.setStatus("File saved", "success");
    });
};

window.runCode = function () {
    if (!state.currentFile) return alert("No file selected");

    ui.setStatus("Running...", "running");

    const project = document.getElementById("projectName").value;
    const inputData = document.getElementById("inputData").value;

    api.executeCode(project, state.currentFile, inputData).then(output => {
        ui.renderOutput(output);
        ui.setStatus("Execution finished", "success");
    });
};

window.deleteFile = function () {
    if (!state.currentFile) return alert("No file selected");

    const ok = confirm(`Delete ${state.currentFile}?`);
    if (!ok) return;

    const project = document.getElementById("projectName").value;

    api.deleteFile(project, state.currentFile).then(msg => {
        alert(msg);
        state.currentFile = null;
        ui.clearEditor();
        loadFiles();
        ui.setStatus("File deleted", "success");
    });
};

// create new file
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("createFileBtn");
    if(btn){
        btn.addEventListener("click", createNewFile)
    } else{
        console.warn("Create File button not found");
    }
})

// registerShortcuts({
//     onSave: () => window.saveFile(),
//     onRun: () => window.runCode()
// });
