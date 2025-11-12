using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

namespace DataProcessing.Shared.Converters;

/// <summary>
/// Converts XML format to JSON
/// </summary>
public class XmlToJsonConverter : IFormatConverter
{
    private readonly ILogger<XmlToJsonConverter> _logger;

    public string SourceFormat => "xml";

    public XmlToJsonConverter(ILogger<XmlToJsonConverter> logger)
    {
        _logger = logger;
    }

    public async Task<string> ConvertToJsonAsync(
        Stream sourceStream,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(sourceStream);
            var xmlContent = await reader.ReadToEndAsync(cancellationToken);
            
            var xDoc = XDocument.Parse(xmlContent);
            var jsonObj = XmlToJsonObject(xDoc.Root!);
            
            return JsonSerializer.Serialize(jsonObj);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error converting XML to JSON");
            throw;
        }
    }

    public async Task<bool> IsValidFormatAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(stream, leaveOpen: true);
            var content = await reader.ReadToEndAsync(cancellationToken);
            stream.Position = 0;
            
            XDocument.Parse(content);
            return true;
        }
        catch
        {
            stream.Position = 0;
            return false;
        }
    }

    public async Task<Dictionary<string, object>> ExtractMetadataAsync(
        Stream sourceStream,
        CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(sourceStream, leaveOpen: true);
        var content = await reader.ReadToEndAsync(cancellationToken);
        sourceStream.Position = 0;
        
        var xDoc = XDocument.Parse(content);
        
        return new Dictionary<string, object>
        {
            ["RootElement"] = xDoc.Root?.Name.LocalName ?? "",
            ["Encoding"] = "UTF-8",
            ["HasNamespace"] = !string.IsNullOrEmpty(xDoc.Root?.Name.NamespaceName)
        };
    }

    private static object XmlToJsonObject(XElement element)
    {
        if (element.HasElements)
        {
            var dict = new Dictionary<string, object>();
            foreach (var child in element.Elements())
            {
                var key = child.Name.LocalName;
                var value = XmlToJsonObject(child);
                
                if (dict.ContainsKey(key))
                {
                    if (dict[key] is not List<object> list)
                    {
                        list = new List<object> { dict[key] };
                        dict[key] = list;
                    }
                    list.Add(value);
                }
                else
                {
                    dict[key] = value;
                }
            }
            return dict;
        }
        return element.Value;
    }
}
