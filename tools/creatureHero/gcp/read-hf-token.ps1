# Prints the HF token from Windows Credential Manager (AgentMatrix namespace)
# to stdout for capture into an environment variable. Never logged or stored.
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredMan {
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll")]
    public static extern void CredFree(IntPtr buffer);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags; public uint Type; public string TargetName; public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
        public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
    }
}
"@

$target = "AgentMatrix/HuggingFace/HF_TOKEN"
$ptr = [IntPtr]::Zero
if (-not [CredMan]::CredRead($target, 1, 0, [ref]$ptr)) {
    Write-Error "credential '$target' not found in Credential Manager"
    exit 1
}
try {
    $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
    $token = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, [int]($cred.CredentialBlobSize / 2))
    Write-Output $token
} finally {
    [CredMan]::CredFree($ptr)
}
