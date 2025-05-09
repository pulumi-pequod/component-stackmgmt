import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as pulumitime from "@pulumiverse/time";

import { setTag, buildDeploymentConfig} from "./stackSettingsUtils"
import { npwStack, org, pulumiAccessToken }  from "./stackSettingsConfig"

// Interface for StackSettings
export interface StackSettingsArgs{
  ttlMinutes?: number,
  driftManagement?: string,
  deleteStack?: string,
  teamAssignment?: string, 
  pulumiAccessToken?: pulumi.Output<string>,
}

// Forces Pulumi stack settings for managing TTL and other settings.
export class StackSettings extends pulumi.ComponentResource {

  constructor(name: string, args: StackSettingsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("stackmgmt:index:stacksettings", name, args, opts);

    const project = pulumi.getProject()
    const stack = pulumi.getStack()
    const stackFqdn = `${org}/${project}/${stack}`

    //// Deployment Settings Management ////
    // If a new stack is created by the user (e.g. `pulumi stack init pequod/test`) there are a couple of assumptions:
    // - It tracks to a branch with the same name as the stack.
    // - It always has the same deployment settings (other than the branch name) as the original NPW-created stack.
    // Although this is somewhat restrictive, it is sufficient for the general use-case of creating new stacks.
    // Get the settings from the original NPW-created stack or review stack to reuse as a basis for new deployment settings for any (non-review) new stacks.

    // This is the value for the delete_stack tag that is set on the stack.
    // It varies depending on whether the stack is no-code or not
    var deleteStackTagValue: string 

    buildDeploymentConfig(npwStack, stack, org, project, pulumiAccessToken).then(deploymentConfig => {
      // Check if this is a no-code deployment. If not, then we need to manage the deployment settings.
      if (deploymentConfig.sourceContext) {
        // Non-no-code so we need to manage the purge settings.
        deleteStackTagValue = args.deleteStack || "True"
        // Set the stack's deployment settings based on what was returned by the buildDeploymentSettings function.
        const deploymentSettings = new pulumiservice.DeploymentSettings(`${name}-deployment-settings`, deploymentConfig, {parent: this, retainOnDelete: true})
      } else {
        // Need to set the delete_stack tag to "StackOnly" to prevent the purge automation from trying to delete the repo which points at the 
        // templates repo - we definitely don't want to delete the templates repo.
        deleteStackTagValue = "StackOnly"
      }

      //// Purge Stack Tag ////
      // This stack tag indicates whether or not the purge automation should delete the stack.
      // Because the tag needs to remain on destroy and the provider balks if the stack tag already exists 
      // (which would be the case on a pulumi up after a destroy), using the pulumiservice provider for this tag is not feasible.
      // So, just hit the Pulumi Cloud API set the tag and that way it is not deleted on destroy.
      const deleteStackTagName = "delete_stack"
      setTag(stackFqdn, deleteStackTagName, deleteStackTagValue)

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
    })
    //// Team Stack Assignment ////
    // If no team name given, then assign to the "DevTeam"
    const teamAssignment = args.teamAssignment ?? "DevTeam"
    const teamStackAssignment = new pulumiservice.TeamStackPermission(`${name}-team-stack-assign`, {
      organization: org,
      project: project,
      stack: stack,
      team: teamAssignment,
      permission: pulumiservice.TeamStackPermissionScope.Admin
    }, { parent: this, retainOnDelete: true })

    this.registerOutputs({});
  }
}



