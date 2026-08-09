# NNIT Enterprise Architecture

## Windows Agent
Keep Windows-only control local:
- Get-NetAdapter / Get-NetAdapterStatistics
- Get/New/Remove-NetQosPolicy
- route metrics and failover
- process/network inspection
- local throughput and measurements

## Railway / Cloud
Good cloud responsibilities:
- authentication
- user/device accounts
- analytics storage
- alert storage
- licensing
- remote dashboard API
- relay/control-plane coordination

Do not deploy the current Windows-control API unchanged to Railway.
