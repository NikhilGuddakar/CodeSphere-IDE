import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { csharp } from "@replit/codemirror-lang-csharp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { EditorView } from "@codemirror/view";
import * as api from "./api.js";

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : "";
  if (tag === "textarea" || tag === "input") return true;
  return target.isContentEditable === true;
}

function buildFileTree(list) {
  const root = { name: "", path: "", type: "folder", children: {} };
  list.forEach((item) => {
    const parts = item.split("/").filter(Boolean);
    let node = root;
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (index === parts.length - 1) {
        node.children[part] = { name: part, path: currentPath, type: "file" };
      } else {
        if (!node.children[part]) {
          node.children[part] = {
            name: part,
            path: currentPath,
            type: "folder",
            children: {}
          };
        }
        node = node.children[part];
      }
    });
  });
  return root;
}


export default function App() {
  const [view, setView] = useState(() =>
    localStorage.getItem("codesphere_token") ? "editor" : "login"
  );
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("codesphere_theme") || "dark"
  );

  const [projects, setProjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentProject, setCurrentProject] = useState("");
  const [currentFile, setCurrentFile] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [output, setOutput] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [outputMode, setOutputMode] = useState("text");
  const [inputData, setInputData] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [fileContents, setFileContents] = useState({});
  const [lastSaved, setLastSaved] = useState({});

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(-1);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showRunConfig, setShowRunConfig] = useState(false);
  const [runConfigFile, setRunConfigFile] = useState("");

  const [statusMessage, setStatusMessage] = useState("Ready");
  const [statusType, setStatusType] = useState("success");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveType, setSaveType] = useState("");
  const [confirmState, setConfirmState] = useState({
    open: false,
    message: "",
    confirmLabel: "Delete",
    onConfirm: null
  });
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const stored = localStorage.getItem("codesphere_autosave");
    return stored !== "false";
  });

  const projectInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const paletteInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const viewRef = useRef(null);
  const fileContentsRef = useRef({});
  const lastSavedRef = useRef({});
  const autoSaveTimerRef = useRef(null);

  const getEditorText = useCallback(() => {
    if (viewRef.current) {
      return viewRef.current.state.doc.toString();
    }
    return editorContent;
  }, [editorContent]);

  const setEditorText = useCallback(
    (nextContent) => {
      setEditorContent(nextContent);
      if (currentFile) {
        setFileContents((prev) => ({ ...prev, [currentFile]: nextContent }));
      }
    },
    [currentFile]
  );

  const languageExtensions = useMemo(() => {
    if (!currentFile) return [];
    const ext = currentFile.split(".").pop()?.toLowerCase();
    if (ext === "js" || ext === "jsx") {
      return [javascript({ jsx: true })];
    }
    if (ext === "ts" || ext === "tsx") {
      return [javascript({ typescript: true, jsx: ext === "tsx" })];
    }
    if (ext === "py") return [python()];
    if (ext === "java") return [java()];
    if (ext === "html") return [html()];
    if (ext === "css") return [css()];
    if (ext === "c" || ext === "cpp" || ext === "cc" || ext === "cxx") return [cpp()];
    if (ext === "go") return [go()];
    if (ext === "cs") return [csharp()];
    return [];
  }, [currentFile]);

  const editorExtensions = useMemo(
    () => [EditorView.lineWrapping, ...languageExtensions],
    [languageExtensions]
  );

  const codeTheme = theme === "light" ? vscodeLight : vscodeDark;

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const loadProjects = useCallback(async () => {
    try {
      const response = await api.fetchProjects();
      if (!response.success) {
        throw new Error(response.message || "Failed to load projects");
      }
      setProjects(response.data || []);
    } catch (err) {
      setStatusMessage(err.message || "Failed to load projects");
      setStatusType("error");
    }
  }, []);

  const loadFiles = useCallback(async (projectName) => {
    if (!projectName) {
      setFiles([]);
      return;
    }
    try {
      const response = await api.fetchFiles(projectName);
      if (!response.success) {
        throw new Error(response.message || "Failed to load files");
      }
      setFiles(response.data || []);
    } catch (err) {
      setStatusMessage(err.message || "Failed to load files");
      setStatusType("error");
    }
  }, []);

  useEffect(() => {
    fileContentsRef.current = fileContents;
  }, [fileContents]);

  useEffect(() => {
    lastSavedRef.current = lastSaved;
  }, [lastSaved]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("codesphere_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("codesphere_autosave", autoSaveEnabled ? "true" : "false");
  }, [autoSaveEnabled]);

  useEffect(() => {
    if (showCommandPalette) {
      paletteInputRef.current?.focus();
    }
  }, [showCommandPalette]);

  useEffect(() => {
    if (showSearchPanel) {
      searchInputRef.current?.focus();
      if (viewRef.current) {
        const selection = viewRef.current.state.selection.main;
        if (selection.from !== selection.to) {
          const selectedText = viewRef.current.state.doc.sliceString(
            selection.from,
            selection.to
          );
          if (selectedText) {
            setSearchQuery(selectedText);
          }
        }
      }
    }
  }, [showSearchPanel]);


  useEffect(() => {
    setSearchIndex(-1);
  }, [searchQuery, currentFile]);

  useEffect(() => {
    if (view === "editor") {
      loadProjects();
      api.health().catch(() => {
        setStatusMessage("Backend unavailable");
        setStatusType("error");
      });
    }
  }, [view, loadProjects]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
        if (showSearchPanel) {
          setShowSearchPanel(false);
          return;
        }
      }

      const hasMod = event.ctrlKey || event.metaKey;
      if (!hasMod) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleRun();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandQuery("");
        setShowCommandPalette(true);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowSearchPanel((prev) => !prev);
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (showCreateFile && newFileName.trim()) {
          handleCreateFile();
        } else {
          setShowCreateFile(true);
          setShowCreateProject(false);
        }
        return;
      }

      if (event.shiftKey && (event.key === "Backspace" || event.key === "Delete")) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handleDeleteFile();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleLogin = async () => {
    setAuthError("");
    setIsLoading(true);
    try {
      const trimmedUser = authUser.trim();
      if (!trimmedUser || !authPass) {
        setAuthError("Username and password are required.");
        setIsLoading(false);
        return;
      }
      const response = await api.login(trimmedUser, authPass);
      localStorage.setItem("codesphere_token", response.data);
      localStorage.setItem("codesphere_user", trimmedUser);
      setView("editor");
      setAuthUser("");
      setAuthPass("");
    } catch (err) {
      setAuthError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setAuthError("");
    const trimmedUser = authUser.trim();
    if (!trimmedUser || !authPass) {
      setAuthError("Username and password are required.");
      return;
    }
    if (trimmedUser.length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (authPass.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (authPass.length > 64) {
      setAuthError("Password is too long.");
      return;
    }
    if (authPass !== authConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await api.register(trimmedUser, authPass);
      setView("login");
      setAuthPass("");
      setAuthConfirm("");
      setStatusMessage("Registration complete. Please login.");
      setStatusType("success");
    } catch (err) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("codesphere_token");
    localStorage.removeItem("codesphere_user");
    setView("login");
    setProjects([]);
    setFiles([]);
    setCurrentProject("");
    setCurrentFile("");
    setEditorContent("");
    setOpenFiles([]);
    setFileContents({});
    setLastSaved({});
    setOutput("");
    setInputData("");
  };

  useEffect(() => {
    const handler = () => {
      setAuthError("Session expired. Please login again.");
      handleLogout();
    };
    window.addEventListener("codesphere:unauthorized", handler);
    return () => window.removeEventListener("codesphere:unauthorized", handler);
  }, []);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      setStatusMessage("Project name is required");
      setStatusType("error");
      return;
    }
    if (name.length > 64 || !/^[A-Za-z0-9 _.-]+$/.test(name)) {
      setStatusMessage("Project name has invalid characters or is too long");
      setStatusType("error");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.createProject(name);
      if (!response.success) throw new Error(response.message || "Failed to create project");
      setNewProjectName("");
      setShowCreateProject(false);
      setStatusMessage("Project created");
      setStatusType("success");
      await loadProjects();
    } catch (err) {
      setStatusMessage(err.message || "Failed to create project");
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = async (projectName) => {
    setCurrentProject(projectName);
    setCurrentFile("");
    setEditorContent("");
    setOpenFiles([]);
    setFileContents({});
    setLastSaved({});
    setOutput("");
    setPreviewHtml("");
    setOutputMode("text");
    setRunConfigFile("");
    setStatusMessage(`Project ${projectName} selected`);
    setStatusType("success");
    await loadFiles(projectName);
    try {
      const response = await api.getRunConfig(projectName);
      if (response.success && response.data) {
        setRunConfigFile(response.data);
      }
    } catch {
      // ignore
    }
  };

  const openConfirm = (message, onConfirm, confirmLabel = "Delete") => {
    setConfirmState({
      open: true,
      message,
      confirmLabel,
      onConfirm
    });
  };

  const deleteProjectByName = async (projectName) => {
    if (!projectName) return;
    setIsLoading(true);
    try {
      const response = await api.deleteProject(projectName);
      if (!response.success) throw new Error(response.message || "Failed to delete project");
      if (projectName === currentProject) {
        setCurrentProject("");
        setCurrentFile("");
        setFiles([]);
        setEditorContent("");
        setOpenFiles([]);
        setFileContents({});
        setLastSaved({});
        setOutput("");
        setRunConfigFile("");
      }
      setStatusMessage(response.message || "Project deleted");
      setStatusType("success");
      await loadProjects();
    } catch (err) {
      setStatusMessage(err.message || "Failed to delete project");
      setStatusType("error");
      await loadProjects();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    openConfirm(
      `Delete project ${currentProject}? This removes all files.`,
      () => deleteProjectByName(currentProject),
      "Delete"
    );
  };

  const handleDeleteProjectByName = async (projectName) => {
    if (!projectName) return;
    openConfirm(
      `Delete project ${projectName}? This removes all files.`,
      () => deleteProjectByName(projectName),
      "Delete"
    );
  };

  const handleCreateFile = async () => {
    if (!currentProject) {
      setStatusMessage("Select a project first");
      setStatusType("error");
      return;
    }
    const filename = newFileName.trim();
    if (!filename) {
      setStatusMessage("File name is required");
      setStatusType("error");
      return;
    }
    if (filename.length > 180 || filename.includes("..") || filename.startsWith("/")) {
      setStatusMessage("File name is invalid");
      setStatusType("error");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.saveFile(currentProject, filename, "");
      if (!response.success) throw new Error(response.message || "Failed to create file");
      setNewFileName("");
      setShowCreateFile(false);
      setCurrentFile(filename);
      setEditorContent("");
      setOpenFiles((prev) => (prev.includes(filename) ? prev : [...prev, filename]));
      setFileContents((prev) => ({ ...prev, [filename]: "" }));
      setLastSaved((prev) => ({ ...prev, [filename]: "" }));
      setStatusMessage("File created");
      setStatusType("success");
      await loadFiles(currentProject);
    } catch (err) {
      setStatusMessage(err.message || "Failed to create file");
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = async (filename) => {
    if (!currentProject) return;
    setCurrentFile(filename);
    setSaveMessage("");
    setSaveType("");
    setOpenFiles((prev) => (prev.includes(filename) ? prev : [...prev, filename]));

    const cached = fileContentsRef.current[filename];
    if (cached !== undefined) {
      setEditorContent(cached);
      setStatusMessage(`Opened ${filename}`);
      setStatusType("success");
      return;
    }

    try {
      const content = await api.readFile(currentProject, filename);
      setEditorContent(content);
      setFileContents((prev) => ({ ...prev, [filename]: content }));
      setLastSaved((prev) => ({ ...prev, [filename]: content }));
      setStatusMessage(`Opened ${filename}`);
      setStatusType("success");
    } catch (err) {
      setStatusMessage(err.message || "Failed to load file");
      setStatusType("error");
    }
  };

  const handleCloseTab = (filename) => {
    setOpenFiles((prev) => {
      const remaining = prev.filter((file) => file !== filename);
      if (filename === currentFile) {
        const nextFile = remaining[remaining.length - 1] || "";
        setCurrentFile(nextFile);
        setEditorContent(nextFile ? fileContentsRef.current[nextFile] || "" : "");
      }
      return remaining;
    });
  };

  const handleSave = async () => {
    if (!currentProject || !currentFile) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    setSaveMessage("Saving...");
    setSaveType("running");
    try {
      setFileContents((prev) => ({ ...prev, [currentFile]: editorContent }));
      if ((editorContent || "").length > 1000000) {
        throw new Error("File content too large to save");
      }
      const response = await api.saveFile(currentProject, currentFile, editorContent);
      if (!response.success) throw new Error(response.message || "Failed to save file");
      setStatusMessage("File saved");
      setStatusType("success");
      setSaveMessage("Saved");
      setSaveType("success");
      setLastSaved((prev) => ({ ...prev, [currentFile]: editorContent }));
    } catch (err) {
      setStatusMessage(err.message || "Failed to save file");
      setStatusType("error");
      setSaveMessage("Save failed");
      setSaveType("error");
    }
  };

  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (!currentProject || !currentFile) return;
    const currentContent = fileContentsRef.current[currentFile] ?? editorContent;
    const last = lastSavedRef.current[currentFile] ?? "";
    if (currentContent === last) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, currentProject, currentFile, editorContent, handleSave]);

  const handleRun = async () => {
    if (!currentProject) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    const fileToRun = runConfigFile || currentFile;
    if (!fileToRun) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    if (runConfigFile && !files.includes(runConfigFile)) {
      setStatusMessage("Run config file no longer exists");
      setStatusType("error");
      return;
    }
    if ((inputData || "").length > 1000000) {
      setStatusMessage("Input too large");
      setStatusType("error");
      return;
    }
    const runExt = fileToRun.split(".").pop()?.toLowerCase();
    const webTypes = ["html", "css", "js"];
    if (webTypes.includes(runExt)) {
      try {
        const html = await buildPreviewHtml(fileToRun, runExt);
        setPreviewHtml(html);
        setOutputMode("preview");
        setStatusMessage("Preview updated");
        setStatusType("success");
      } catch (err) {
        setStatusMessage(err.message || "Failed to build preview");
        setStatusType("error");
      }
      return;
    }
    setStatusMessage("Running...");
    setStatusType("running");
    try {
      const response = await api.executeCode(currentProject, fileToRun, inputData);
      if (!response.success) {
        const message = response.message || "Execution failed";
        setOutput(message);
        setStatusMessage(message);
        setStatusType("error");
        return;
      }
      setOutput(response.data || "");
      setOutputMode("text");
      setStatusMessage("Execution finished");
      setStatusType("success");
    } catch (err) {
      setOutput("Execution failed");
      setOutputMode("text");
      setStatusMessage(err.message || "Execution failed");
      setStatusType("error");
    }
  };

  const buildPreviewHtml = async (filename, ext) => {
    const getContent = async (name) => {
      const cached = fileContentsRef.current[name];
      if (cached !== undefined) return cached;
      const content = await api.readFile(currentProject, name);
      setFileContents((prev) => ({ ...prev, [name]: content }));
      setLastSaved((prev) => ({ ...prev, [name]: content }));
      return content;
    };

    if (ext === "html") {
      let htmlContent = await getContent(filename);
      const linkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
      const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;

      const styles = [];
      const scripts = [];
      let match;
      while ((match = linkRegex.exec(htmlContent)) !== null) {
        const href = match[1];
        if (files.includes(href)) {
          styles.push(await getContent(href));
          htmlContent = htmlContent.replace(match[0], "");
        }
      }
      while ((match = scriptRegex.exec(htmlContent)) !== null) {
        const src = match[1];
        if (files.includes(src)) {
          scripts.push(await getContent(src));
          htmlContent = htmlContent.replace(match[0], "");
        }
      }

      const styleTag = styles.length ? `<style>${styles.join("\n")}</style>` : "";
      const scriptTag = scripts.length ? `<script>${scripts.join("\n")}</script>` : "";

      if (htmlContent.includes("</head>")) {
        htmlContent = htmlContent.replace("</head>", `${styleTag}</head>`);
      } else {
        htmlContent = `${styleTag}\n${htmlContent}`;
      }

      if (htmlContent.includes("</body>")) {
        htmlContent = htmlContent.replace("</body>", `${scriptTag}</body>`);
      } else {
        htmlContent = `${htmlContent}\n${scriptTag}`;
      }

      return htmlContent;
    }

    if (ext === "css") {
      const cssContent = await getContent(filename);
      return `<!doctype html><html><head><style>${cssContent}</style></head><body><div class="preview-box">CSS Preview</div></body></html>`;
    }

    const jsContent = await getContent(filename);
    return `<!doctype html><html><head></head><body><div id="app"></div><script>${jsContent}</script></body></html>`;
  };

  const deleteFileByName = async (filename) => {
    if (!currentProject || !filename) {
      setStatusMessage("Select a project first");
      setStatusType("error");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.deleteFile(currentProject, filename);
      if (!response.success) throw new Error(response.message || "Failed to delete file");
      setOpenFiles((prev) => prev.filter((file) => file !== filename));
      setFileContents((prev) => {
        const next = { ...prev };
        delete next[filename];
        return next;
      });
      setLastSaved((prev) => {
        const next = { ...prev };
        delete next[filename];
        return next;
      });
      if (filename === currentFile) {
        setCurrentFile("");
        setEditorContent("");
      }
      if (filename === runConfigFile) {
        setRunConfigFile("");
        try {
          await api.setRunConfig(currentProject, "");
        } catch {
          // ignore
        }
      }
      if (filename === currentFile) {
        setPreviewHtml("");
        setOutputMode("text");
      }
      setStatusMessage("File deleted");
      setStatusType("success");
      await loadFiles(currentProject);
    } catch (err) {
      setStatusMessage(err.message || "Failed to delete file");
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!currentProject || !currentFile) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    openConfirm(`Delete ${currentFile}?`, () => deleteFileByName(currentFile), "Delete");
  };

  const handleDeleteFileByName = async (filename) => {
    if (!currentProject || !filename) {
      setStatusMessage("Select a project first");
      setStatusType("error");
      return;
    }
    openConfirm(`Delete ${filename}?`, () => deleteFileByName(filename), "Delete");
  };

  const handleFindNext = () => {
    if (!currentFile || !searchQuery) return;
    const content = getEditorText();
    let start = searchIndex >= 0 ? searchIndex + 1 : 0;
    if (viewRef.current) {
      start = viewRef.current.state.selection.main.to;
    }
    let index = content.indexOf(searchQuery, start);
    if (index === -1 && start > 0) {
      index = content.indexOf(searchQuery, 0);
    }
    if (index === -1) {
      setStatusMessage("No matches found");
      setStatusType("error");
      return;
    }
    setSearchIndex(index);
    if (viewRef.current) {
      viewRef.current.dispatch({
        selection: { anchor: index, head: index + searchQuery.length },
        scrollIntoView: true
      });
      viewRef.current.focus();
    }
  };

  const replaceSelection = (from, to) => {
    const content = getEditorText();
    const nextContent = content.slice(0, from) + replaceQuery + content.slice(to);
    setEditorText(nextContent);
    if (viewRef.current) {
      const cursor = from + replaceQuery.length;
      viewRef.current.dispatch({
        selection: { anchor: cursor, head: cursor },
        scrollIntoView: true
      });
      viewRef.current.focus();
    }
  };

  const handleReplaceNext = () => {
    if (!currentFile || !searchQuery) return;
    if (viewRef.current) {
      const selection = viewRef.current.state.selection.main;
      if (selection.from !== selection.to) {
        const selected = viewRef.current.state.doc.sliceString(
          selection.from,
          selection.to
        );
        if (selected === searchQuery) {
          replaceSelection(selection.from, selection.to);
          return;
        }
      }
    }
    handleFindNext();
    if (viewRef.current) {
      const selection = viewRef.current.state.selection.main;
      if (selection.from !== selection.to) {
        const selected = viewRef.current.state.doc.sliceString(
          selection.from,
          selection.to
        );
        if (selected === searchQuery) {
          replaceSelection(selection.from, selection.to);
        }
      }
    }
  };

  const handleReplaceAll = () => {
    if (!currentFile || !searchQuery) return;
    const content = getEditorText();
    if (!content.includes(searchQuery)) {
      setStatusMessage("No matches found");
      setStatusType("error");
      return;
    }
    const nextContent = content.split(searchQuery).join(replaceQuery);
    setEditorText(nextContent);
    setStatusMessage("Replaced all matches");
    setStatusType("success");
  };

  useEffect(() => {
    if (showCreateProject) {
      projectInputRef.current?.focus();
    }
  }, [showCreateProject]);

  useEffect(() => {
    if (showCreateFile) {
      fileInputRef.current?.focus();
    }
  }, [showCreateFile]);

  const isDirty =
    currentFile &&
    (fileContents[currentFile] ?? "") !== (lastSaved[currentFile] ?? "");

  const paletteActions = useMemo(() => {
    return [
      {
        id: "new-project",
        label: "Create Project",
        shortcut: "Ctrl+Shift+N",
        run: () => {
          setShowCreateProject(true);
          setShowCreateFile(false);
        }
      },
      {
        id: "new-file",
        label: "Create File",
        shortcut: "Ctrl+Shift+N",
        run: () => {
          setShowCreateFile(true);
          setShowCreateProject(false);
        }
      },
      {
        id: "save-file",
        label: "Save File",
        shortcut: "Ctrl+S",
        run: handleSave,
        disabled: !currentFile
      },
      {
        id: "run-file",
        label: "Run File",
        shortcut: "Ctrl+Enter",
        run: handleRun,
        disabled: !currentFile
      },
      {
        id: "delete-file",
        label: "Delete File",
        shortcut: "Ctrl+Shift+Backspace",
        run: handleDeleteFile,
        disabled: !currentFile
      },
      {
        id: "delete-project",
        label: "Delete Project",
        run: handleDeleteProject,
        disabled: !currentProject
      },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
        run: () => setTheme(theme === "dark" ? "light" : "dark")
      },
      {
        id: "toggle-autosave",
        label: autoSaveEnabled ? "Disable Autosave" : "Enable Autosave",
        run: () => setAutoSaveEnabled((prev) => !prev)
      },
      {
        id: "search",
        label: showSearchPanel ? "Hide Search Panel" : "Show Search Panel",
        shortcut: "Ctrl+F",
        run: () => setShowSearchPanel((prev) => !prev)
      }
    ];
  }, [
    currentFile,
    currentProject,
    theme,
    autoSaveEnabled,
    showSearchPanel,
    handleSave,
    handleRun,
    handleDeleteFile,
    handleDeleteProject
  ]);

  const filteredActions = paletteActions.filter((action) =>
    action.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  const renderTreeNodes = (node, depth = 0) => {
    if (!node.children) return null;
    const entries = Object.values(node.children).sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return entries.map((child) => {
      if (child.type === "folder") {
        const isOpen = expandedFolders[child.path] ?? depth < 1;
        return (
          <div key={child.path}>
            <div
              className="tree-item folder"
              style={{ paddingLeft: `${12 + depth * 12}px` }}
              onClick={() => toggleFolder(child.path)}
            >
              <span className="tree-caret">{isOpen ? "▾" : "▸"}</span>
              <span>{child.name}</span>
            </div>
            {isOpen && renderTreeNodes(child, depth + 1)}
          </div>
        );
      }

      return (
        <div
          key={child.path}
          className={`tree-item file ${child.path === currentFile ? "active" : ""}`}
          style={{ paddingLeft: `${24 + depth * 12}px` }}
          onClick={() => handleSelectFile(child.path)}
        >
          <span className="tree-name">{child.name}</span>
          <button
            className="row-action"
            title="Delete file"
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteFileByName(child.path);
            }}
          >
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path
                  d="M9 3h6l1 2h4v2h-1l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7H4V5h4l1-2zm-2 4 1 11h8l1-11H7zm3 2h2v7h-2V9zm4 0h2v7h-2V9z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </div>
      );
    });
  };

  if (view === "login" || view === "register") {
    const usernameError =
      view === "register" && authUser.trim().length > 0 && authUser.trim().length < 3
        ? "Username must be at least 3 characters."
        : "";
    const passwordError =
      view === "register" && authPass.length > 0 && authPass.length < 6
        ? "Password must be at least 6 characters."
        : "";
    const confirmError =
      view === "register" && authConfirm.length > 0 && authConfirm !== authPass
        ? "Passwords do not match."
        : "";

    const registerDisabled =
      view === "register" &&
      (authUser.trim().length < 3 ||
        authPass.length < 6 ||
        authPass !== authConfirm);

    return (
      <div className="auth-wrapper">
        <div className="auth-hero">
          <h1>CodeSphere IDE</h1>
          <p>
            A focused coding workspace inspired by VS Code. Organize projects, edit files,
            and run code from one unified space.
          </p>
          <div className="auth-meta">
            <div>• Smart workspace management</div>
            <div>• Integrated run + output console</div>
            <div>• Keyboard-first workflow</div>
          </div>
        </div>
        <div className="auth-panel">
          <h2>{view === "login" ? "Welcome back" : "Create an account"}</h2>
          <div className="auth-form">
            <label className="field">
              Username
              <input
                value={authUser}
                onChange={(event) => setAuthUser(event.target.value)}
                placeholder="Enter username"
              />
              {usernameError && <span className="field-error">{usernameError}</span>}
            </label>
            <label className="field">
              Password
              <div className="input-row">
                <input
                  type={showPassword ? "text" : "password"}
                  value={authPass}
                  onChange={(event) => setAuthPass(event.target.value)}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordError && <span className="field-error">{passwordError}</span>}
            </label>
            {view === "register" && (
              <label className="field">
                Confirm Password
                <div className="input-row">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={authConfirm}
                    onChange={(event) => setAuthConfirm(event.target.value)}
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowConfirm((prev) => !prev)}
                  >
                    {showConfirm ? "Hide" : "Show"}
                  </button>
                </div>
                {confirmError && <span className="field-error">{confirmError}</span>}
              </label>
            )}
          </div>
          {authError && <div className="status-pill" data-status="error">{authError}</div>}
          <button
            className="primary-btn"
            onClick={view === "login" ? handleLogin : handleRegister}
            disabled={isLoading || registerDisabled}
          >
            {view === "login" ? "Login" : "Register"}
          </button>
          <div className="auth-toggle">
            {view === "login" ? "New here?" : "Already have an account?"}
            <button onClick={() => setView(view === "login" ? "register" : "login")}>
              {view === "login" ? "Register" : "Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            CodeSphere <span>IDE</span>
          </div>
          <div className="top-actions-left">
            <div className="popover">
              <button
                onClick={() => {
                  setShowCreateProject((prev) => !prev);
                  setShowCreateFile(false);
                }}
                disabled={isLoading}
                className="icon-btn"
              >
                <span className="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path
                      d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3V6zm0 6h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6zm9-3h2v3h3v2h-3v3h-2v-3H9v-2h3V9z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span>New Project</span>
              </button>
              {showCreateProject && (
                <div className="popover-card">
                  <div className="popover-title">Create Project</div>
                  <input
                    ref={projectInputRef}
                    className="input"
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateProject();
                      }
                    }}
                  />
                  <div className="popover-actions">
                    <button onClick={handleCreateProject} disabled={isLoading || !newProjectName.trim()}>
                      Create
                    </button>
                    <button
                      className="ghost"
                      onClick={() => {
                        setShowCreateProject(false);
                        setNewProjectName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="popover">
              <button
                onClick={() => {
                  setShowCreateFile((prev) => !prev);
                  setShowCreateProject(false);
                }}
                disabled={isLoading}
                className="icon-btn"
              >
                <span className="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path
                      d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 1v4h4l-4-4zM8 11h8v2H8v-2zm0 4h8v2H8v-2z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span>New File</span>
              </button>
              {showCreateFile && (
                <div className="popover-card">
                  <div className="popover-title">Create File</div>
                  <input
                    ref={fileInputRef}
                    className="input"
                    placeholder={currentProject ? "File name" : "Select a project first"}
                    value={newFileName}
                    disabled={!currentProject}
                    onChange={(event) => setNewFileName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateFile();
                      }
                    }}
                  />
                  <div className="popover-actions">
                    <button
                      onClick={handleCreateFile}
                      disabled={isLoading || !currentProject || !newFileName.trim()}
                    >
                      Create
                    </button>
                    <button
                      className="ghost"
                      onClick={() => {
                        setShowCreateFile(false);
                        setNewFileName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleSave} className="icon-btn">
              <span className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    d="M5 3h11l3 3v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V7h-4V5H5zm3 5h8v2H8v-2zm0 4h6v2H8v-2z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>Save</span>
            </button>
            <span className="save-pill" data-status={saveType}>{saveMessage}</span>
          </div>
        </div>
        <div className="top-actions-right">
          <button
            onClick={() => {
              setCommandQuery("");
              setShowCommandPalette(true);
            }}
            className="icon-btn"
          >
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h10v2H4v-2z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>Command</span>
          </button>
          <button onClick={() => setShowSearchPanel((prev) => !prev)} className="icon-btn">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M10 4a6 6 0 1 1 4.2 10.2l4.3 4.3-1.4 1.4-4.3-4.3A6 6 0 0 1 10 4zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>Search</span>
          </button>
          <div className="popover">
            <button
              onClick={() => setShowRunConfig((prev) => !prev)}
              className="icon-btn"
              disabled={!currentProject}
            >
              <span className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    d="M4 6a2 2 0 0 1 2-2h8l6 6v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm9 0v4h4l-4-4zM8 12h8v2H8v-2zm0 4h6v2H8v-2z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>Run Config</span>
            </button>
            {showRunConfig && (
              <div className="popover-card">
                <div className="popover-title">Run Config</div>
                <select
                  className="input"
                  value={runConfigFile}
                  onChange={(event) => setRunConfigFile(event.target.value)}
                >
                  <option value="">Use current file</option>
                  {files.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
                <div className="popover-actions">
                  <button
                    onClick={async () => {
                      if (!currentProject) return;
                      const response = await api.setRunConfig(currentProject, runConfigFile);
                      if (!response.success) {
                        setStatusMessage(response.message || "Failed to save run config");
                        setStatusType("error");
                        return;
                      }
                      setStatusMessage("Run config saved");
                      setStatusType("success");
                      setShowRunConfig(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      setShowRunConfig(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setAutoSaveEnabled((prev) => !prev)}
            className="icon-btn"
            title={autoSaveEnabled ? "Disable autosave" : "Enable autosave"}
          >
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M5 3h11l3 3v6h-2V7h-4V5H5v14h6v2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm9 9a5 5 0 1 1-3.536 8.536L8 22l-2-2 2.464-2.464A5 5 0 0 1 14 12zm0 2a3 3 0 1 0 2.121 5.121A3 3 0 0 0 14 14z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>{autoSaveEnabled ? "Autosave" : "Autosave Off"}</span>
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="icon-btn">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M12 3a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm6.364 2.636a1 1 0 0 1 1.414 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414zM21 11a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zM6.636 4.636a1 1 0 0 1 0 1.414L5.222 7.464A1 1 0 1 1 3.808 6.05l1.414-1.414a1 1 0 0 1 1.414 0zM5 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h2zm1.636 7.364a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 1 1 1.414-1.414l1.414 1.414zM12 17a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zm6.364 1.364a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 1 1 1.414 1.414l-1.414 1.414zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <button onClick={handleRun} className="icon-btn">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
              </svg>
            </span>
            <span>Run</span>
          </button>
          <button onClick={handleLogout} className="icon-btn">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M10 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7v-2h7V6h-7V4zm-1 4 1.414 1.414L8.828 11H15v2H8.828l1.586 1.586L9 16l-4-4 4-4z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="main-grid">
        <aside className="explorer">
          <div>
            <h3>Projects</h3>
            <ul className="list">
              {projects.map((project) => (
                <li
                  key={project}
                  className={project === currentProject ? "active" : ""}
                  onClick={() => handleSelectProject(project)}
                >
                  <span className="list-name">{project}</span>
                  <button
                    className="row-action"
                    title="Delete project"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteProjectByName(project);
                    }}
                  >
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path
                          d="M9 3h6l1 2h4v2h-1l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7H4V5h4l1-2zm-2 4 1 11h8l1-11H7zm3 2h2v7h-2V9zm4 0h2v7h-2V9z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Files</h3>
            <div className="tree">
              {files.length === 0 ? (
                <div className="tree-empty">No files yet</div>
              ) : (
                renderTreeNodes(fileTree)
              )}
            </div>
          </div>
        </aside>

        <section className="editor-area">
          <div className="editor-header">
            <div className="editor-tab">
              {currentFile || "No file selected"}
              {isDirty && <span className="dirty-dot" title="Unsaved changes"></span>}
              <span className="badge">{currentProject || "No project"}</span>
            </div>
            <div className="editor-status">{currentFile ? "Editing" : "Idle"}</div>
          </div>
          <div className="tabs-bar">
            {openFiles.length === 0 && <div className="tabs-empty">No files open</div>}
            {openFiles.map((file) => {
              const dirty =
                (fileContents[file] ?? "") !== (lastSaved[file] ?? "");
              return (
                <div
                  key={file}
                  className={`tab ${file === currentFile ? "active" : ""}`}
                  onClick={() => handleSelectFile(file)}
                >
                  <span className="tab-name">{file}</span>
                  {dirty && <span className="dirty-dot" title="Unsaved changes"></span>}
                  <button
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseTab(file);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {showSearchPanel && (
            <div className="search-panel">
              <div className="search-row">
                <input
                  ref={searchInputRef}
                  className="input"
                  placeholder="Find"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleFindNext();
                    }
                  }}
                />
                <input
                  className="input"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={(event) => setReplaceQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleReplaceNext();
                    }
                  }}
                />
                <button onClick={handleFindNext}>Find Next</button>
                <button onClick={handleReplaceNext}>Replace</button>
                <button onClick={handleReplaceAll}>Replace All</button>
                <button
                  className="ghost"
                  onClick={() => setShowSearchPanel(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <div className="editor-pane">
            {currentFile ? (
              <div className="editor-surface">
                <CodeMirror
                  value={editorContent}
                  height="100%"
                  width="100%"
                  style={{ width: "100%", maxWidth: "100%" }}
                  theme={codeTheme}
                  extensions={editorExtensions}
                  onChange={(value) => {
                    setEditorContent(value);
                    if (currentFile) {
                      setFileContents((prev) => ({ ...prev, [currentFile]: value }));
                    }
                  }}
                  onCreateEditor={(view) => {
                    viewRef.current = view;
                  }}
                  editable={!!currentFile}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    highlightActiveLineGutter: true,
                    foldGutter: true,
                    autocompletion: true,
                    bracketMatching: true
                  }}
                />
              </div>
            ) : (
              <div className="editor-placeholder">
                Select or create a file to begin.
              </div>
            )}
          </div>

          <div className="output-panel">
            <div className="editor-status">Console</div>
            <textarea
              className="input"
              value={inputData}
              onChange={(event) => setInputData(event.target.value)}
              placeholder="Standard input (stdin)"
              rows={3}
            />
            {outputMode === "preview" ? (
              <iframe
                title="Preview"
                className="preview-frame"
                sandbox="allow-scripts"
                srcDoc={previewHtml}
              />
            ) : (
              <pre>{output || "Run your code to see output."}</pre>
            )}
          </div>
        </section>
      </div>

      <footer className="status-bar">
        <span className="status-pill" data-status={statusType}>{statusMessage}</span>
        <span>{currentProject ? `${currentProject}/${currentFile || ""}` : "No project selected"}</span>
      </footer>

      {showCommandPalette && (
        <div
          className="command-overlay"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="command-palette"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              ref={paletteInputRef}
              className="input"
              placeholder="Type a command..."
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
            />
            <div className="command-list">
              {filteredActions.length === 0 && (
                <div className="command-empty">No matching commands</div>
              )}
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  className={`command-item ${action.disabled ? "disabled" : ""}`}
                  onClick={() => {
                    if (action.disabled) return;
                    action.run();
                    setShowCommandPalette(false);
                  }}
                >
                  <span>{action.label}</span>
                  {action.shortcut && <span className="command-shortcut">{action.shortcut}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div className="confirm-toast" role="alert">
          <div className="confirm-message">{confirmState.message}</div>
          <div className="confirm-actions">
            <button
              className="ghost"
              onClick={() =>
                setConfirmState({ open: false, message: "", confirmLabel: "Delete", onConfirm: null })
              }
            >
              Cancel
            </button>
            <button
              className="danger"
              onClick={() => {
                const handler = confirmState.onConfirm;
                setConfirmState((prev) => ({ ...prev, open: false }));
                if (handler) handler();
              }}
            >
              {confirmState.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
