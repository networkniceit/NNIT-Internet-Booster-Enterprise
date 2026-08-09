# Railway Plan

The current NNIT backend contains Windows-only PowerShell and CIM commands, so it should remain a Windows agent.

Deploy future cloud-safe services to Railway:
1. apps/cloud-api
2. apps/admin
3. optional cloud relay/control service

The Windows agent should connect outbound to the cloud API securely.
