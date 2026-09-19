import { type Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class PrivacyPageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);

  containsTheMainHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /privacy policy/i, level: 1 })
    ).toBeVisible();
  };

  containsTheContactUsHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /contact us/i, level: 2 })).toBeVisible();
  };

  footer = () => new FooterComponent(this.page);
}
