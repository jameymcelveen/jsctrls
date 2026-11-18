namespace Jsctrls.Demo;

/// <summary>In-memory name store. Seeded with three names, sorted by id.</summary>
public sealed class NameRepository
{
  private readonly Lock _gate = new();
  private List<ApiName> _names = Seed();

  /// <summary>Restores the three seeded names.</summary>
  public void Reseed()
  {
    lock (_gate)
    {
      _names = Seed();
    }
  }

  /// <summary>All names, ordered by id.</summary>
  public IReadOnlyList<ApiName> List()
  {
    lock (_gate)
    {
      return _names.OrderBy(name => name.Id, StringComparer.Ordinal).ToList();
    }
  }

  /// <summary>The name with this id, or null.</summary>
  public ApiName? Find(string id)
  {
    lock (_gate)
    {
      return _names.FirstOrDefault(name => name.Id == id);
    }
  }

  /// <summary>Inserts a name and returns it.</summary>
  public ApiName Add(ApiName name)
  {
    lock (_gate)
    {
      _names.Add(name);
      return name;
    }
  }

  /// <summary>Replaces the name with this id. Returns false when it is missing.</summary>
  public bool Replace(ApiName name)
  {
    lock (_gate)
    {
      var index = _names.FindIndex(item => item.Id == name.Id);
      if (index < 0)
      {
        return false;
      }

      _names[index] = name;
      return true;
    }
  }

  /// <summary>Removes the name with this id. Returns false when it is missing.</summary>
  public bool Remove(string id)
  {
    lock (_gate)
    {
      var index = _names.FindIndex(item => item.Id == id);
      if (index < 0)
      {
        return false;
      }

      _names.RemoveAt(index);
      return true;
    }
  }

  private static List<ApiName> Seed() =>
  [
    new("1", "Ada"),
    new("2", "Grace"),
    new("3", "Katherine"),
  ];
}
