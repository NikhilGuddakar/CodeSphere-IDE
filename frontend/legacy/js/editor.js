const DEFAULT_INDENT = "    ";

function getLineStart(value, index) {
    const lineStart = value.lastIndexOf("\n", index - 1);
    return lineStart === -1 ? 0 : lineStart + 1;
}

function getLineEnd(value, index) {
    const lineEnd = value.indexOf("\n", index);
    return lineEnd === -1 ? value.length : lineEnd;
}

function applyIndent(textarea, indent, outdent) {
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const blockStart = getLineStart(value, start);
    const blockEnd = getLineEnd(value, end);
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split("\n");

    let deltaStart = 0;
    let deltaEnd = 0;
    const newLines = lines.map((line, index) => {
        if (!outdent) {
            if (index === 0 && start >= blockStart) {
                deltaStart += indent.length;
            }
            deltaEnd += indent.length;
            return indent + line;
        }

        let removed = 0;
        if (line.startsWith(indent)) {
            removed = indent.length;
        } else if (line.startsWith("\t")) {
            removed = 1;
        } else {
            while (removed < indent.length && line[removed] === " ") {
                removed += 1;
            }
        }

        if (index === 0 && start >= blockStart) {
            deltaStart -= removed;
        }
        deltaEnd -= removed;
        return line.slice(removed);
    });

    textarea.value =
        value.slice(0, blockStart) + newLines.join("\n") + value.slice(blockEnd);
    textarea.selectionStart = start + deltaStart;
    textarea.selectionEnd = end + deltaEnd;
}

function insertAtCursor(textarea, text) {
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = value.slice(0, start) + text + value.slice(end);
    const next = start + text.length;
    textarea.selectionStart = next;
    textarea.selectionEnd = next;
}

function handleEnter(textarea, indent) {
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const lineStart = getLineStart(value, start);
    const currentLine = value.slice(lineStart, start);
    const indentMatch = currentLine.match(/^[\t ]+/);
    const baseIndent = indentMatch ? indentMatch[0] : "";
    const needsExtra =
        /[{(\[]\s*$/.test(currentLine) || /:\s*$/.test(currentLine);
    const extraIndent = needsExtra ? indent : "";
    const insertText = "\n" + baseIndent + extraIndent;

    textarea.value = value.slice(0, start) + insertText + value.slice(end);
    const next = start + insertText.length;
    textarea.selectionStart = next;
    textarea.selectionEnd = next;
}

function handleTab(textarea, indent, outdent) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end && !outdent) {
        insertAtCursor(textarea, indent);
        return;
    }

    applyIndent(textarea, indent, outdent);
}

export function initEditorShortcuts() {
    const editor = document.getElementById("editor");
    if (!editor) return;

    editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            handleTab(editor, DEFAULT_INDENT, event.shiftKey);
            return;
        }

        const isMod = event.ctrlKey || event.metaKey;
        if (isMod && event.key === "Enter") {
            event.preventDefault();
            if (typeof window.runCode === "function") {
                window.runCode();
            }
            return;
        }

        if (isMod && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (typeof window.saveFile === "function") {
                window.saveFile();
            }
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            handleEnter(editor, DEFAULT_INDENT);
        }
    });
}
