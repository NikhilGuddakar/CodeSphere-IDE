const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function getToken() {
  return localStorage.getItem("codesphere_token");
}

async function parseError(res) {
  let message = "Request failed";
  try {
    const data = await res.clone().json();
    if (data && data.message) message = data.message;
  } catch {
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
  }
  return message;
}

async function parseJsonBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Unauthorized");
    }
    throw new Error(await parseError(res));
  }

  return res;
}

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await parseJsonBody(res);
  if (!res.ok) {
    throw new Error(data?.message || "Invalid username or password");
  }
  if (!data?.success) {
    throw new Error(data?.message || "Login failed");
  }
  return data;
}

export async function register(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await parseJsonBody(res);
  if (!res.ok) {
    throw new Error(data?.message || "Registration failed");
  }
  if (!data?.success) {
    throw new Error(data?.message || "Registration failed");
  }
  return data;
}

export async function fetchProjects() {
  const res = await request("/api/projects");
  return res.json();
}

export async function createProject(name) {
  const res = await request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return res.json();
}

export async function deleteProject(projectName) {
  const res = await request(`/api/projects/${projectName}`, {
    method: "DELETE"
  });
  return res.json();
}

export async function fetchFiles(projectName) {
  const res = await request(`/api/projects/${projectName}/files`);
  return res.json();
}

export async function readFile(projectName, filename) {
  const res = await request(
    `/api/projects/${projectName}/files/read?filename=${encodeURIComponent(filename)}`
  );
  return res.text();
}

export async function saveFile(projectName, filename, content) {
  const res = await request(`/api/projects/${projectName}/files`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content })
  });
  return res.json();
}

export async function deleteFile(projectName, filename) {
  const res = await request(
    `/api/projects/${projectName}/files?filename=${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  return res.json();
}

export async function executeCode(projectName, filename, input) {
  const res = await request(`/api/projects/${projectName}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, input })
  });
  return res.json();
}
