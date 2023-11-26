import { DocsPageObject } from "../support/page-objects/docs.po";

describe("Docs", () => {
  let pageObject: DocsPageObject;

  beforeEach(() => {
    cy.visit("/docs");
    pageObject = new DocsPageObject();
  });

  it("should display the title", () => {
    pageObject.containsTheMainHeading();
  });

  it("should display the setup heading", () => {
    pageObject.containsTheSetupHeading();
  });

  it("should display the config file heading", () => {
    pageObject.containsTheConfigFileHeading();
  });

  it("should display the GitHub CI/CD heading", () => {
    pageObject.containsTheGitHubCiCdHeading();
  });
});
