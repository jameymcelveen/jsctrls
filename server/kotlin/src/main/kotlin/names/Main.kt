package names

import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty

fun main() {
    val port = System.getenv("SERVER_PORT")?.toIntOrNull() ?: 8081
    val delayMs = System.getenv("DEMO_DELAY_MS")?.toLongOrNull() ?: 300
    embeddedServer(Netty, port = port, host = "0.0.0.0") { namesApi(delayMs = delayMs) }.start(wait = true)
}
