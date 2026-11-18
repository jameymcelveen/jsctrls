Feature: Names API

  Scenario: list returns the seeded names
    Given a fresh server
    When the client lists names
    Then the names are Ada, Grace, and Katherine

  Scenario: get returns one name
    Given the seeded names
    When the client gets id 2
    Then the name is Grace

  Scenario: a missing name is a problem detail
    Given an unknown id
    When the client gets it
    Then the response is a 404 problem for that id

  Scenario: create trims the name and returns a location
    Given the name "  Iris  "
    When the client creates it
    Then the response is 201 with a location and the stored name Iris

  Scenario: a blank name is a bad request
    Given a blank name
    When the client creates it
    Then the response is a 400 problem that mentions name

  Scenario: a name longer than 100 characters is a bad request
    Given a name of 101 characters
    When the client creates it
    Then the response is a 400 problem that mentions name

  Scenario: update trims the name
    Given id 1
    When the client patches "  Augusta  "
    Then the stored name is Augusta

  Scenario: updating a missing name is a problem detail
    Given an unknown id
    When the client patches it
    Then the response is a 404 problem

  Scenario: delete removes the name
    Given id 1
    When the client deletes it
    Then the response is 204 and a later get is 404

  Scenario: deleting a missing name is a problem detail
    Given an unknown id
    When the client deletes it
    Then the response is a 404 problem

  Scenario: the Vite origin is allowed
    Given the origin http://localhost:5173
    When the client lists names
    Then the response allows that origin

  Scenario: the health probe reports UP
    Given a running server
    When the client gets /actuator/health
    Then the status is UP
