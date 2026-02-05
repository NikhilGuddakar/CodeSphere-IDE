import { createProject, fetchProjects, deleteProject } from "./api.js";
import { state } from "./state.js";
import * as ui from "./ui.js";

/* =========================
   LOAD PROJECTS
========================= */

export async function loadProjects() {
    const list = document.getElementById("projectList");
    list.innerHTML = "";

    const response = await fetchProjects();

    if (!response.success) {
        alert(response.message || "Failed to load projects");
        return;
    }

    response.data.forEach(projectName => {
        const li = document.createElement("li");
        li.textContent = projectName;

        li.onclick = () => {
            selectProject(projectName, li);
        };

        list.appendChild(li);
    });
}

/* =========================
   CREATE PROJECT
========================= */

export async function handleCreateProject() {
    const input = document.getElementById("projectNameInput");
    const name = input.value.trim();

    if (!name) {
        alert("Enter project name");
        return;
    }

    const response = await createProject(name);

    if (!response.success) {
        alert(response.message || "Failed to create project");
        return;
    }

    input.value = "";
    await loadProjects();
}

/* =========================
   DELETE PROJECT
========================= */

export async function handleDeleteProject() {
    if (!state.currentProject) {
        alert("Select a project first");
        return;
    }

    const ok = confirm(`Delete project ${state.currentProject}? This will remove all its files.`);
    if (!ok) return;

    try {
        const response = await deleteProject(state.currentProject);

        if (!response.success) {
            alert(response.message || "Failed to delete project");
            return;
        }

        state.currentProject = null;
        state.currentFile = null;

        ui.clearEditor();
    ui.renderFileList([], () => {}, null);
        ui.renderOutput("");
        ui.setStatus("Project deleted", "success");

    } catch (err) {
        console.error(err);
        alert("Failed to delete project");
        ui.setStatus("Delete failed", "error");
    } finally {
        // Refresh list to reflect server state even if deletion errored.
        await loadProjects();
    }
}

/* =========================
   SELECT PROJECT
========================= */

function selectProject(projectName, element) {
    state.currentProject = projectName;
    state.currentFile = null;

    // highlight selected project
    document.querySelectorAll("#projectList li")
        .forEach(li => li.classList.remove("active"));

    element.classList.add("active");

    console.log("Selected project:", projectName);

    if (typeof window.loadFiles === "function") {
        window.loadFiles().catch(err => {
            console.error("Failed to load files:", err);
        });
    }
}
