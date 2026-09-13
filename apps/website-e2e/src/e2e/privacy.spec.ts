import { test } from "@playwright/test";
import { PrivacyPageObject } from "../support/page-objects/privacy.po";

test.describe("Privacy", () => {
  let pageObject: PrivacyPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/privacy");
    pageObject = new PrivacyPageObject(page);
  });

  test("should display the main heading", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the Contact Us heading", async () => {
    await pageObject.containsTheContactUsHeading();
  });
});
