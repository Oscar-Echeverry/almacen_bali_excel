param(
  [string]$BaseUrl,
  [string]$EnrollmentToken,
  [string]$DeviceName
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) { $BaseUrl = Read-Host "Application URL, e.g. https://secure.example.com" }
if (-not $EnrollmentToken) { $EnrollmentToken = Read-Host "Enrollment token" }
if (-not $DeviceName) { $DeviceName = Read-Host "Device name" }

$workDir = Join-Path $env:TEMP ("ssw-enroll-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null
$inf = Join-Path $workDir "device.inf"
$csr = Join-Path $workDir "device.csr"
$cert = Join-Path $workDir "device.cer"

try {
  $subject = "CN=$DeviceName"
  @"
[Version]
Signature="$Windows NT$"

[NewRequest]
Subject="$subject"
KeyAlgorithm=RSA
KeyLength=2048
Exportable=FALSE
MachineKeySet=FALSE
KeySpec=1
KeyUsage=0xa0
ProviderName="Microsoft Enhanced RSA and AES Cryptographic Provider"
RequestType=PKCS10
HashAlgorithm=sha256
FriendlyName="Secure Spreadsheet Workspace Device Certificate"

[Extensions]
2.5.29.37 = "{text}"
_continue_ = "1.3.6.1.5.5.7.3.2"
"@ | Set-Content -Encoding ascii -Path $inf

  certreq.exe -new $inf $csr | Out-Null
  $csrPem = Get-Content -Raw -Path $csr
  $body = @{
    token = $EnrollmentToken
    deviceName = $DeviceName
    csrPem = $csrPem
  } | ConvertTo-Json -Depth 4

  $response = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/enrollment/submit" -ContentType "application/json" -Body $body
  $response.certificatePem | Set-Content -Encoding ascii -Path $cert
  certreq.exe -accept $cert | Out-Null

  Write-Host "Device enrolled. Status: $($response.status)"
  Write-Host "Fingerprint: $($response.certificateFingerprint)"
  Write-Host "An administrator must approve this device before employee access works."
}
finally {
  Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
