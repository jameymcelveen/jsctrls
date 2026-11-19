Feature: DataNavigator

  Scenario: next moves to the second row
    Given an open dataset on the first row
    When the user clicks next
    Then the second row is current

  Scenario: cancel clears a pending insert
    Given a pending insert
    When the user clicks cancel
    Then the pending value is cleared

  Scenario: illegal buttons are disabled
    Given an open dataset on the first row
    When the navigator renders
    Then First and Post are disabled, and Next is disabled during an insert
