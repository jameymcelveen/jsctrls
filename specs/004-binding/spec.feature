Feature: Binding

  Scenario: a subscriber re-renders when the cursor moves
    Given a rendered probe showing the current name Ada
    When the cursor moves to Grace
    Then the probe shows Grace
