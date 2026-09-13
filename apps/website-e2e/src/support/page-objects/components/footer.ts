import { Locator, Page, expect } from "@playwright/test";

export class FooterComponent {
  private readonly footer: Locator;

  constructor(page: Page) {
    this.footer = page.getByRole("contentinfo");
  }

  containsAnIndexLink = async () => {
    const link = this.footer.getByRole("link", { name: "Home", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  };

  containsADocsLink = async () => {
    const link = this.footer.getByRole("link", { name: "Docs", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/docs");
  };

  containsAPermissiveLink = async () => {
    const link = this.footer.getByRole("link", { name: "@license-cop/permissive", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/permissive");
  };

  containsAShieldLink = async () => {
    const link = this.footer.getByRole("link", { name: "Shield", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/shield");
  };

  containsALinkToGitHub = async () => {
    const link = this.footer.getByRole("link", { name: "GitHub", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://github.com/tobysmith568/license-cop");
    await expect(link).toHaveAttribute("target", "_blank");
  };

  containsALinkToNpm = async () => {
    const link = this.footer.getByRole("link", { name: "npm", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://npmjs.com/package/license-cop");
    await expect(link).toHaveAttribute("target", "_blank");
  };

  containsALinkToTheTermsAndConditions = async () => {
    const link = this.footer.getByRole("link", { name: "Terms & Conditions", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/terms");
  };

  containsALinkToThePrivacyPolicy = async () => {
    const link = this.footer.getByRole("link", { name: "Privacy Policy", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/privacy");
  };

  containsALinkToTheCookiesPolicy = async () => {
    const link = this.footer.getByRole("link", { name: "Cookies", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/cookies");
  };

  containsALinkToTheThirdPartyContentNotices = async () => {
    const link = this.footer.getByRole("link", { name: "Third-party Content", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/third-party");
  };

  containsALinkToTobySmithDotUk = async () => {
    const link = this.footer.getByRole("link", { name: "Toby Smith", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://tobysmith.uk");
    await expect(link).toHaveAttribute("target", "_blank");
  };
}
