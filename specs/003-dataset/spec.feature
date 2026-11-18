Feature: DataSet

  Scenario: open selects the first row
    Given a dataset with Ada and Grace
    When the caller opens it
    Then the state is browse and Ada is current

  Scenario: locate moves the cursor
    Given an open dataset with Ada and Grace
    When the caller locates Grace
    Then Grace is current

  Scenario: append posts a row and selects it
    Given an open dataset with Ada
    When the caller appends Iris
    Then Iris is current and stored

  Scenario: a failed post keeps the pending input
    Given a dataset whose create fails
    When the caller appends Iris
    Then the set is inserting and the pending name is Iris

  Scenario: delete selects the next row
    Given an open dataset with Ada, Grace, and Katherine and Grace current
    When the caller deletes
    Then Katherine is current and Grace is gone

  Scenario: delete selects the previous row when the last row is deleted
    Given an open dataset with Ada, Grace, and Katherine and Katherine current
    When the caller deletes
    Then Grace is current and Katherine is gone

  Scenario: a failed delete keeps the row
    Given a dataset whose remove fails
    When the caller deletes the current row
    Then the row remains and the error is set

  Scenario: a second post while posting throws
    Given a post that has not finished
    When the caller posts again
    Then the second post throws DataSetError
