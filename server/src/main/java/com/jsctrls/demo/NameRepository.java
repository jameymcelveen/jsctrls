package com.jsctrls.demo;

import java.util.List;
import java.util.Optional;

public interface NameRepository {

    List<Name> findAll();

    Optional<Name> findById(String id);

    Name save(Name name);

    void deleteById(String id);
}
