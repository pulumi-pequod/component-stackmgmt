# component-stacksettings
Pulumi component that handles Pequod-related stack settings.

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




