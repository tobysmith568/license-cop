import { test } from "@playwright/test";
import { TermsPageObject } from "../support/page-objects/terms.po";

test.describe("Terms", () => {
  let pageObject: TermsPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/terms");
    pageObject = new TermsPageObject(page);
  });

  test("should display the main heading", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the Contact Us heading", async () => {
    await pageObject.containsTheContactUsHeading();
  });
});
