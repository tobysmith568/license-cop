import { type Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class ShieldPageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);

  containsTheMainHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /license-cop shield/i, level: 1 })
    ).toBeVisible();
  };

  containsTheBadge = async () => {
    const badge = this.page.getByRole("img", { name: /protected by: license-cop/i });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCount(1);

    const { naturalWidth, naturalHeight } = await badge.evaluate((img: HTMLImageElement) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }));
    expect(naturalWidth).toBeGreaterThan(0);
    expect(naturalHeight).toBeGreaterThan(0);
  };

  containsTheHtmlHeader = async () => {
    await expect(this.page.getByRole("heading", { name: /html/i, level: 2 })).toBeVisible();
  };

  containsTheMarkdownHeader = async () => {
    await expect(this.page.getByRole("heading", { name: /markdown/i, level: 2 })).toBeVisible();
  };

  footer = () => new FooterComponent(this.page);
}
