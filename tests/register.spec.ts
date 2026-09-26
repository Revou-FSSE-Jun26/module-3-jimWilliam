import { expect, test } from "./fixtures";

/** Client-side validation: each of the four rules, then all of them at once. Nothing is sent. */
test.describe("register form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("register-form")).toBeVisible();
  });

  const fill = async (page: import("@playwright/test").Page, v: Partial<Record<"username" | "email" | "password" | "confirmPassword", string>>) => {
    const values = { username: "Valid Name", email: "valid@example.com", password: "longenough1", confirmPassword: "longenough1", ...v };
    for (const [k, val] of Object.entries(values)) await page.getByTestId(`register-${k}`).fill(val);
    await page.getByTestId("register-submit").click();
  };

  test("username is required", async ({ page }) => {
    await fill(page, { username: "" });
    await expect(page.getByTestId("error-username")).toHaveText("Username is required.");
  });

  test("email must look like an email", async ({ page }) => {
    await fill(page, { email: "not-an-email" });
    await expect(page.getByTestId("error-email")).toHaveText("Enter a valid email address.");
  });

  test("password needs at least 8 characters", async ({ page }) => {
    await fill(page, { password: "short", confirmPassword: "short" });
    await expect(page.getByTestId("error-password")).toHaveText("Password must be at least 8 characters.");
  });

  test("passwords must match", async ({ page }) => {
    await fill(page, { confirmPassword: "something-else" });
    await expect(page.getByTestId("error-confirmPassword")).toHaveText("Passwords do not match.");
  });

  test("an empty form shows every error and does not submit", async ({ page }) => {
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/users")) posted = true;
    });
    await page.getByTestId("register-submit").click();
    for (const k of ["username", "email", "password"]) await expect(page.getByTestId(`error-${k}`)).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect(posted).toBe(false);
  });
});
