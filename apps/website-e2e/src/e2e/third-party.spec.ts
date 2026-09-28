import { test } from "@playwright/test";
import { ThirdPartyPageObject } from "../support/page-objects/third-party.po";

test.describe("ThirdParty", () => {
  let pageObject: ThirdPartyPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/third-party");
    pageObject = new ThirdPartyPageObject(page);
  });

  test("should display the main heading", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the Sources heading", async () => {
    await pageObject.containsTheSourcesHeading();
  });

  test("should display the Licenses heading", async () => {
    await pageObject.containsTheLicensesHeading();
  });

  test("should display the generate-license-file content", async () => {
    await pageObject.containsTheGenerateLicenseFileContent();
  });
});
