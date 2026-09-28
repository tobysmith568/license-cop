import { test } from "@playwright/test";
import { ShieldPageObject } from "../support/page-objects/shield.po";

test.describe("Shield", () => {
  let pageObject: ShieldPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/shield");
    pageObject = new ShieldPageObject(page);
  });

  test("should display the main heading", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the badge", async () => {
    await pageObject.containsTheBadge();
  });

  test("should display the html header", async () => {
    await pageObject.containsTheHtmlHeader();
  });

  test("should display the markdown header", async () => {
    await pageObject.containsTheMarkdownHeader();
  });
});
