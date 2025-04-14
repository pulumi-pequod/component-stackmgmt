import * as pulumi from "@pulumi/pulumi";
// import { npwStack, org, project, stack, pulumiAccessToken }  from "./stackSettingsConfig"
// const stackFqdn = `${org}/${project}/${stack}`

export const setTag = async (tagName: string, tagValue: string) => {
  const npwStack = "dev" // This is the stack that NPW creates initially.
  const org = "pequod" // Temporary. Will use getOrganization()
  const project = pulumi.getProject()
  const stack = pulumi.getStack() // this is the stack that is running
  const stackFqdn = `${org}/${project}/${stack}`

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
      throw new Error(`failed to set ${tagName} tag for stack, ${org}/${project}/${stack}: ${errMessage}`);
  } 
}

// Get current deployment settings
export const getDeploymentSettings = async () => {
  const npwStack = "dev" // This is the stack that NPW creates initially.
  const org = "pequod" // Temporary. Will use getOrganization()
  const project = pulumi.getProject()
  const stack = pulumi.getStack() // this is the stack that is running
  const stackFqdn = `${org}/${project}/${stack}`
  // This may be the deployments automatically created access token or it may be one that is injected via config/environments
  const pulumiAccessToken = process.env["PULUMI_ACCESS_TOKEN"] || "notokenfound"

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${process.env["PULUMI_ACCESS_TOKEN"]}`
  };
  const stackDeploymentSettingsUrl = `https://api.pulumi.com/api/stacks/${org}/${project}/${npwStack}/deployments/settings`;
  const response = await fetch(stackDeploymentSettingsUrl, {
      method: "GET",
      headers,
  })

  if (!response.ok) {
      let errMessage = "";
      try {
          errMessage = await response.text();
      } catch { }
      throw new Error(`failed to get deployment settings for stack, ${org}/${project}/${npwStack}: ${errMessage}`);
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
