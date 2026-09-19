import { type Locator, type Page, expect } from "@playwright/test";

export class HeaderComponent {
  private readonly navigation: Locator;

  constructor(page: Page) {
    this.navigation = page.getByRole("navigation");
  }

  containsAnIndexLink = async () => {
    const link = this.navigation.getByRole("link", { name: "Home", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  };

  containsADocsLink = async () => {
    const link = this.navigation.getByRole("link", { name: "Docs", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/docs");
  };

  containsAPermissiveLink = async () => {
    const link = this.navigation.getByRole("link", {
      name: "@license-cop/permissive",
      exact: true
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/permissive");
  };

  containsAShieldLink = async () => {
    const link = this.navigation.getByRole("link", { name: "Shield", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/shield");
  };

  containsALinkToGitHub = async () => {
    const link = this.navigation.getByRole("link", { name: "GitHub", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://github.com/tobysmith568/license-cop");
    await expect(link).toHaveAttribute("target", "_blank");
  };

  containsALinkToNpm = async () => {
    const link = this.navigation.getByRole("link", { name: "npm", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://npmjs.com/package/license-cop");
    await expect(link).toHaveAttribute("target", "_blank");
  };
}
