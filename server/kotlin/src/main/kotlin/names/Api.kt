package names

import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.application.install
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.TreeMap

data class Name(val id: String, val name: String) {
    fun toJson(): JsonElement = buildJsonObject {
        put("id", id)
        put("name", name)
    }
}

/** Keyed by the numeric id, so a TreeMap lists in id order with no sort. */
class NameStore {
    private val names = TreeMap<Long, Name>()
    private var nextId = 1L

    init {
        listOf("Ada", "Grace", "Katherine").forEach(::create)
    }

    @Synchronized fun list(): List<Name> = names.values.toList()

    @Synchronized fun get(id: String): Name? = key(id)?.let(names::get)

    @Synchronized fun create(name: String): Name {
        val created = Name((nextId++).toString(), name)
        names[created.id.toLong()] = created
        return created
    }

    @Synchronized fun update(id: String, name: String): Name? {
        val k = key(id) ?: return null
        val found = names[k] ?: return null
        return found.copy(name = name).also { names[k] = it }
    }

    @Synchronized fun delete(id: String): Boolean = key(id)?.let { names.remove(it) } != null

    /** The store key for an id, only when the id is written exactly as we write it. */
    private fun key(id: String): Long? = id.toLongOrNull()?.takeIf { it.toString() == id }
}

/** The jsctrls demo names API (specs/006-names-api). */
fun Application.namesApi(store: NameStore = NameStore(), delayMs: Long = 300) {
    install(CORS) {
        allowHost("localhost:5173")
        allowHost("127.0.0.1:5173")
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
    }

    val demoDelay = createRouteScopedPlugin("DemoDelay") {
        onCall { if (delayMs > 0) delay(delayMs) }
    }

    routing {
        get("/actuator/health") { call.json(buildJsonObject { put("status", "UP") }) }

        route("/api/names") {
            install(demoDelay)

            get { call.json(JsonArray(store.list().map(Name::toJson))) }

            get("/{id}") {
                val id = call.parameters["id"]!!
                store.get(id)?.let { call.json(it.toJson()) } ?: call.notFound(id)
            }

            post {
                val name = readName(call.receiveText()).getOrElse { return@post call.badRequest(it.message!!) }
                val created = store.create(name)
                call.response.header(HttpHeaders.Location, "/api/names/${created.id}")
                call.json(created.toJson(), HttpStatusCode.Created)
            }

            patch("/{id}") {
                val id = call.parameters["id"]!!
                if (store.get(id) == null) return@patch call.notFound(id)
                val name = readName(call.receiveText()).getOrElse { return@patch call.badRequest(it.message!!) }
                store.update(id, name)?.let { call.json(it.toJson()) } ?: call.notFound(id)
            }

            delete("/{id}") {
                val id = call.parameters["id"]!!
                if (store.delete(id)) call.respond(HttpStatusCode.NoContent) else call.notFound(id)
            }
        }
    }
}

/** The trimmed name from a JSON body, or a failure carrying the 400 detail. */
fun readName(body: String): Result<String> {
    val raw = runCatching { Json.parseToJsonElement(body) }.getOrNull()
        .let { it as? JsonObject }
        ?.get("name")
        ?.let { it as? JsonPrimitive }
        ?.takeIf { it.isString }
        ?.jsonPrimitive?.content
        ?: ""
    return when {
        raw.isBlank() -> Result.failure(IllegalArgumentException("name: must not be blank"))
        raw.length > 100 -> Result.failure(IllegalArgumentException("name: size must be between 0 and 100"))
        else -> Result.success(raw.trim())
    }
}

private suspend fun ApplicationCall.json(body: JsonElement, status: HttpStatusCode = HttpStatusCode.OK) =
    respondText(body.toString(), ContentType.Application.Json, status)

/** An RFC 9457 problem detail. */
private suspend fun ApplicationCall.problem(status: HttpStatusCode, detail: String) =
    respondText(
        buildJsonObject {
            put("type", "about:blank")
            put("title", status.description)
            put("status", status.value)
            put("detail", detail)
        }.toString(),
        ContentType.Application.ProblemJson,
        status,
    )

private suspend fun ApplicationCall.badRequest(detail: String) = problem(HttpStatusCode.BadRequest, detail)

private suspend fun ApplicationCall.notFound(id: String) = problem(HttpStatusCode.NotFound, "Name not found: $id")
