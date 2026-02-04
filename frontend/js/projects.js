import { createProject, fetchProjects } from "./api.js";
import { state } from "./state.js";

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
}
