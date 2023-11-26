import { IndexPageObject } from "../support/page-objects/index.po";

describe("Index", () => {
  let pageObject: IndexPageObject;

  beforeEach(() => {
    cy.visit("/");
    pageObject = new IndexPageObject();
  });

  it("should display the hero title", () => {
    pageObject.hero().containsTheTitle();
  });

  it("should display the hero install command", () => {
    pageObject.hero().containsTheInstallCommand();
  });

  it("should display the why check licenses heading", () => {
    pageObject.containsTheWhyLicenseCopHeading();
  });

  it("should display the why license cop heading", () => {
    pageObject.containsTheWhyCheckLicensesHeading();
  });

  it("should display the how to get started heading", () => {
    pageObject.containsTheHowToGetStartedHeading();
  });
});
