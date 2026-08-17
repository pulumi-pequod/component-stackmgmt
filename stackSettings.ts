import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as pulumitime from "@pulumiverse/time";

import { buildDeploymentConfig, setPulumiAccessToken, setStackTag, setEnvTag, createService } from "./stackSettingsUtils"
import { npwStack, org, pulumiAccessToken }  from "./stackSettingsConfig"

// Interface for StackSettings
export interface StackSettingsArgs{
  /**
   * Time to live in minutes. Defaults to 480 (8 hours) if not provided.
   **/
  ttlMinutes?: number,
  /**
   * Drift management setting. Options are "Correct" (default) or "DetectOnly".
   **/
  driftManagement?: string,
  /**
   * Indicates if the stack should be deleted by the purge automation.
   * Options are "True" (default) or "False".
   */
  deleteStack?: string,
  /**
   * The team to assign the stack to. Defaults to "DevTeam". 
   **/
  teamAssignment?: string, 
  /**
   * The Pulumi access token to use for API operations. 
   **/
  pulumiAccessToken?: pulumi.Output<string>,
  /**
   * Whether to run previews for pull requests. Defaults to true.
   **/
  previewPullRequests?: boolean,
  /**
   * Whether to run updates for pushed commits. Defaults to true.
   **/
  deployCommits?: boolean,
}

// Forces Pulumi stack settings for managing TTL and other settings.
export class StackSettings extends pulumi.ComponentResource {

  constructor(name: string, args: StackSettingsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("stackmgmt:index:stacksettings", name, args, opts);

    const project = pulumi.getProject()
    const stack = pulumi.getStack()
    const stackFqdn = `${org}/${project}/${stack}`
    const teamAssignment = args.teamAssignment ?? "DevTeam"

    // All stacks need to have the Owner tag set for ABAC purposes, so get the team assignment value and set that as the Owner tag on the stack.
    setStackTag(stackFqdn, "Owner", teamAssignment)

    //// Deployment Settings and Git-backed vs No-Code handling ////
    // NOTE: Pass the promise to registerOutputs() so the Pulumi runtime waits for it to
    // settle before finalising the component. Without this, resources created inside the
    // .then() callback race against registerOutputs({}) and may not be registered,
    // causing Pulumi to delete them on the next update.
    const outputs = buildDeploymentConfig(npwStack, stack, org, project, pulumiAccessToken, args.previewPullRequests, args.deployCommits).then(deploymentConfig => {

      // This is the value for the delete_stack tag that is set below on the stack. 
      // It varies depending on whether the stack is no-code or not
      var deleteStackTagValue: string 

      // There are some differences in how git-backed and no-code deployments are handled.
      // Git-backed deployments have deployment settings that are managed and have a different "delete_stack" tag setting to tell the purge function to remove the repo.
      // No-code deployments need the "delete_stack" tag set to "StackOnly" since there is no repo to delete. 
      // Also no-code have an environment that was created that needs to be tagged and have a service created to link it to the stack.
      if (deploymentConfig.sourceContext) {  // GIT BACKED
        // Non-no-code so we need to manage the purge settings.
        deleteStackTagValue = args.deleteStack || "True"
        // Set the stack's deployment settings based on what was returned by the buildDeploymentSettings function.
        const deploymentSettings = new pulumiservice.DeploymentSettings(`${name}-deployment-settings`, deploymentConfig, {parent: this, retainOnDelete: true})
      } else {  //NO CODE
        // Need to set the delete_stack tag to "StackOnly" to prevent the purge automation from trying to delete the repo which points at the 
        // templates repo - we definitely don't want to delete the templates repo.
        deleteStackTagValue = "StackOnly"

        // Still need to set the PULUMI_ACCESS_TOKEN environment variable for the no-code stack.
        setPulumiAccessToken(pulumiAccessToken, stackFqdn)

        // Set "Owner" tag on environment that was auto created for no-code deployment. 
        // The "Owner" tag is set to the team assignment value and is used for ABAC to allow access.
        // The stack FQDN matches the corresponding environment name so just use the stack FQDN. 
        setEnvTag(stackFqdn, "Owner", teamAssignment)

        // Create a service that joins the no-code stack and related environment that was created.
        const service = createService(org, project, stack, teamAssignment, pulumiAccessToken, this)
      }

      //// Purge Stack Tag ////
      // This stack tag indicates whether or not the purge automation should delete the stack.
      // Because the tag needs to remain on destroy and the provider balks if the stack tag already exists 
      // (which would be the case on a pulumi up after a destroy), using the pulumiservice provider for this tag is not feasible.
      // So, just hit the Pulumi Cloud API set the tag and that way it is not deleted on destroy.
      const deleteStackTagName = "delete_stack"
      setStackTag(stackFqdn, deleteStackTagName, deleteStackTagValue)

      //// TTL Schedule ////
      // Calculate the TTL time based on the TTL minutes passed in or default to 8 hours.
      const ttlTime = new pulumitime.Offset("ttltime", {offsetMinutes: (args.ttlMinutes || (8*60))}, { parent: this }).rfc3339
      const ttlSchedule = new pulumiservice.TtlSchedule(`${name}-ttlschedule`, {
        organization: org,
        project: project,
        stack: stack,
        timestamp: ttlTime,
        deleteAfterDestroy: false,
      }, { parent: this }) 

      //// Drift Schedule ////
      let remediation = true // assume we want to remediate
      if ((args.driftManagement) && (args.driftManagement != "Correct")) {
        remediation = false // only do drift detection
      }
      const driftSchedule = new pulumiservice.DriftSchedule(`${name}-driftschedule`, {
        organization: org,
        project: project,
        stack: stack,
        scheduleCron: "0 * * * *",
        autoRemediate: remediation,
      }, { parent: this })

      return {}
    })

    this.registerOutputs(outputs);
  }
}



