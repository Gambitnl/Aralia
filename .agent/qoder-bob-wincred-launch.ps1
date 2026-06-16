param(
  [Parameter(Mandatory = $false)]
  [string]$PromptFile = ".agent\qoder-bob-cold-prompt.txt"
)

# This local runtime wrapper launches Qoder Bob without exposing the PAT.
# It reads the generic Windows Credential Manager entry that PAT Vault writes,
# places the secret only in this process environment, reads the task prompt from
# an ignored .agent text file, and then starts qodercli. The file lives under
# .agent because it is operator glue for this machine, not durable Aralia
# project source.

$ErrorActionPreference = 'Stop'

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
      throw new InvalidOperationException("Credential Manager entry was not found: " + target);
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

if (-not ('WinCredReader' -as [type])) {
  Add-Type -TypeDefinition $source
}

$target = 'Aralia PAT Vault:qoder-bob'
$token = [WinCredReader]::ReadPassword($target)

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Credential Manager entry $target exists but contains no token."
}

$Prompt = Get-Content -Raw -LiteralPath $PromptFile
if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt file $PromptFile is missing or empty."
}

$env:QODER_PERSONAL_ACCESS_TOKEN = $token
try {
  qodercli -p $Prompt
} finally {
  Remove-Item Env:\QODER_PERSONAL_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
