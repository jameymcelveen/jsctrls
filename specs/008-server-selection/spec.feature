Feature: Server selection

  Scenario: compose defaults to the java server
    Given the Compose file and no SERVER variable
    When Compose resolves the API image
    Then the build context is ./server/java

  Scenario: the makefile accepts java, dotnet, go, and node
    Given the Makefile
    When the developer sets SERVER
    Then java, dotnet, go, and node are accepted and go and node fail until implemented
