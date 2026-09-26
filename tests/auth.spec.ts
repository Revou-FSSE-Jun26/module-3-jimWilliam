import { expect, test } from "./fixtures";
import { CUSTOMER_STATE } from "./global-setup";

test.describe("registration and login", () => {
  test("register -> signed in -> survives refresh -> log out -> log back in", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `flow-${stamp}@example.com`;
    const username = `Flow ${stamp}`;

    await page.goto("/register");
    await page.getByTestId("register-username").fill(username);
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill("password-123");
    await page.getByTestId("register-confirmPassword").fill("password-123");
    await page.getByTestId("register-submit").click();

    // 201 -> stored in localStorage -> redirected home, username in the header
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("header-username")).toHaveAttribute("title", `${username} — your account`);
    await expect(page.getByTestId("header-username")).toHaveAttribute("href", "/account");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("revotech:user") ?? "null"));
    expect(stored).toMatchObject({ username, email });
    expect(typeof stored.id).toBe("number");

    // the session is restored by AuthProvider on mount
    await page.reload();
    await expect(page.getByTestId("header-username")).toHaveAttribute("title", `${username} — your account`);

    await page.getByTestId("logout").click();
    await expect(page.getByTestId("register-link")).toBeVisible();

    await page.goto("/login");
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill("password-123");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("header-username")).toBeVisible();
  });

  test("wrong password shows a form-level error", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("andi.pratama@example.com");
    await page.getByTestId("login-password").fill("definitely-wrong");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the admin lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("andi.pratama@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("stats-hud")).toBeVisible();
  });

  test("'Login to buy' brings the customer back to the product", async ({ page }) => {
    await page.goto("/products/12");
    await page.getByTestId("purchase").getByTestId("login-to-buy").click();
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts%2F12/);
    await page.getByTestId("login-email").fill("siti.rahayu@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();
    // used to land on "/": the login page's guard raced the form and overrode ?next=
    await expect(page).toHaveURL(/\/products\/12$/);
    await expect(page.getByTestId("purchase").getByTestId("add-to-cart")).toBeVisible();
  });

  test("logged-out visitors are sent to /login from protected pages", async ({ page }) => {
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/login\?next=%2Fcart/);
  });

  test.describe("as a customer", () => {
    test.use({ storageState: CUSTOMER_STATE });

    test("cannot open the dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/$/);
    });

    test("is bounced away from /login", async ({ page }) => {
      await page.goto("/login");
      await expect(page).toHaveURL(/\/$/);
    });
  });
});
