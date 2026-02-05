import { state } from "./state.js";
import * as api from "./api.js";
import * as ui from "./ui.js";

/* =========================
   FILE OPERATIONS
========================= */
export async function createNewFile() {
    const input = document.getElementById("fileNameInput");
    const filename = input.value.trim();

    if (!filename) {
        alert("Enter file name");
        return;
    }

    if (!state.currentProject) {
        alert("Select a project first");
        return;
    }

    try {
        const response = await api.saveFile(
            state.currentProject,
            filename,
            ""
        );

        if (!response.success) {
            throw new Error(response.message || "Failed to create file");
        }

        if (typeof window.loadFiles === "function") {
            await window.loadFiles();
        }

        state.currentFile = filename;
        ui.setEditorContent("");
        input.value = "";

        console.log("File created:", filename);
    } catch (e) {
        console.error(e);
        alert(e?.message || "Failed to create file");
    }
}
