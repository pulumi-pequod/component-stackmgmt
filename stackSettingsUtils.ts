import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";

// Creates stack tags. Uses the API instead of the Pulumi service provider due to challenges when trying to recreate an existing tag.
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

// Uses Pulumi Cloud API to set the PULUMI_ACCESS_TOKEN environment variable for a stack.
export const setPulumiAccessToken = async (pulumiAccessToken: string, stackFqdn: string ) => {

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${pulumiAccessToken}`
  };

  // Add the PULUMI_ACCESS_TOKEN environment variable to the stack's deployment settings.
  const setAccessTokenEnvVarUrl = `https://api.pulumi.com/api/stacks/${stackFqdn}/deployments/settings`
  const setResponse = await fetch(setAccessTokenEnvVarUrl, {
      method: "POST",
      body: `{"operationContext": {"environmentVariables": {"PULUMI_ACCESS_TOKEN": {"secret":"${pulumiAccessToken}"}}}}`,
      headers,
  })
  if (!setResponse.ok) {
      let errMessage = "";
      try {
          errMessage = await setResponse.text();
      } catch { }
      throw new Error(`failed to set PULUMI_ACCESS_TOKEN environment variable for stack, ${stackFqdn}: ${errMessage}`);
  } 
}

// use API to get the deployment settings for a stack.
const getDeploymentSettings = async (org: string, project: string, stack: string) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `token ${process.env["PULUMI_ACCESS_TOKEN"]}`
  };
  const stackDeploymentSettingsUrl = `https://api.pulumi.com/api/stacks/${org}/${project}/${stack}/deployments/settings`;
  const response = await fetch(stackDeploymentSettingsUrl, {
      method: "GET",
      headers,
  })

  if (!response.ok) {
      let errMessage = "";
      try {
          errMessage = await response.text();
      } catch { }
      throw new Error(`failed to get deployment settings for stack, ${org}/${project}/${stack}: ${errMessage}`);
  } 

  const deploymentSettings: StackDeploymentSettings = await response.json();
  return deploymentSettings
}

// Builds deployment settings using existing settings and modifying them as needed.
export const buildDeploymentConfig = async (npwStack: string, stack: string, org: string, project: string, pulumiAccessToken: string) => {

  // In the new NSW world, we'll always assume Pulumi Cloud has primed the deployment settings for new stacks from the original stack.
  // So we do the same.
  const baseStack = npwStack

  // Get the deployment settings from the original stack and use them as a basis for tweaking the stack's deployment settings.
  // The main tweaks are:
  // - enable caching
  // - add the PULUMI_ACCESS_TOKEN as an environment variable for the deployment so it has the permissions needed to access other stacks.
  const deploymentConfig = getDeploymentSettings(org, project, baseStack).then(baseDeploymentSettings => {

    // Use what was in the base deployment settings.
    let branch = baseDeploymentSettings.sourceContext.git?.branch || "refs/heads/main"

    // Carry over the github settings from the original stack as-is
    // This means that all stacks live on the same branch and repo as the original stack.
    const githubSettingsStringified:pulumi.Output<string> = pulumi.jsonStringify({
      repository: baseDeploymentSettings.gitHub?.repository,
      paths: baseDeploymentSettings.gitHub?.paths,
      previewPullRequests: baseDeploymentSettings.gitHub?.previewPullRequests, 
      pullRequestTemplate: baseDeploymentSettings.gitHub?.pullRequestTemplate,
      deployCommits: baseDeploymentSettings.gitHub?.deployCommits,
    })
    const githubSettings = pulumi.jsonParse(githubSettingsStringified) as pulumiservice.types.input.DeploymentSettingsGithubArgs

    // Carry over any pre-run commands from the base deployment settings.
    const preRunCommands = baseDeploymentSettings.operationContext?.preRunCommands

    // Construct the deployment settings.
    // const deploymentSettings: pulumiservice.DeploymentSettingsArgs = {
    let deploymentConfig: pulumiservice.DeploymentSettingsArgs = {
      organization: org,
      project: project,
      stack: stack,
      github: githubSettings,
      cacheOptions: {
        enable: true // enable caching to speed up deployments
      },
      operationContext: {
        // Add the access token from the environment as an env variable for the deployment.
        // This overrides the deployment stack token to enable accessing the template stack's config for review stacks and to enable stack references (where needed) 
        // Keeping for future reference, but this following code does not play well with the .NET SDK generation. It'll throw an error about type is not a string.
        // environmentVariables: { ...settings.operationContext.environmentVariables, ...{PULUMI_ACCESS_TOKEN: pulumi.secret(pulumiAccessToken)}}
        environmentVariables: { PULUMI_ACCESS_TOKEN: pulumi.secret(pulumiAccessToken) },
        // Pass along the pre-run commands from the base deployment settings.
        preRunCommands: preRunCommands
      },
      sourceContext: {
        git: {
          branch: branch,
        }
      }
    }

    // Check if this is actually a no-code deployment.
    // If so, we'll overload the branch setting to indicate it's no-code. 
    if  (baseDeploymentSettings.sourceContext.template) {
      deploymentConfig.sourceContext = undefined
    }

    return(deploymentConfig)
  })
  return(deploymentConfig)
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
  preRunCommands?: string[]
  options?: object
}
interface SourceContext {
  git?: Git
  template?: Template
}
interface Git {
  branch: string
  repoDir?: string
}
interface Template {
  sourceType: string
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
 