using Jsctrls.Demo;

var builder = WebApplication.CreateBuilder(args);

var port = builder.Configuration["SERVER_PORT"];
if (!string.IsNullOrWhiteSpace(port))
{
  builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddSingleton<NameRepository>();
builder.Services.AddSingleton<NameService>();
builder.Services.AddCors(options =>
{
  options.AddDefaultPolicy(policy =>
  {
    policy
      .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
      .WithMethods("GET", "POST", "PATCH", "DELETE");
  });
});

var app = builder.Build();
app.UseCors();

app.MapGet("/actuator/health", () => Results.Ok(new { status = "UP" }));

app.MapGet("/api/names", async (NameService names, CancellationToken cancellationToken) =>
  Results.Ok(await names.List(cancellationToken)));

app.MapGet("/api/names/{id}", async (string id, NameService names, CancellationToken cancellationToken) =>
{
  var found = await names.Find(id, cancellationToken);
  return found is null ? NotFoundName(id) : Results.Ok(found);
});

app.MapPost(
  "/api/names",
  async (NameBody? body, NameService names, HttpRequest request, CancellationToken cancellationToken) =>
  {
    var raw = body?.Name;
    var rejected = RejectName(raw);
    if (rejected is not null || raw is null)
    {
      return rejected ?? BlankName();
    }

    var created = await names.Create(raw, cancellationToken);
    var location = $"{request.Scheme}://{request.Host}/api/names/{created.Id}";
    return Results.Created(location, created);
  });

app.MapPatch("/api/names/{id}", async (string id, NameBody? body, NameService names, CancellationToken cancellationToken) =>
{
  var raw = body?.Name;
  var rejected = RejectName(raw);
  if (rejected is not null || raw is null)
  {
    return rejected ?? BlankName();
  }

  var updated = await names.Update(id, raw, cancellationToken);
  return updated is null ? NotFoundName(id) : Results.Ok(updated);
});

app.MapDelete("/api/names/{id}", async (string id, NameService names, CancellationToken cancellationToken) =>
{
  var removed = await names.Delete(id, cancellationToken);
  return removed ? Results.NoContent() : NotFoundName(id);
});

app.Run();

static IResult? RejectName(string? name)
{
  if (name is { Length: > 100 })
  {
    return Results.Problem(
      detail: "name: size must be between 0 and 100",
      statusCode: StatusCodes.Status400BadRequest,
      title: "Bad Request");
  }

  if (string.IsNullOrWhiteSpace(name))
  {
    return BlankName();
  }

  return null;
}

static IResult BlankName() =>
  Results.Problem(
    detail: "name: must not be blank",
    statusCode: StatusCodes.Status400BadRequest,
    title: "Bad Request");

static IResult NotFoundName(string id) =>
  Results.Problem(
    detail: $"Name not found: {id}",
    statusCode: StatusCodes.Status404NotFound,
    title: "Not Found");

/// <summary>Entry point for the demo API and its tests.</summary>
public partial class Program;
