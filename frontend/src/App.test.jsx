import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

describe("App", () => {
  it("renders login screen by default", () => {
    localStorage.removeItem("codesphere_token");
    render(<App />);
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });
});
