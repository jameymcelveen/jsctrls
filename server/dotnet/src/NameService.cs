namespace Jsctrls.Demo;

/// <summary>Name operations for the demo API. Trims values and waits <c>DEMO_DELAY_MS</c>.</summary>
public sealed class NameService(NameRepository names, IConfiguration configuration)
{
  private readonly int _delayMs = configuration.GetValue("DEMO_DELAY_MS", 300);

  /// <summary>Lists every name.</summary>
  public async Task<IReadOnlyList<ApiName>> List(CancellationToken cancellationToken)
  {
    await Pause(cancellationToken);
    return names.List();
  }

  /// <summary>Returns the name, or null when it is missing.</summary>
  public async Task<ApiName?> Find(string id, CancellationToken cancellationToken)
  {
    await Pause(cancellationToken);
    return names.Find(id);
  }

  /// <summary>Stores a trimmed name under a new id.</summary>
  public async Task<ApiName> Create(string name, CancellationToken cancellationToken)
  {
    await Pause(cancellationToken);
    return names.Add(new ApiName(Guid.NewGuid().ToString(), name.Trim()));
  }

  /// <summary>Replaces a name. Returns null when the id is missing.</summary>
  public async Task<ApiName?> Update(string id, string name, CancellationToken cancellationToken)
  {
    await Pause(cancellationToken);
    var updated = new ApiName(id, name.Trim());
    return names.Replace(updated) ? updated : null;
  }

  /// <summary>Deletes a name. Returns false when the id is missing.</summary>
  public async Task<bool> Delete(string id, CancellationToken cancellationToken)
  {
    await Pause(cancellationToken);
    return names.Remove(id);
  }

  private async Task Pause(CancellationToken cancellationToken)
  {
    if (_delayMs > 0)
    {
      await Task.Delay(_delayMs, cancellationToken);
    }
  }
}
