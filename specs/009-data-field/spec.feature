Feature: DataField

  Scenario: the field shows the current row
    Given the current row Ada
    When the field renders
    Then it shows Ada

  Scenario: typing updates the pending value
    Given an open dataset on Ada
    When the user types Augusta
    Then the dataset is editing and the pending name is Augusta

  Scenario: post saves the edited value
    Given the user has typed Augusta
    When the dataset posts
    Then the stored name is Augusta

  Scenario: cancel restores the value
    Given the user has typed Augusta
    When the dataset cancels
    Then the field shows Ada again
