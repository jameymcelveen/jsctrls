package com.jsctrls.demo;

public class NameNotFoundException extends RuntimeException {

    public NameNotFoundException(String id) {
        super("Name not found: " + id);
    }
}
