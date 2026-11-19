Feature: Headless core

  Scenario: the core imports no UI framework
    Given the core package
    When its sources and manifest are read
    Then nothing imports or depends on react or react-dom

  Scenario: the React ListBox runs on the core controller
    Given a React ListBox on Ada, Grace, and Katherine
    When the user clicks Grace and presses ArrowDown
    Then Katherine is selected

  Scenario: jc-listbox runs on the same controller
    Given a jc-listbox on Ada, Grace, and Katherine
    When the user clicks Grace and presses ArrowDown
    Then Katherine is selected

  Scenario: the ListBox meta names its tag and binding
    Given the ListBox meta
    When it is loaded from @jsctrls/core/meta
    Then its tag is jc-listbox and dataSet binds to a DataSet

  Scenario: runtime code reaches no meta file
    Given the runtime entry points of core and react
    When their imports are followed
    Then no meta or design file is reached
