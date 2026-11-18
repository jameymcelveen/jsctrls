package com.jsctrls.demo;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;

@Repository
public class InMemoryNameRepository implements NameRepository {

    private final ConcurrentHashMap<String, Name> names = new ConcurrentHashMap<>();

    public InMemoryNameRepository() {
        reseed();
    }

    public void reseed() {
        names.clear();
        names.put("1", new Name("1", "Ada"));
        names.put("2", new Name("2", "Grace"));
        names.put("3", new Name("3", "Katherine"));
    }

    @Override
    public List<Name> findAll() {
        return names.values().stream().sorted(Comparator.comparing(Name::id)).toList();
    }

    @Override
    public Optional<Name> findById(String id) {
        return Optional.ofNullable(names.get(id));
    }

    @Override
    public Name save(Name name) {
        names.put(name.id(), name);
        return name;
    }

    @Override
    public void deleteById(String id) {
        names.remove(id);
    }
}
