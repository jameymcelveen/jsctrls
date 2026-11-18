using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jsctrls.Demo;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Jsctrls.Demo.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
  protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
  {
    builder.ConfigureAppConfiguration((_, config) =>
    {
      config.AddInMemoryCollection(new Dictionary<string, string?>
      {
        ["DEMO_DELAY_MS"] = "0",
      });
    });
  }
}

public sealed class NamesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
  private HttpClient Client()
  {
    factory.Services.GetRequiredService<NameRepository>().Reseed();
    return factory.CreateClient();
  }

  [Fact(DisplayName = "list returns the seeded names")]
  public async Task ListReturnsTheSeededNames()
  {
    using var client = Client();
    var names = await client.GetFromJsonAsync<ApiName[]>("/api/names");
    names.ShouldNotBeNull();
    names.Select(name => name.Name).ShouldBe(["Ada", "Grace", "Katherine"]);
  }

  [Fact(DisplayName = "get returns one name")]
  public async Task GetReturnsOneName()
  {
    using var client = Client();
    var name = await client.GetFromJsonAsync<ApiName>("/api/names/2");
    name.ShouldNotBeNull();
    name.Id.ShouldBe("2");
    name.Name.ShouldBe("Grace");
  }

  [Fact(DisplayName = "a missing name is a problem detail")]
  public async Task MissingGetIsProblemDetail()
  {
    using var client = Client();
    var response = await client.GetAsync("/api/names/missing");
    await AssertProblem(response, HttpStatusCode.NotFound, "Not Found", "Name not found: missing");
  }

  [Fact(DisplayName = "create trims the name and returns a location")]
  public async Task CreateTrimsTheName()
  {
    using var client = Client();
    var response = await client.PostAsJsonAsync("/api/names", new { name = "  Iris  " });
    response.StatusCode.ShouldBe(HttpStatusCode.Created);
    response.Headers.Location.ShouldNotBeNull();
    response.Headers.Location.ToString().ShouldContain("/api/names/");
    var created = await response.Content.ReadFromJsonAsync<ApiName>();
    created.ShouldNotBeNull();
    created.Name.ShouldBe("Iris");
    created.Id.ShouldNotBeNullOrWhiteSpace();
  }

  [Fact(DisplayName = "a blank name is a bad request")]
  public async Task BlankNameIsBadRequest()
  {
    using var client = Client();
    var response = await client.PostAsJsonAsync("/api/names", new { name = "   " });
    await AssertProblem(response, HttpStatusCode.BadRequest, "Bad Request", "name");
  }

  [Fact(DisplayName = "a name longer than 100 characters is a bad request")]
  public async Task OversizedNameIsBadRequest()
  {
    using var client = Client();
    var response = await client.PostAsJsonAsync("/api/names", new { name = new string('a', 101) });
    await AssertProblem(response, HttpStatusCode.BadRequest, "Bad Request", "name");
  }

  [Fact(DisplayName = "update trims the name")]
  public async Task UpdateTrimsTheName()
  {
    using var client = Client();
    var response = await client.PatchAsJsonAsync("/api/names/1", new { name = "  Augusta  " });
    response.StatusCode.ShouldBe(HttpStatusCode.OK);
    var updated = await response.Content.ReadFromJsonAsync<ApiName>();
    updated.ShouldNotBeNull();
    updated.Id.ShouldBe("1");
    updated.Name.ShouldBe("Augusta");
  }

  [Fact(DisplayName = "updating a missing name is a problem detail")]
  public async Task MissingUpdateIsProblemDetail()
  {
    using var client = Client();
    var response = await client.PatchAsJsonAsync("/api/names/missing", new { name = "Ada" });
    await AssertProblem(response, HttpStatusCode.NotFound, "Not Found", "Name not found: missing");
  }

  [Fact(DisplayName = "delete removes the name")]
  public async Task DeleteRemovesTheName()
  {
    using var client = Client();
    var deleted = await client.DeleteAsync("/api/names/1");
    deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    var missing = await client.GetAsync("/api/names/1");
    missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
  }

  [Fact(DisplayName = "deleting a missing name is a problem detail")]
  public async Task MissingDeleteIsProblemDetail()
  {
    using var client = Client();
    var response = await client.DeleteAsync("/api/names/missing");
    await AssertProblem(response, HttpStatusCode.NotFound, "Not Found", "Name not found: missing");
  }

  [Fact(DisplayName = "the Vite origin is allowed")]
  public async Task ViteOriginIsAllowed()
  {
    using var client = Client();
    var request = new HttpRequestMessage(HttpMethod.Get, "/api/names");
    request.Headers.Add("Origin", "http://localhost:5173");
    var response = await client.SendAsync(request);
    response.StatusCode.ShouldBe(HttpStatusCode.OK);
    response.Headers.GetValues("Access-Control-Allow-Origin").ShouldContain("http://localhost:5173");
  }

  [Fact(DisplayName = "the health probe reports UP")]
  public async Task HealthProbeReportsUp()
  {
    using var client = Client();
    var body = await client.GetFromJsonAsync<JsonElement>("/actuator/health");
    body.GetProperty("status").GetString().ShouldBe("UP");
  }

  private static async Task AssertProblem(
    HttpResponseMessage response,
    HttpStatusCode status,
    string title,
    string detailContains)
  {
    response.StatusCode.ShouldBe(status);
    response.Content.Headers.ContentType?.MediaType.ShouldBe("application/problem+json");
    var body = await response.Content.ReadFromJsonAsync<JsonElement>();
    body.GetProperty("title").GetString().ShouldBe(title);
    var detail = body.GetProperty("detail").GetString();
    detail.ShouldNotBeNull();
    detail.ShouldContain(detailContains);
  }
}
