// OutputConfigurationTemplate.cs - Template for Generating Multi-Destination Output Configs
// Task-22: DemoDataGenerator Enhancement
// Version: 2.0 - Now uses actual output servers and NAS devices
// Date: February 26, 2026

using DataProcessing.Shared.Entities;

namespace DemoDataGenerator.Templates;

/// <summary>
/// Template for generating realistic multi-destination output configurations
/// using actual output servers and NAS devices from the seeded data.
/// </summary>
public static class OutputConfigurationTemplate
{
    /// <summary>
    /// Generate output configuration using actual servers and NAS devices
    /// </summary>
    public static OutputConfiguration Generate(
        string datasourceName,
        string fileType,
        AdminServer? kafkaServer = null,
        NasDevice? outputNas = null,
        AdminServer? ftpServer = null)
    {
        var config = new OutputConfiguration
        {
            DefaultOutputFormat = "original",
            IncludeInvalidRecords = false,
            Destinations = new List<OutputDestination>()
        };

        // Destination 1: Real-time Kafka topic (always JSON)
        if (kafkaServer != null)
        {
            config.Destinations.Add(new OutputDestination
            {
                Name = "Real-Time Analytics",
                Type = "kafka",
                Enabled = true,
                OutputFormat = "json",
                OutputServerId = kafkaServer.ID,
                KafkaConfig = new KafkaOutputConfig
                {
                    Topic = $"{datasourceName.ToLower().Replace(" ", "-")}-validated",
                    BrokerServer = kafkaServer.KafkaConfig?.BootstrapServers ?? "kafka:9092",
                    MessageKey = "{filename}_{timestamp}",
                    Headers = new Dictionary<string, string>
                    {
                        ["source"] = datasourceName,
                        ["server"] = kafkaServer.Name,
                        ["environment"] = "development"
                    }
                }
            });
        }

        // Destination 2: Output NAS folder (original format)
        if (outputNas != null)
        {
            config.Destinations.Add(new OutputDestination
            {
                Name = "NAS Archive",
                Type = "nas",
                Enabled = true,
                OutputServerId = outputNas.ID,
                FolderConfig = new FolderOutputConfig
                {
                    Path = $"{outputNas.MountPath}/archive/{datasourceName.Replace(" ", "")}",
                    FileNamePattern = "{filename}_{date}_valid.{ext}",
                    CreateSubfolders = true,
                    SubfolderPattern = "{year}/{month}/{day}",
                    OverwriteExisting = false
                }
            });
        }
        else
        {
            // Fallback to local folder if no NAS
            config.Destinations.Add(new OutputDestination
            {
                Name = "Local Archive",
                Type = "folder",
                Enabled = true,
                FolderConfig = new FolderOutputConfig
                {
                    Path = $"/data/output/archive/{datasourceName.Replace(" ", "")}",
                    FileNamePattern = "{filename}_{date}_valid.{ext}",
                    CreateSubfolders = true,
                    SubfolderPattern = "{year}/{month}/{day}",
                    OverwriteExisting = false
                }
            });
        }

        // Destination 3: FTP/SFTP export (CSV for partners)
        if (ftpServer != null && fileType != "CSV")
        {
            config.Destinations.Add(new OutputDestination
            {
                Name = "Partner Export",
                Type = ftpServer.ServerType,
                Enabled = true,
                OutputFormat = "csv",
                OutputServerId = ftpServer.ID,
                FolderConfig = new FolderOutputConfig
                {
                    Path = $"{ftpServer.BasePath ?? "/export"}/{datasourceName.Replace(" ", "")}",
                    FileNamePattern = "export_{date}.csv",
                    OverwriteExisting = true
                }
            });
        }

        return config;
    }

