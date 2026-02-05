import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
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

  const [statusMessage, setStatusMessage] = useState("Ready");
  const [statusType, setStatusType] = useState("success");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveType, setSaveType] = useState("");

  const projectInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const paletteInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const viewRef = useRef(null);
  const fileContentsRef = useRef({});
  const lastSavedRef = useRef({});

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
    if (showCommandPalette) {
      paletteInputRef.current?.focus();
    }
  }, [showCommandPalette]);

  useEffect(() => {
    if (showSearchPanel) {
      searchInputRef.current?.focus();
    }
  }, [showSearchPanel]);

  useEffect(() => {
    if (view === "editor") {
      loadProjects();
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
      const response = await api.login(authUser, authPass);
      localStorage.setItem("codesphere_token", response.data);
      localStorage.setItem("codesphere_user", authUser);
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
    if (trimmedUser.length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (authPass.length < 6) {
      setAuthError("Password must be at least 6 characters.");
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

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
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
    setStatusMessage(`Project ${projectName} selected`);
    setStatusType("success");
    await loadFiles(projectName);
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    const ok = window.confirm(`Delete project ${currentProject}? This removes all files.`);
    if (!ok) return;
    setIsLoading(true);
    try {
      const response = await api.deleteProject(currentProject);
      if (!response.success) throw new Error(response.message || "Failed to delete project");
      setCurrentProject("");
      setCurrentFile("");
      setFiles([]);
      setEditorContent("");
      setOpenFiles([]);
      setFileContents({});
      setLastSaved({});
      setOutput("");
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

  const handleCreateFile = async () => {
    if (!currentProject) {
      setStatusMessage("Select a project first");
      setStatusType("error");
      return;
    }
    const filename = newFileName.trim();
    if (!filename) return;
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

  const handleRun = async () => {
    if (!currentProject || !currentFile) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    setStatusMessage("Running...");
    setStatusType("running");
    try {
      const response = await api.executeCode(currentProject, currentFile, inputData);
      if (!response.success) {
        const message = response.message || "Execution failed";
        setOutput(message);
        setStatusMessage(message);
        setStatusType("error");
        return;
      }
      setOutput(response.data || "");
      setStatusMessage("Execution finished");
      setStatusType("success");
    } catch (err) {
      setOutput("Execution failed");
      setStatusMessage(err.message || "Execution failed");
      setStatusType("error");
    }
  };

  const handleDeleteFile = async () => {
    if (!currentProject || !currentFile) {
      setStatusMessage("Select a file first");
      setStatusType("error");
      return;
    }
    const ok = window.confirm(`Delete ${currentFile}?`);
    if (!ok) return;
    setIsLoading(true);
    try {
      const response = await api.deleteFile(currentProject, currentFile);
      if (!response.success) throw new Error(response.message || "Failed to delete file");
      const deleted = currentFile;
      setCurrentFile("");
      setEditorContent("");
      setOpenFiles((prev) => prev.filter((file) => file !== deleted));
      setFileContents((prev) => {
        const next = { ...prev };
        delete next[deleted];
        return next;
      });
      setLastSaved((prev) => {
        const next = { ...prev };
        delete next[deleted];
        return next;
      });
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

  const handleFindNext = () => {
    if (!currentFile || !searchQuery) return;
    const content = fileContentsRef.current[currentFile] ?? "";
    let start = 0;
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

  const replaceSelection = (from, to, content) => {
    const nextContent = content.slice(0, from) + replaceQuery + content.slice(to);
    setEditorContent(nextContent);
    setFileContents((prev) => ({ ...prev, [currentFile]: nextContent }));
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
    const content = fileContentsRef.current[currentFile] ?? "";
    if (viewRef.current) {
      const selection = viewRef.current.state.selection.main;
      if (selection.from !== selection.to) {
        const selected = content.slice(selection.from, selection.to);
        if (selected === searchQuery) {
          replaceSelection(selection.from, selection.to, content);
          return;
        }
      }
    }
    handleFindNext();
    const updatedContent = fileContentsRef.current[currentFile] ?? "";
    if (viewRef.current) {
      const selection = viewRef.current.state.selection.main;
      if (selection.from !== selection.to) {
        const selected = updatedContent.slice(selection.from, selection.to);
        if (selected === searchQuery) {
          replaceSelection(selection.from, selection.to, updatedContent);
        }
      }
    }
  };

  const handleReplaceAll = () => {
    if (!currentFile || !searchQuery) return;
    const content = fileContentsRef.current[currentFile] ?? "";
    const nextContent = content.split(searchQuery).join(replaceQuery);
    setEditorContent(nextContent);
    setFileContents((prev) => ({ ...prev, [currentFile]: nextContent }));
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
          {child.name}
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
              >
                New Project
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
              >
                New File
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
            <button onClick={handleSave}>Save</button>
            <span className="save-pill" data-status={saveType}>{saveMessage}</span>
          </div>
        </div>
        <div className="top-actions-right">
          <button
            onClick={() => {
              setCommandQuery("");
              setShowCommandPalette(true);
            }}
          >
            Command
          </button>
          <button onClick={() => setShowSearchPanel((prev) => !prev)}>Search</button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={handleRun}>Run</button>
          <button onClick={handleDeleteFile} disabled={isLoading}>Delete File</button>
          <button onClick={handleDeleteProject} disabled={isLoading}>Delete Project</button>
          <button onClick={handleLogout}>Logout</button>
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
                  {project}
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
                />
                <input
                  className="input"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={(event) => setReplaceQuery(event.target.value)}
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
            <pre>{output || "Run your code to see output."}</pre>
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
    </div>
  );
}
