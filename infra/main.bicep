targetScope = 'resourceGroup'

@description('Short environment name, e.g. dev or prod. Used in every resource name.')
@minLength(2)
@maxLength(8)
param environmentName string = 'dev'

@description('Azure region for everything except the Static Web App.')
param location string = resourceGroup().location

@description('Static Web Apps is not available in every region; keep it separate.')
@allowed([
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
])
param staticWebAppLocation string = 'eastus2'

@description('Retention for App Insights data, in days.')
@minValue(30)
@maxValue(730)
param logRetentionDays int = 90

var prefix = 'garage-${environmentName}'
// Storage account names are 3-24 lowercase alphanumeric characters. uniqueString is always 13, so
// this is 18-24 by construction — no truncation, and nothing the length check cannot prove.
var storageName = toLower('gar${environmentName}${uniqueString(resourceGroup().id)}')

// ---------------------------------------------------------------------------
// Telemetry. The funnel in docs/SPEC.md arrives here as custom events.
// ---------------------------------------------------------------------------

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logRetentionDays
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
  }
}

// ---------------------------------------------------------------------------
// Storage. Holds the Functions runtime share plus the designs and leads tables.
// ---------------------------------------------------------------------------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource tables 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// The API creates these on first use, but declaring them means a fresh environment
// is complete before any traffic arrives.
resource designsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tables
  name: 'designs'
}

resource leadsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tables
  name: 'leads'
}

// ---------------------------------------------------------------------------
// API. Azure Functions, .NET 8 isolated, Linux consumption.
// ---------------------------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-api'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      cors: {
        // The Static Web App reaches the API through its linked backend, same origin.
        allowedOrigins: [
          'https://${web.properties.defaultHostname}'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('${prefix}-api-content')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          // Reaching the designs and leads tables. Without this the app refuses to
          // start outside Development rather than losing share links on restart.
          name: 'DesignStorageConnection'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'AZURE_FUNCTIONS_ENVIRONMENT'
          value: environmentName == 'prod' ? 'Production' : 'Staging'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insights.properties.ConnectionString
        }
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Web. Static Web App, with the Function App linked so /api/* is same-origin.
// ---------------------------------------------------------------------------

resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-web'
  location: staticWebAppLocation
  // Standard, not Free: linked backends are a Standard feature, and /api/* has to
  // be same-origin with the page for the cart hand-off to carry the store session.
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
  }
}

resource linkedApi 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: web
  name: 'api'
  properties: {
    backendResourceId: api.id
    region: location
  }
}

output webHostname string = web.properties.defaultHostname
output apiHostname string = api.properties.defaultHostName
output apiName string = api.name
output storageAccountName string = storage.name
output insightsConnectionString string = insights.properties.ConnectionString
output resourceGroupName string = resourceGroup().name
