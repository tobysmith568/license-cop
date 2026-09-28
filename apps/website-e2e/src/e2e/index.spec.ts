import { test } from "@playwright/test";
import { IndexPageObject } from "../support/page-objects/index.po";

test.describe("Index", () => {
  let pageObject: IndexPageObject;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    pageObject = new IndexPageObject(page);
  });

  test("should display the hero title", async () => {
    await pageObject.hero().containsTheTitle();
  });

  test("should display the hero install command", async () => {
    await pageObject.hero().containsTheInstallCommand();
  });

  test("should display the why check licenses heading", async () => {
    await pageObject.containsTheWhyLicenseCopHeading();
  });

  test("should display the why license cop heading", async () => {
    await pageObject.containsTheWhyCheckLicensesHeading();
  });

  test("should display the how to get started heading", async () => {
    await pageObject.containsTheHowToGetStartedHeading();
  });
});
