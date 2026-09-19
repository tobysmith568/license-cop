import { type Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class ThirdPartyPageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);

  containsTheMainHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /third-party content/i, level: 1 })
    ).toBeVisible();
  };

  containsTheSourcesHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /sources/i, level: 2 })).toBeVisible();
  };

  containsTheLicensesHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /licenses/i, level: 2 })).toBeVisible();
  };

  containsTheGenerateLicenseFileContent = async () => {
    const matches = this.page.getByText(
      /the following npm packages may be included in this project:/i
    );
    expect(await matches.count()).toBeGreaterThan(0);
  };

  footer = () => new FooterComponent(this.page);
}
