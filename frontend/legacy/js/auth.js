import { BASE_URL } from "./config.js";

const TOKEN_KEY = "codesphere_token";

// Save token
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

// Get token
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Remove token (logout)
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// Check if user is logged in
export function isAuthenticated() {
    return !!getToken();
}

// Login API
export async function login(username, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const response = await res.json();

    if (!response.success) {
        throw new Error(response.message || "Login failed");
    }

    // 🔥 FORCE overwrite
    localStorage.setItem("codesphere_token", response.data);

    // 🔥 IMPORTANT
    localStorage.setItem("codesphere_user", username);
}


// Logout

export function logout() {
    localStorage.removeItem("codesphere_token");
    localStorage.removeItem("codesphere_user");
    window.location.replace("login.html");
}
