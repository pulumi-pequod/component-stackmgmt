import * as pulumi from "@pulumi/pulumi";

export const setTag = async (stackFqdn: string, tagName: string, tagValue: string) => {
  // This may be the deployments automatically created access token or it may be one that is injected via config/environments
  const pulumiAccessToken = process.env["PULUMI_ACCESS_TOKEN"] || "notokenfound"

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${pulumiAccessToken}`
  };

  // Delete the tag if it exists. Don't worry if it doesn't.
  const deleteTagUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/tags/${tagName}`;
  const deleteResponse = await fetch(deleteTagUrl, {
    method: "DELETE",
    headers,
  })

  // Set the tag.
  const setTagUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/tags`;
  const setResponse = await fetch(setTagUrl, {
      method: "POST",
      body: `{"name":"${tagName}","value":"${tagValue}"}`,
      headers,
  })
  if (!setResponse.ok) {
      let errMessage = "";
      try {
          errMessage = await setResponse.text();
      } catch { }
      throw new Error(`failed to set ${tagName} tag for stack, ${stackFqdn}: ${errMessage}`);
  } 
}

// Get current deployment settings
export const getDeploymentSettings = async (stackFqdn: string) => {
  // This may be the deployments automatically created access token or it may be one that is injected via config/environments
  const pulumiAccessToken = process.env["PULUMI_ACCESS_TOKEN"] || "notokenfound"

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${process.env["PULUMI_ACCESS_TOKEN"]}`
  };
  const stackDeploymentSettingsUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/deployments/settings`;
  const response = await fetch(stackDeploymentSettingsUrl, {
      method: "GET",
      headers,
  })

  if (!response.ok) {
      let errMessage = "";
      try {
          errMessage = await response.text();
      } catch { }
      throw new Error(`failed to get deployment settings for stack, ${stackFqdn}: ${errMessage}`);
  } 

  const deploymentSettings: StackDeploymentSettings = await response.json();
  return deploymentSettings
}

// Deployment Settings API Related //
interface StackDeploymentSettings {
  operationContext: OperationContext
  sourceContext: SourceContext
  gitHub: GitHub
  source: string
  cacheOptions: CacheOptions
}
interface OperationContext {
  oidc?: object
  environmentVariables?: pulumi.Input<{ [key: string]: pulumi.Input<string>; }>
  options?: object
}
interface SourceContext {
  git: Git
}
interface Git {
  branch: string
  repoDir?: string
}
interface GitHub {
  repository: string
  deployCommits: boolean
  previewPullRequests: boolean
  deployPullRequest?: number
  pullRequestTemplate?: boolean
  paths?: string[]
}
interface CacheOptions {
  enable: boolean
}
