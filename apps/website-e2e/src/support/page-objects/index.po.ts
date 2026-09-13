import { Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class IndexPageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);
  hero = () => new IndexHeroComponent(this.page);

  containsTheWhyCheckLicensesHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /why check your licenses\?/i, level: 2 })
    ).toBeVisible();
  };

  containsTheWhyLicenseCopHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /why license-cop\?/i, level: 2 })
    ).toBeVisible();
  };

  containsTheHowToGetStartedHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /how to get started/i, level: 2 })
    ).toBeVisible();
  };

  footer = () => new FooterComponent(this.page);
}

class IndexHeroComponent {
  constructor(private readonly page: Page) {}

  containsTheTitle = async () => {
    await expect(
      this.page.getByRole("heading", { name: "License-Cop", level: 1, exact: true }).first()
    ).toBeVisible();
  };

  containsTheInstallCommand = async () => {
    await expect(this.page.getByText(/npm install license-cop --save-dev/i)).toBeVisible();
  };
}
