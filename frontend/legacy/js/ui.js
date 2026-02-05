export function getEditorContent() {
    return document.getElementById("editor").value;
}

export function setEditorContent(content) {
    const editor = document.getElementById("editor");
    if (editor) {
        editor.value = content ?? "";
    }
}

export function clearEditor() {
    setEditorContent("");
}

export function renderFileList(files, onOpen, selectedFilename = null) {
    const list = document.getElementById("fileList");
    if (!list) return;

    list.innerHTML = "";

    if (!Array.isArray(files)) return;

    files.forEach(filename => {
        const li = document.createElement("li");
        li.textContent = filename;
        if (selectedFilename && filename === selectedFilename) {
            li.classList.add("active");
        }
        li.onclick = () => {
            list.querySelectorAll("li").forEach(item => item.classList.remove("active"));
            li.classList.add("active");
            onOpen(filename);
        };
        list.appendChild(li);
    });
}

export function renderOutput(output) {
    const container = document.getElementById("output");
    if (!container) return;

    if (typeof output === "string") {
        container.textContent = output;
        return;
    }

    container.textContent = JSON.stringify(output, null, 2);
}

export function setStatus(message, type) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.dataset.status = type || "";
        return;
    }

    // Fallback if there is no status element in the DOM.
    console.log(`[${type || "info"}] ${message}`);
}

export function setSaveStatus(message, type) {
    const statusEl = document.getElementById("saveStatus");
    if (!statusEl) return;

    statusEl.textContent = message || "";
    statusEl.dataset.status = type || "";
}
