import { BASE_URL } from "./config.js";
import { getToken, logout } from "./auth.js";

/* =========================
   INTERNAL HELPER
========================= */

function request(path, options = {}) {
    const token = localStorage.getItem("codesphere_token");

    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    return fetch(`${BASE_URL}${path}`, {
        ...options,
        headers
    }).then(async res => {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                throw new Error("Unauthorized");
            }
            throw new Error("Request failed");
        }
        return res;
    });
}



/* =========================
   PROJECT APIs
========================= */

export function createProject(projectName) {
    return request("/api/projects", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: projectName
        })
    }).then(res => res.json());
}


export function fetchProjects() {
    return request("/api/projects")
        .then(res => res.json());
}


/* =========================
   FILE APIs
========================= */


export function fetchFiles(projectName) {
    return request(`/api/files?projectName=${projectName}`)
        .then(res => res.json());
}

export function readFile(projectName, filename) {
    return request(
        `/api/files/read?projectName=${projectName}&filename=${filename}`
    ).then(res => res.text());
}

export function saveFile(projectName, filename, content) {
    return request(`/api/files/${projectName}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            projectName: projectName,
            filename: filename,
            content: content
        })
    }).then(res => res.json());
}


export function deleteFile(projectName, filename) {
    return request(
        `/api/files/delete?projectName=${projectName}&filename=${filename}`,
        { method: "DELETE" }
    ).then(res => res.json());
}



/* =========================
   EXECUTION API
========================= */

export async function executeCode(projectName, filename, input) {
    const res = await request(`/api/projects/${projectName}/execute`, {
        method: "POST",
        body: JSON.stringify({
            filename,
            input
        })
    });
    return res.json();
}
