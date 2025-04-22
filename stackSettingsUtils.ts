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

// Builds deployment settings using existing settings and modifying them as needed.
export function buildDeploymentSettings(npwStack: string, stack: string, org: string, project: string, pulumiAccessToken: string): pulumiservice.DeploymentSettingsArgs {

  // Figure out if stack is created by user (e.g. pulumi stack init ...)
  let userCreatedStack = false
  if ((stack != npwStack) && !(stack.includes(`pr-pulumi-${org}-${project}`))) {
    userCreatedStack = true
  }

  // Get the settings from the original NPW-created stack or review stack to reuse as a basis for new deployment settings for any (non-review) new stacks.
  let baseStack = npwStack
  if (stack.includes(`pr-pulumi-${org}-${project}`)) {
    baseStack = stack
  }
  const baseDeploymentSettings = pulumiservice.DeploymentSettings.get("baseDeploymentSettings", `${org}/${project}/${baseStack}`)

  // Use what was in the base deployment settings.
  let branch = baseDeploymentSettings.sourceContext?.apply(sourceContext => sourceContext?.git?.branch || "refs/heads/main")
  // But, if this is a user-created stack, then we need to modify the source context settings to point at a branch name that matches the stack name.
  if (userCreatedStack) {
    branch = pulumi.output("refs/heads/"+stack)
  }

  // Carry over the github settings as-is
  const githubSettingsStringified:pulumi.Output<string> = pulumi.jsonStringify({
    repository: baseDeploymentSettings.github.apply(github => github?.repository),
    paths: baseDeploymentSettings.github.apply(github => github?.paths),
    previewPullRequests: baseDeploymentSettings.github.apply(github => github?.previewPullRequests), 
    pullRequestTemplate: baseDeploymentSettings.github.apply(github => github?.pullRequestTemplate),
    deployCommits: baseDeploymentSettings.github.apply(github => github?.deployCommits),
  })
  const githubSettings = pulumi.jsonParse(githubSettingsStringified) as pulumiservice.types.input.DeploymentSettingsGithubArgs

  // Carry over any pre-run commands from the base deployment settings.
  const preRunCommands = baseDeploymentSettings.operationContext?.apply(operationContext => 
    { 
      if (operationContext?.preRunCommands) {
        return operationContext.preRunCommands
      } else { return [] } 
    }
  )

  // Construct the deployment settings.
  const deploymentSettings: pulumiservice.DeploymentSettingsArgs = {
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

  return(deploymentSettings)
}
 