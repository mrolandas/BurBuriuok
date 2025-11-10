import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  await page.goto("http://localhost:5173/sections/1", {
    waitUntil: "networkidle",
  });

  await page.locator("button.app-shell__user-toggle").click();
  const adminToggle = page.getByRole("menuitem", { name: /Aktyvuoti Admin/ });
  await adminToggle.click();

  await page.locator("button.tree-node__toggle").first().click();

  const editButton = page
    .locator(".tree-node__item-toolbar button", { hasText: "Redaguoti" })
    .first();
  await editButton.waitFor({ state: "visible" });
  await editButton.click();

  await page.waitForSelector(".concept-modal", { state: "visible" });

  console.log("Modal opened successfully");
  await browser.close();
}

run().catch((error) => {
  console.error("Modal test failed:", error);
  process.exitCode = 1;
});
