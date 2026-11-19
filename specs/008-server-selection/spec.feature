Feature: Server selection

  Scenario: compose defaults to the java server
    Given the Compose file and no SERVER variable
    When Compose resolves the API image
    Then the build context is ./server/java

  Scenario: the makefile runs any implemented server
    Given the Makefile and the server folders
    When the developer sets SERVER
    Then every implemented server has serve.sh, test.sh, build.sh and a Dockerfile, and the others fail with a clear message
