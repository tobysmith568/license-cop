import { PermissivePageObject } from "../support/page-objects/permissive.po";

describe("Permissive", () => {
  let pageObject: PermissivePageObject;

  beforeEach(() => {
    cy.visit("/permissive");
    pageObject = new PermissivePageObject();
  });

  it("should display the title", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the npm usage heading", () => {
    pageObject.containsTheNpmUsageHeading();
  });

  it("should display the url usage heading", () => {
    pageObject.containsTheUrlUsageHeading();
  });

  it("should display the license constraints heading", () => {
    pageObject.containsTheLicenseConstraintsHeading();
  });

  it("should display the license list heading", () => {
    pageObject.containsTheLicenseListHeading();
  });

  it("should display the permissive config content", () => {
    pageObject.containsThePermissiveConfigContent();
  });
});
