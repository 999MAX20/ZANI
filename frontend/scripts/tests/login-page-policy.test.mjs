import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..", "..");
const loginPagePath = path.join(frontendDir, "src", "features", "auth", "LoginPage.tsx");
const signupPagePath = path.join(frontendDir, "src", "features", "auth", "SignupPage.tsx");
const passwordTogglePath = path.join(frontendDir, "src", "features", "auth", "PasswordVisibilityToggle.tsx");
const loginCssPath = path.join(frontendDir, "src", "features", "auth", "authLoginSerenity.css");
const languageSelectorPath = path.join(frontendDir, "src", "components", "layout", "LanguageSelector.tsx");
const routerPath = path.join(frontendDir, "src", "app", "router.tsx");

const loginPage = fs.readFileSync(loginPagePath, "utf8");
const signupPage = fs.readFileSync(signupPagePath, "utf8");
const passwordToggle = fs.readFileSync(passwordTogglePath, "utf8");
const loginCss = fs.readFileSync(loginCssPath, "utf8");
const languageSelector = fs.readFileSync(languageSelectorPath, "utf8");
const router = fs.readFileSync(routerPath, "utf8");

test("login social flow always clears pending state on token failure", () => {
  const completeSocialLogin = loginPage.match(/async function completeSocialLogin[\s\S]*?\n  }\n/);
  assert.ok(completeSocialLogin, "completeSocialLogin should exist");
  assert.match(completeSocialLogin[0], /finally\s*{[\s\S]*setSocialLoading\(null\)/);
  assert.doesNotMatch(completeSocialLogin[0], /if \(!idToken\)\s*{[\s\S]*return;/);
});

test("login page keeps unconfigured social providers out of the compact form", () => {
  assert.match(loginPage, /const hasSocialLogin = isGoogleConfigured \|\| isAppleConfigured;/);
  assert.match(loginPage, /{hasSocialLogin \? \(/);
  assert.doesNotMatch(loginPage, /auth\.googleSoon|auth\.appleSoon/);
});

test("login page keeps the public entry screen focused on sign-in", () => {
  assert.doesNotMatch(loginPage, /auth\.badge|auth\.copy|auth\.fastFollowup|auth\.smartBooking|auth\.ownerControl/);
  assert.doesNotMatch(loginPage, /serenity-login__benefits|serenity-login__trustline|serenity-login__trust|serenity-login__card-mark/);
  assert.doesNotMatch(loginPage, /nav\.conversations|nav\.calendar|auth\.trustSecurity|auth\.welcome/);
  assert.doesNotMatch(loginPage, /auth\.noAccount|serenity-login__signup-link/);
});

test("signup omits the owner-requested explanatory copy", () => {
  assert.doesNotMatch(signupPage, /signup\.badge|signup\.copy|signup\.startNote|signup\.eyebrow|auth\.trustSecurity/);
  assert.doesNotMatch(signupPage, /serenity-login__badge|serenity-login__lead|serenity-login__trustline|serenity-login__password-checks|serenity-login__card-mark/);
});

test("auth language switcher uses the themed shared select", () => {
  assert.match(languageSelector, /import { Select } from "\.\.\/ui\/Select";/);
  assert.match(languageSelector, /<Select/);
  assert.doesNotMatch(languageSelector, /<select/);
  assert.match(loginCss, /\.serenity-login__language \[role="listbox"\]/);
});

test("protected-route login redirects preserve the intended workspace route", () => {
  assert.match(router, /<Navigate to="\/login" replace state={{ from: location }} \/>/);
  assert.match(loginPage, /function getPostLoginPath/);
  assert.match(loginPage, /pathname\.startsWith\("\/app"\)/);
  assert.match(loginPage, /pathname\.startsWith\("\/platform"\)/);
});

test("login viewport policy prevents page-level scrolling", () => {
  assert.match(loginCss, /\.serenity-login\s*{[\s\S]*height:\s*100dvh;/);
  assert.match(loginCss, /\.serenity-login\s*{[\s\S]*max-height:\s*100dvh;/);
  assert.match(loginCss, /\.serenity-login\s*{[\s\S]*overflow:\s*hidden;/);
  assert.doesNotMatch(loginCss, /\.serenity-login\s*{[\s\S]*overflow:\s*auto;/);
});

test("signup uses the compact serenity auth system, not the legacy dark shell", () => {
  assert.match(signupPage, /className="serenity-login serenity-login--signup"/);
  assert.match(signupPage, /import "\.\/authLoginSerenity\.css";/);
  assert.doesNotMatch(signupPage, /AuthExperienceShell|authExperience\.css|authExperienceMobileFix\.css|zani-auth-/);
  assert.match(loginCss, /\.serenity-login--signup \.serenity-login__layout/);
  assert.match(loginCss, /\.serenity-login__field-grid/);
});

test("auth forms do not render the large inner brand icon", () => {
  assert.doesNotMatch(loginPage, /serenity-login__card-mark/);
  assert.doesNotMatch(signupPage, /serenity-login__card-mark/);
  assert.doesNotMatch(loginCss, /serenity-login__card-mark/);
  assert.match(loginCss, /\.serenity-login__card h2\s*{[\s\S]*margin:\s*0;/);
});

test("auth password fields expose accessible visibility toggles", () => {
  assert.match(passwordToggle, /type="button"/);
  assert.match(passwordToggle, /aria-label={label}/);
  assert.match(passwordToggle, /aria-pressed={visible}/);
  assert.match(passwordToggle, /auth\.showPassword/);
  assert.match(passwordToggle, /auth\.hidePassword/);
  assert.match(loginPage, /type={isPasswordVisible \? "text" : "password"}/);
  assert.match(loginPage, /<PasswordVisibilityToggle[\s\S]*visible={isPasswordVisible}/);
  assert.match(signupPage, /type={isPasswordVisible \? "text" : "password"}/);
  assert.match(signupPage, /type={isPasswordConfirmVisible \? "text" : "password"}/);
  assert.match(signupPage, /<PasswordVisibilityToggle[\s\S]*visible={isPasswordConfirmVisible}/);
  assert.match(loginCss, /\.serenity-login__password-toggle:focus-visible/);
});

test("signup password rules are validation errors, not static hint chips", () => {
  assert.doesNotMatch(signupPage, /passwordChecks|watch\("password"\)|CheckCircle2/);
  assert.match(signupPage, /min\(8, t\("signup\.passwordMinCheck"\)\)/);
  assert.match(signupPage, /regex\([\s\S]*signup\.passwordLettersNumbersCheck/);
  assert.match(signupPage, /refine\([\s\S]*signup\.passwordNoSpacesCheck/);
  assert.doesNotMatch(loginCss, /serenity-login__password-checks/);
});
