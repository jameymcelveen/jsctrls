package com.jsctrls.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NameServiceTest {

    private InMemoryNameRepository repository;
    private NameService names;

    @BeforeEach
    void setUp() {
        repository = new InMemoryNameRepository();
        names = new NameService(repository, 0);
    }

    @Test
    void createTrimsTheNameAndAssignsAnId() {
        Name created = names.create("  Ada Lovelace  ");

        assertThat(created.id()).isNotBlank();
        assertThat(created.name()).isEqualTo("Ada Lovelace");
        assertThat(names.get(created.id()).name()).isEqualTo("Ada Lovelace");
    }

    @Test
    void updateTrimsTheName() {
        Name updated = names.update("1", "  Augusta  ");

        assertThat(updated).isEqualTo(new Name("1", "Augusta"));
    }

    @Test
    void missingIdFailsOnGetUpdateAndDelete() {
        assertThatThrownBy(() -> names.get("missing")).isInstanceOf(NameNotFoundException.class);
        assertThatThrownBy(() -> names.update("missing", "Ada")).isInstanceOf(NameNotFoundException.class);
        assertThatThrownBy(() -> names.delete("missing")).isInstanceOf(NameNotFoundException.class);
        assertThat(repository.findById("1")).isPresent();
    }
}
