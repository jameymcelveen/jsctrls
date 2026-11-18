Feature: Hello app

  Scenario: adds a name and then deletes it
    Given the seeded names
    When the user adds Iris and then deletes it
    Then Iris is gone and Katherine is selected
