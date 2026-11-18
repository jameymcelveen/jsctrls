package com.jsctrls.demo;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(NameController.class)
@Import({NameService.class, InMemoryNameRepository.class, ApiExceptionHandler.class, WebConfig.class})
@TestPropertySource(properties = "demo.delay-ms=0")
class NameControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private InMemoryNameRepository repository;

    @BeforeEach
    void reseed() {
        repository.reseed();
    }

    @Test
    void listsSeededNames() throws Exception {
        mvc.perform(get("/api/names"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].name").value("Ada"))
                .andExpect(jsonPath("$[1].name").value("Grace"))
                .andExpect(jsonPath("$[2].name").value("Katherine"));
    }

    @Test
    void getsOneName() throws Exception {
        mvc.perform(get("/api/names/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("2"))
                .andExpect(jsonPath("$.name").value("Grace"));
    }

    @Test
    void missingGetIsNotFound() throws Exception {
        mvc.perform(get("/api/names/missing"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value("Not Found"))
                .andExpect(jsonPath("$.detail").value("Name not found: missing"));
    }

    @Test
    void createsAName() throws Exception {
        mvc.perform(post("/api/names")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Iris  \"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/names/")))
                .andExpect(jsonPath("$.name").value("Iris"))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    void blankNameIsBadRequest() throws Exception {
        mvc.perform(post("/api/names")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value(containsString("name")));
    }

    @Test
    void oversizedNameIsBadRequest() throws Exception {
        String tooLong = "a".repeat(101);
        mvc.perform(post("/api/names")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("name")));
    }

    @Test
    void updatesAName() throws Exception {
        mvc.perform(patch("/api/names/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Augusta  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.name").value("Augusta"));
    }

    @Test
    void missingUpdateIsNotFound() throws Exception {
        mvc.perform(patch("/api/names/missing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Ada\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Not Found"));
    }

    @Test
    void blankUpdateIsBadRequest() throws Exception {
        mvc.perform(patch("/api/names/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"));
    }

    @Test
    void deletesAName() throws Exception {
        mvc.perform(delete("/api/names/1")).andExpect(status().isNoContent());
        mvc.perform(get("/api/names/1")).andExpect(status().isNotFound());
    }

    @Test
    void missingDeleteIsNotFound() throws Exception {
        mvc.perform(delete("/api/names/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Name not found: missing"));
    }

    @Test
    void allowsTheViteDevOrigin() throws Exception {
        mvc.perform(get("/api/names").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
