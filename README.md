# component-stacksettings
Pulumi component that handles Pequod-related stack settings.

# Inputs

* ttlMinutes (Optional): Number of minutes to wait before destroying the stack. Defaults to 8 hours.
* driftManagement (Optional): Set to `Correct` to correct drift if detected. Set to anything else to just detect drift. Defaults to `Correct`.
* deleteStack (Optional): Whether stack should be purged. Set to `True` to have stack cleaned up overnight. Set to anything else to keep the stack. Defaults to `True`.
* teamAssignment (Optional): Pulumi Team the stack should be assigned to. Defaults to `DevTeam`.
* pulumiAccessToken (Optional): A Pulumi access token to use for the stack's Deployment settings. Defaults to a `DevTeam` team token.

# Outputs

None.

# Usage
## Specify Package in `Pulumi.yaml`

Add the following to your `Pulumi.yaml` file:
Note: If no version is specified, the latest version will be used.

```
packages:
  stackmgmt: https://github.com/pulumi-pequod/component-stackmgmt[@vX.Y.Z]
``` 

## Use SDK in Program

### Python
```
from pulumi_pequod_stackmgmt import StackSettings, StackSettingsArgs

stackmgmt = StackSettings("my-stacksettings", 
                        team_assignment=config.teamName,
                        drift_management=config.driftManagement)
```

### Typescript
```
import { StackSettings } from "@pulumi-pequod/stackmgmt";

const stackmgmt = new StackSettings(baseName, {driftManagement: config.get("driftManagement")})
```

### Dotnet
```
using PulumiPequod.Stackmgmt;

var stackSettings = new StackSettings("stack-settings");
```

### YAML
```
  stacksettings:
    type: stackmgmt:StackSettings
    properties:
      ttlMinutes: 600
```




