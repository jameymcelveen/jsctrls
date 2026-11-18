Feature: Workspace scaffold

  Scenario: the library, hello app, and Java server are present
    Given a checkout of this repo
    When the developer looks at the tree
    Then the library, the hello app, and the Java server are present
