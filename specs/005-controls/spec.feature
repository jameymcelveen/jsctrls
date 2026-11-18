Feature: Controls

  Scenario: TextInput reports what the user types
    Given an empty text field
    When the user types Iris
    Then the change handler receives Iris

  Scenario: a disabled Button does not fire
    Given a disabled button
    When the user clicks it
    Then the click handler does not run

  Scenario: ListBox moves the cursor on click and arrow keys
    Given a list box on Ada, Grace, and Katherine
    When the user clicks Grace and presses ArrowDown
    Then Katherine is selected

  Scenario: ListBox shows saving, deleting, and the error
    Given a list box whose save and delete can be held open
    When a save is in flight, then a delete, then a failed delete
    Then the list shows saving, deleting, and the error
