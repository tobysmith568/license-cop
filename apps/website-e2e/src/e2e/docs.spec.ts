import { test } from "@playwright/test";
import { DocsPageObject } from "../support/page-objects/docs.po";

test.describe("Docs", () => {
  let pageObject: DocsPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/docs");
    pageObject = new DocsPageObject(page);
  });

  test("should display the title", async () => {
    await pageObject.containsTheMainHeading();
  });

  test("should display the setup heading", async () => {
    await pageObject.containsTheSetupHeading();
  });

  test("should display the config file heading", async () => {
    await pageObject.containsTheConfigFileHeading();
  });

  test("should display the GitHub CI/CD heading", async () => {
    await pageObject.containsTheGitHubCiCdHeading();
  });
});
