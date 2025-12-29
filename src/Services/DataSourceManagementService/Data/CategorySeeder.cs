using DataProcessing.Shared.Entities;
using MongoDB.Entities;

namespace DataProcessing.DataSourceManagement.Data;

/// <summary>
/// Seeds default datasource categories in the database
/// </summary>
public static class CategorySeeder
{
    /// <summary>
    /// Seed default categories if they don't exist
    /// Migrates existing category values from datasources first
    /// </summary>
    public static async Task SeedDefaultCategoriesAsync(ILogger logger)
    {
        try
        {
            // Check if categories already exist
            var existingCount = await DB.CountAsync<DataSourceCategory>();
            if (existingCount > 0)
            {
                logger.LogInformation("קטגוריות כבר קיימות במערכת ({Count} קטגוריות), דילוג על seeding", existingCount);
                return;
            }

            logger.LogInformation("מתחיל תהליך seeding קטגוריות...");

            // STEP 1: Migrate existing category values from datasources
            var datasources = await DB.Find<DataProcessingDataSource, DataProcessingDataSource>()
                .Match(ds => ds.Category != null && ds.Category != string.Empty)
                .ExecuteAsync();

            var uniqueCategories = datasources
                .Select(ds => ds.Category)
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct()
                .ToList();

            if (uniqueCategories.Any())
            {
                logger.LogInformation("נמצאו {Count} קטגוריות ייחודיות ב-datasources קיימים, מייבא...", uniqueCategories.Count);

                var migratedCategories = new List<DataSourceCategory>();
                int sortOrder = 1;

                foreach (var categoryName in uniqueCategories.OrderBy(c => c))
                {
                    migratedCategories.Add(new DataSourceCategory
                    {
                        Name = categoryName,
                        NameEn = categoryName, // Will need manual translation by admin
                        Description = "קטגוריה שהועברה אוטומטית ממקורות נתונים קיימים",
                        SortOrder = sortOrder++,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        CreatedBy = "System Migration"
                    });
                }

                await DB.SaveAsync(migratedCategories);
                logger.LogInformation("✅ {Count} קטגוריות הועברו מ-datasources קיימים", migratedCategories.Count);

                // Don't add defaults if we migrated existing categories
                return;
            }

            // STEP 2: If no existing datasources, create default categories
            logger.LogInformation("לא נמצאו datasources קיימים, יוצר קטגוריות ברירת מחדל...");

            var defaultCategories = new List<DataSourceCategory>
            {
                new DataSourceCategory
                {
                    Name = "מכירות",
                    NameEn = "Sales",
                    Description = "נתוני מכירות ועסקאות",
                    SortOrder = 1,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "כספים",
                    NameEn = "Finance",
                    Description = "נתונים כספיים וחשבונאיים",
                    SortOrder = 2,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "משאבי אנוש",
                    NameEn = "HR",
                    Description = "נתוני עובדים ומשאבי אנוש",
                    SortOrder = 3,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "מלאי",
                    NameEn = "Inventory",
                    Description = "ניהול מלאי ומוצרים",
                    SortOrder = 4,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "שירות לקוחות",
                    NameEn = "Customer Service",
                    Description = "נתוני שירות לקוחות ותמיכה",
                    SortOrder = 5,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "שיווק",
                    NameEn = "Marketing",
                    Description = "נתוני שיווק וקמפיינים",
                    SortOrder = 6,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "לוגיסטיקה",
                    NameEn = "Logistics",
                    Description = "נתוני משלוחים ולוגיסטיקה",
                    SortOrder = 7,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "תפעול",
                    NameEn = "Operations",
                    Description = "נתוני תפעול ותהליכים",
                    SortOrder = 8,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "מחקר ופיתוח",
                    NameEn = "R&D",
                    Description = "נתוני מחקר, פיתוח וחדשנות",
                    SortOrder = 9,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new DataSourceCategory
                {
                    Name = "רכש",
                    NameEn = "Procurement",
                    Description = "נתוני רכש וספקים",
                    SortOrder = 10,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            };

            await DB.SaveAsync(defaultCategories);

            logger.LogInformation("✅ {Count} קטגוריות ברירת מחדל נוצרו בהצלחה", defaultCategories.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ שגיאה ביצירת קטגוריות ברירת מחדל");
            throw;
        }
    }
}
