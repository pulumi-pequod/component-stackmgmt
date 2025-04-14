export const npwStack = "dev" // This is the stack that NPW creates initially.
export const org = "pequod" // Temporary. Will use getOrganization()

// This may be the deployments automatically created access token or it may be one that is injected via config/environments
export const pulumiAccessToken = process.env["PULUMI_ACCESS_TOKEN"] || "notokenfound"