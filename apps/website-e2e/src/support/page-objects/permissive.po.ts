import { Page, expect } from "@playwright/test";
import { FooterComponent } from "./components/footer";
import { HeaderComponent } from "./components/header";

export class PermissivePageObject {
  constructor(private readonly page: Page) {}

  header = () => new HeaderComponent(this.page);

  containsTheMainHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /@license-cop\/permissive/i, level: 1 })
    ).toBeVisible();
  };

  containsTheNpmUsageHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /usage \(npm\)/i, level: 2 })
    ).toBeVisible();
  };

  containsTheUrlUsageHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /usage \(url\)/i, level: 2 })
    ).toBeVisible();
  };

  containsTheLicenseConstraintsHeading = async () => {
    await expect(
      this.page.getByRole("heading", { name: /license constraints/i, level: 2 })
    ).toBeVisible();
  };

  containsTheLicenseListHeading = async () => {
    await expect(this.page.getByRole("heading", { name: /license list/i, level: 2 })).toBeVisible();
  };

  containsThePermissiveConfigContent = async () => {
    await expect(this.page.getByText(/\/\/ mit-like/i)).toBeVisible();
    await expect(this.page.getByText(/\/\/ apache/i)).toBeVisible();
    await expect(this.page.getByText(/\/\/ bsd/i)).toBeVisible();
    await expect(this.page.getByText(/\/\/ creative commons/i)).toBeVisible();
    await expect(this.page.getByText(/\/\/ microsoft/i)).toBeVisible();
    await expect(this.page.getByText(/\/\/ other/i)).toBeVisible();
  };

  footer = () => new FooterComponent(this.page);
}
