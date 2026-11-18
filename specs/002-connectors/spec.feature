Feature: Connectors

  Scenario: list returns the records the connector holds
    Given a memory connector with Ada and Grace
    When the caller lists records
    Then the records are Ada and Grace

  Scenario: create assigns an id
    Given an empty memory connector
    When the caller creates Iris
    Then the result has an id and the name Iris

  Scenario: update replaces the record
    Given a memory connector holding Ada
    When the caller updates her name to Augusta
    Then a later get returns Augusta

  Scenario: a missing record throws ConnectorError
    Given a memory connector holding Ada
    When the caller removes her and gets her again
    Then the get throws ConnectorError

  Scenario: list honors an aborted signal
    Given a memory connector and an aborted signal
    When the caller lists with that signal
    Then the list fails
