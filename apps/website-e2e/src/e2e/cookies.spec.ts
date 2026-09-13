import { test } from "@playwright/test";
import { CookiesPageObject } from "../support/page-objects/cookies.po";

test.describe("Cookies", () => {
  let pageObject: CookiesPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/cookies");
    pageObject = new CookiesPageObject(page);
  });

  test("should display the main heading", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the Contact Us heading", async () => {
    await pageObject.containsTheContactUsHeading();
  });
});
