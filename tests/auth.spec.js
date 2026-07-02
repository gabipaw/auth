// Testy e2e logowania i sesji. Endpointy Supabase Auth (GoTrue) są mockowane
// w pamięci przez page.route — dzięki temu rejestracja, logowanie, strażnik
// trasy chronionej i wylogowanie są deterministyczne i nie ruszają sieci.
const { test, expect } = require("@playwright/test");

const tokenFor = (email) => "tk_" + encodeURIComponent(email);
const emailFromToken = (auth) => {
  const m = /Bearer tk_(.+)$/.exec(auth || "");
  return m ? decodeURIComponent(m[1]) : null;
};

function userObj(email) {
  return { id: "id-" + email, email, role: "authenticated" };
}
function sessionObj(email) {
  return {
    access_token: tokenFor(email),
    refresh_token: "refresh-" + email,
    token_type: "bearer",
    expires_in: 3600,
    user: userObj(email),
  };
}

// Mock GoTrue z prostą bazą użytkowników w pamięci.
async function mockAuth(page, seed = []) {
  const users = seed.map((u) => ({ ...u }));

  await page.route("**/auth/v1/signup", async (route) => {
    const { email, password } = JSON.parse(route.request().postData());
    if (users.some((u) => u.email === email)) {
      return route.fulfill({ status: 422, contentType: "application/json",
        body: JSON.stringify({ msg: "User already registered" }) });
    }
    users.push({ email, password });
    // Potwierdzanie e-maila wyłączone → signup od razu zwraca sesję.
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(sessionObj(email)) });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    const { email, password } = JSON.parse(route.request().postData());
    const u = users.find((x) => x.email === email && x.password === password);
    if (!u) {
      return route.fulfill({ status: 400, contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(sessionObj(email)) });
  });

  await page.route("**/auth/v1/user", async (route) => {
    const email = emailFromToken(route.request().headers()["authorization"]);
    if (!email || !users.some((u) => u.email === email)) {
      return route.fulfill({ status: 401, contentType: "application/json",
        body: JSON.stringify({ msg: "invalid token" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(userObj(email)) });
  });

  await page.route("**/auth/v1/logout", async (route) =>
    route.fulfill({ status: 204, body: "" }));

  return { users };
}

test("rejestracja tworzy sesję i przenosi do panelu", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.getByTestId("go-register").click();
  await page.getByTestId("register-email").fill("nowy@example.com");
  await page.getByTestId("register-password").fill("tajnehaslo");
  await page.getByTestId("register-submit").click();

  await expect(page.getByTestId("view-dashboard")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveText("nowy@example.com");
});

test("logowanie poprawnymi danymi wchodzi do panelu", async ({ page }) => {
  await mockAuth(page, [{ email: "jan@example.com", password: "haslo123" }]);
  await page.goto("/");
  await page.getByTestId("login-email").fill("jan@example.com");
  await page.getByTestId("login-password").fill("haslo123");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("view-dashboard")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveText("jan@example.com");
});

test("błędne hasło pokazuje komunikat i nie loguje", async ({ page }) => {
  await mockAuth(page, [{ email: "jan@example.com", password: "haslo123" }]);
  await page.goto("/");
  await page.getByTestId("login-email").fill("jan@example.com");
  await page.getByTestId("login-password").fill("zlehaslo");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("login-err")).toHaveText("Nieprawidłowy e-mail lub hasło.");
  await expect(page.getByTestId("view-dashboard")).toBeHidden();
});

test("rejestracja istniejącego konta pokazuje błąd", async ({ page }) => {
  await mockAuth(page, [{ email: "jan@example.com", password: "haslo123" }]);
  await page.goto("/#/register");
  await page.getByTestId("register-email").fill("jan@example.com");
  await page.getByTestId("register-password").fill("haslo123");
  await page.getByTestId("register-submit").click();

  await expect(page.getByTestId("register-err")).toHaveText("Konto z tym adresem już istnieje.");
});

test("trasa chroniona bez sesji przekierowuje na logowanie", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/#/dashboard");

  await expect(page.getByTestId("view-login")).toBeVisible();
  await expect(page.getByTestId("view-dashboard")).toBeHidden();
  await expect(page).toHaveURL(/#\/login$/);
});

test("sesja przetrwa odświeżenie strony", async ({ page }) => {
  await mockAuth(page, [{ email: "jan@example.com", password: "haslo123" }]);
  await page.goto("/");
  await page.getByTestId("login-email").fill("jan@example.com");
  await page.getByTestId("login-password").fill("haslo123");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("view-dashboard")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("view-dashboard")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveText("jan@example.com");
});

test("wylogowanie kończy sesję i chroni panel", async ({ page }) => {
  await mockAuth(page, [{ email: "jan@example.com", password: "haslo123" }]);
  await page.goto("/");
  await page.getByTestId("login-email").fill("jan@example.com");
  await page.getByTestId("login-password").fill("haslo123");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("view-dashboard")).toBeVisible();

  await page.getByTestId("logout").click();
  await expect(page.getByTestId("view-login")).toBeVisible();

  // Po wylogowaniu wejście na /#/dashboard znów przekierowuje na logowanie.
  await page.goto("/#/dashboard");
  await expect(page.getByTestId("view-login")).toBeVisible();
});
