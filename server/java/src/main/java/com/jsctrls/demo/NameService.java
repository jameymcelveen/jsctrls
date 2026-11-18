package com.jsctrls.demo;

import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NameService {

    private final NameRepository names;
    private final int delayMs;

    public NameService(NameRepository names, @Value("${demo.delay-ms:300}") int delayMs) {
        this.names = names;
        this.delayMs = delayMs;
    }

    public List<Name> list() {
        pause();
        return names.findAll();
    }

    public Name get(String id) {
        pause();
        return names.findById(id).orElseThrow(() -> new NameNotFoundException(id));
    }

    public Name create(String name) {
        pause();
        return names.save(new Name(UUID.randomUUID().toString(), name.trim()));
    }

    public Name update(String id, String name) {
        pause();
        names.findById(id).orElseThrow(() -> new NameNotFoundException(id));
        return names.save(new Name(id, name.trim()));
    }

    public void delete(String id) {
        pause();
        names.findById(id).orElseThrow(() -> new NameNotFoundException(id));
        names.deleteById(id);
    }

    private void pause() {
        if (delayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting", exception);
        }
    }
}
