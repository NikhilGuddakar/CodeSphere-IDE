const DEFAULT_KEYS = {
    save: "s",
    run: "enter",
    createFile: "n",
    deleteFile: "backspace"
};

function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "textarea") return true;
    if (tag === "input") return true;
    return target.isContentEditable === true;
}

export function registerShortcuts(actions = {}) {
    const handler = (event) => {
        if (event.defaultPrevented) return;
        if (event.repeat) return;

        const hasMod = event.ctrlKey || event.metaKey;
        if (!hasMod) return;

        const key = event.key.toLowerCase();

        // Save: Ctrl/Cmd + S
        if (key === DEFAULT_KEYS.save) {
            event.preventDefault();
            if (typeof actions.onSave === "function") {
                actions.onSave();
            }
            return;
        }

        // Run: Ctrl/Cmd + Enter
        if (key === DEFAULT_KEYS.run) {
            event.preventDefault();
            if (typeof actions.onRun === "function") {
                actions.onRun();
            }
            return;
        }

        // Create new file: Ctrl/Cmd + Shift + N
        if (event.shiftKey && key === DEFAULT_KEYS.createFile) {
            event.preventDefault();
            if (typeof actions.onCreateFile === "function") {
                actions.onCreateFile();
            }
            return;
        }

        // Delete file: Ctrl/Cmd + Shift + Backspace/Delete
        if (event.shiftKey && (key === DEFAULT_KEYS.deleteFile || key === "delete")) {
            if (isEditableTarget(event.target)) {
                // Avoid breaking normal text deletion in inputs.
                return;
            }
            event.preventDefault();
            if (typeof actions.onDeleteFile === "function") {
                actions.onDeleteFile();
            }
        }
    };

    document.addEventListener("keydown", handler);

    return () => document.removeEventListener("keydown", handler);
}
