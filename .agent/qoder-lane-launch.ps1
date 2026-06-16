param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('bob', 'cranenre')]
  [string]$Lane
)

# This local launcher keeps the two Qoder accounts isolated in Agent Matrix.
# Each lane gets its own QODER_CONFIG_DIR, so browser-login state, cached auth,
# and session files cannot bleed between Bob and Cranenre. PAT auth is injected
# only into this process environment before qodercli starts, and the token value
# is never printed.

$ErrorActionPreference = 'Stop'

$homeDir = [Environment]::GetFolderPath('UserProfile')

function Add-WinCredReader {
  if ('WinCredReader' -as [type]) { return }

  $source = @"
using System;
using System.Runtime.InteropServices;

public static class WinCredReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);

  public static string ReadPassword(string target) {
    IntPtr credentialPtr;
    if (!CredRead(target, 1, 0, out credentialPtr)) {
      return null;
    }

    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) {
        return "";
      }
      return Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2).TrimEnd('\0');
    } finally {
      CredFree(credentialPtr);
    }
  }
}
"@

  Add-Type -TypeDefinition $source
}

function Get-WinCredToken([string[]]$Targets) {
  Add-WinCredReader
  foreach ($target in $Targets) {
    $secret = [WinCredReader]::ReadPassword($target)
    if (-not [string]::IsNullOrWhiteSpace($secret)) {
      return $secret
    }
  }
  return $null
}

if ($Lane -eq 'bob') {
  $label = 'Qoder Bob'
  $configDir = Join-Path $homeDir '.qoder-cli-bob-pat'
  $token = Get-WinCredToken @('Aralia PAT Vault:qoder-bob', 'AraliaPATVault:qoder-bob')
} else {
  $label = 'Qoder Cranenre'
  $configDir = Join-Path $homeDir '.qoder-cli-cranenre'
  $token = Get-WinCredToken @('Aralia PAT Vault:qoder-cranenre', 'AraliaPATVault:qoder-cranenre')
}

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "$label PAT was not found in Windows Credential Manager. Save it in PAT Vault first."
}

New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$env:QODER_CONFIG_DIR = $configDir
$env:QODER_PERSONAL_ACCESS_TOKEN = $token

try {
  qodercli
} finally {
  Remove-Item Env:\QODER_PERSONAL_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
