import * as pulumi from "@pulumi/pulumi";

export const npwStack = "dev" // This is the stack that NPW creates initially.
export const org = "pequod" // Temporary. Will use getOrganization()
export const project = pulumi.getProject()
export const stack = pulumi.getStack() // this is the stack that is running

// This may be the deployments automatically created access token or it may be one that is injected via config/environments
export const pulumiAccessToken = process.env["PULUMI_ACCESS_TOKEN"] || "notokenfound"