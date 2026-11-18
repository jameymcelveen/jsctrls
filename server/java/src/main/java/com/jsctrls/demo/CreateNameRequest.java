package com.jsctrls.demo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNameRequest(@NotBlank @Size(max = 100) String name) {
}
