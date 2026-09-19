import { type Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class DocsPageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);

  containsTheMainHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /documentation/i, level: 1 })
    ).toBeVisible();
  };

  containsTheSetupHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /setup/i, level: 2 })).toBeVisible();
  };

  containsTheConfigFileHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /config file/i, level: 2 })).toBeVisible();
  };

  containsTheGitHubCiCdHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /ci\/cd example \(github actions\)/i, level: 2 })
    ).toBeVisible();
  };

  footer = () => new FooterComponent(this.page);
}
