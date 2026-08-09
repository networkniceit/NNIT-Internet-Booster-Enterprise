[CmdletBinding()]
param([string]$RelayHost='127.0.0.1',[int]$RelayPort=4501,[Parameter(Mandatory)][string]$Token,[string]$LinkName='Wi-Fi',[int]$Count=5)
$ErrorActionPreference='Stop'
$udp=[System.Net.Sockets.UdpClient]::new(); $udp.Client.ReceiveTimeout=5000
$address=[System.Net.Dns]::GetHostAddresses($RelayHost)|Where-Object AddressFamily -eq InterNetwork|Select-Object -First 1
$endpoint=[System.Net.IPEndPoint]::new($address,$RelayPort)
try { 1..$Count|ForEach-Object { $payload=@{token=$Token;sequence=$_;sentAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();linkName=$LinkName}|ConvertTo-Json -Compress; $bytes=[Text.Encoding]::UTF8.GetBytes($payload); $sw=[Diagnostics.Stopwatch]::StartNew(); [void]$udp.Send($bytes,$bytes.Length,$endpoint); $remote=[System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any,0); $resp=[Text.Encoding]::UTF8.GetString($udp.Receive([ref]$remote))|ConvertFrom-Json; $sw.Stop(); [pscustomobject]@{Sequence=$_;Success=$resp.ok;Link=$resp.linkName;RoundTripMs=$sw.ElapsedMilliseconds}; Start-Sleep -Milliseconds 500 } } finally { $udp.Dispose() }
