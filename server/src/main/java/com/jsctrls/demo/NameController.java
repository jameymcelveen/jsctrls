package com.jsctrls.demo;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/names")
public class NameController {

    private final NameService names;

    public NameController(NameService names) {
        this.names = names;
    }

    @GetMapping
    public List<Name> list() {
        return names.list();
    }

    @GetMapping("/{id}")
    public Name get(@PathVariable String id) {
        return names.get(id);
    }

    @PostMapping
    public ResponseEntity<Name> create(
            @Valid @RequestBody CreateNameRequest request, UriComponentsBuilder uriBuilder) {
        Name created = names.create(request.name());
        URI location = uriBuilder.path("/api/names/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PatchMapping("/{id}")
    public Name update(@PathVariable String id, @Valid @RequestBody UpdateNameRequest request) {
        return names.update(id, request.name());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        names.delete(id);
        return ResponseEntity.noContent().build();
    }
}
