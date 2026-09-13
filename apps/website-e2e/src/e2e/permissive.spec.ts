import { test } from "@playwright/test";
import { PermissivePageObject } from "../support/page-objects/permissive.po";

test.describe("Permissive", () => {
  let pageObject: PermissivePageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/permissive");
    pageObject = new PermissivePageObject(page);
  });

  test("should display the title", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the npm usage heading", async () => {
    await pageObject.containsTheNpmUsageHeading();
  });

  test("should display the url usage heading", async () => {
    await pageObject.containsTheUrlUsageHeading();
  });

  test("should display the license constraints heading", async () => {
    await pageObject.containsTheLicenseConstraintsHeading();
  });

  test("should display the license list heading", async () => {
    await pageObject.containsTheLicenseListHeading();
  });

  test("should display the permissive config content", async () => {
    await pageObject.containsThePermissiveConfigContent();
  });
});
