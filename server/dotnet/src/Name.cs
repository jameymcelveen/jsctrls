namespace Jsctrls.Demo;

/// <summary>A name stored by the demo API. JSON fields are <c>id</c> and <c>name</c>.</summary>
public sealed record ApiName(string Id, string Name);

/// <summary>JSON body for creating or updating a name.</summary>
public sealed record NameBody(string? Name);