    /// <summary>
    /// Generate specific configurations for different scenarios
    /// </summary>
    public static class Scenarios
    {
        /// <summary>
        /// Banking scenario: High-compliance with multiple audit destinations
        /// </summary>
        public static OutputConfiguration BankingCompliance(
            string datasourceName,
            AdminServer? kafkaServer = null,
            NasDevice? outputNas = null,
            NasDevice? backupNas = null)
        {
            var config = new OutputConfiguration
            {
                DefaultOutputFormat = "original",
                IncludeInvalidRecords = false,
                Destinations = new List<OutputDestination>()
            };

            // Real-time fraud detection (Kafka)
            if (kafkaServer != null)
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Fraud Detection System",
                    Type = "kafka",
                    Enabled = true,
                    OutputFormat = "json",
                    OutputServerId = kafkaServer.ID,
                    KafkaConfig = new KafkaOutputConfig
                    {
                        Topic = "fraud-detection-input",
                        BrokerServer = kafkaServer.KafkaConfig?.BootstrapServers ?? "kafka:9092",
                        MessageKey = "{datasource}_{timestamp}",
                        Headers = new Dictionary<string, string>
                        {
                            ["priority"] = "high",
                            ["system"] = "fraud",
                            ["server"] = kafkaServer.Name
                        }
                    }
                });

                // Audit log (Kafka with all records)
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Audit Log",
                    Type = "kafka",
                    Enabled = true,
                    OutputFormat = "json",
                    IncludeInvalidRecords = true,
                    OutputServerId = kafkaServer.ID,
                    KafkaConfig = new KafkaOutputConfig
                    {
                        Topic = "audit-log-all-records",
                        BrokerServer = kafkaServer.KafkaConfig?.BootstrapServers ?? "kafka:9092",
                        Headers = new Dictionary<string, string>
                        {
                            ["record-type"] = "validated-and-invalid"
                        }
                    }
                });
            }

            // Regulatory archive (Output NAS - 7 years retention)
            if (outputNas != null)
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Regulatory Archive",
                    Type = "nas",
                    Enabled = true,
                    OutputServerId = outputNas.ID,
                    FolderConfig = new FolderOutputConfig
                    {
                        Path = $"{outputNas.MountPath}/compliance/banking/transactions",
                        FileNamePattern = "{filename}_{timestamp}_validated.{ext}",
                        CreateSubfolders = true,
                        SubfolderPattern = "{year}/{month}",
                        OverwriteExisting = false
                    }
                });
            }

            // Backup NAS for disaster recovery
            if (backupNas != null)
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Disaster Recovery Backup",
                    Type = "nas",
                    Enabled = true,
                    OutputServerId = backupNas.ID,
                    FolderConfig = new FolderOutputConfig
                    {
                        Path = $"{backupNas.MountPath}/banking/{datasourceName.Replace(" ", "")}",
                        FileNamePattern = "{filename}_{timestamp}_backup.{ext}",
                        CreateSubfolders = true,
                        SubfolderPattern = "{year}/{month}/{day}",
                        OverwriteExisting = false
                    }
                });
            }

            return config;
        }

        /// <summary>
        /// Simple scenario: Basic Kafka + NAS Archive
        /// </summary>
        public static OutputConfiguration Simple(
            string datasourceName,
            AdminServer? kafkaServer = null,
            NasDevice? outputNas = null)
        {
            var config = new OutputConfiguration
            {
                DefaultOutputFormat = "original",
                Destinations = new List<OutputDestination>()
            };

            // Primary Kafka Topic
            if (kafkaServer != null)
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Primary Kafka Topic",
                    Type = "kafka",
                    Enabled = true,
                    OutputServerId = kafkaServer.ID,
                    KafkaConfig = new KafkaOutputConfig
                    {
                        Topic = $"{datasourceName.ToLower().Replace(" ", "-")}-validated",
                        BrokerServer = kafkaServer.KafkaConfig?.BootstrapServers ?? "kafka:9092"
                    }
                });
            }

            // Backup Archive (NAS or local)
            if (outputNas != null)
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "NAS Backup",
                    Type = "nas",
                    Enabled = true,
                    OutputServerId = outputNas.ID,
                    FolderConfig = new FolderOutputConfig
                    {
                        Path = $"{outputNas.MountPath}/backup/{datasourceName.Replace(" ", "")}"
                    }
                });
            }
            else
            {
                config.Destinations.Add(new OutputDestination
                {
                    Name = "Local Backup",
                    Type = "folder",
                    Enabled = true,
                    FolderConfig = new FolderOutputConfig
                    {
                        Path = $"/data/output/archive/{datasourceName.Replace(" ", "")}"
                    }
                });
            }

            return config;
        }
    }
}
