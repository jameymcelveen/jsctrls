package names

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ApiTest {
    private fun api(block: suspend ApplicationTestBuilder.() -> Unit) = testApplication {
        application { namesApi(delayMs = 0) }
        block()
    }

    @Test
    fun `lists the seeded names in id order`() = api {
        val response = client.get("/api/names")
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(
            """[{"id":"1","name":"Ada"},{"id":"2","name":"Grace"},{"id":"3","name":"Katherine"}]""",
            response.bodyAsText(),
        )
    }

    @Test
    fun `creates a trimmed name with a location`() = api {
        val response = client.post("/api/names") {
            contentType(ContentType.Application.Json)
            setBody("""{"name":"  Iris  "}""")
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/api/names/4", response.headers[HttpHeaders.Location])
        assertEquals("""{"id":"4","name":"Iris"}""", response.bodyAsText())
    }

    @Test
    fun `invalid names are 400 problems`() = api {
        val tooLong = """{"name":"${"a".repeat(101)}"}"""
        for (body in listOf("""{"name":"   "}""", "{}", "not json", """{"name":7}""", tooLong)) {
            val response = client.post("/api/names") {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            assertEquals(HttpStatusCode.BadRequest, response.status, body)
            assertTrue(response.headers[HttpHeaders.ContentType]!!.startsWith("application/problem+json"))
        }
    }

    @Test
    fun `missing ids are 404 problems`() = api {
        val responses = listOf(
            client.get("/api/names/missing"),
            client.patch("/api/names/missing") { setBody("""{"name":"Ada"}""") },
            client.delete("/api/names/missing"),
        )
        for (response in responses) {
            assertEquals(HttpStatusCode.NotFound, response.status)
            val detail = Json.parseToJsonElement(response.bodyAsText()).jsonObject["detail"]!!.jsonPrimitive.content
            assertEquals("Name not found: missing", detail)
        }
    }

    @Test
    fun `ids sort numerically`() = api {
        repeat(7) { client.post("/api/names") { setBody("""{"name":"x"}""") } }
        val names = Json.parseToJsonElement(client.get("/api/names").bodyAsText()).jsonArray
        assertEquals("10", names.last().jsonObject["id"]!!.jsonPrimitive.content)
    }

    @Test
    fun `the vite origin is allowed`() = api {
        val response = client.get("/api/names") { header(HttpHeaders.Origin, "http://localhost:5173") }
        assertEquals("http://localhost:5173", response.headers[HttpHeaders.AccessControlAllowOrigin])
    }
}
