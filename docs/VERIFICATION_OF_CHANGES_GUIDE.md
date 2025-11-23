# Guide for AI: Ensuring Verifiable Changes

## Purpose

This guide is for **you, the AI assistant**. Its purpose is to ensure that when you state you have made changes to the application's codebase (creating new files or modifying existing ones), these changes are **verifiable** by the system that processes your output. Adherence to this guide is critical for the successful implementation of user requests.

## Key Principle: "Show, Don't Just Tell"

The fundamental principle is that you must **show** the changes you've made, not just state that you've made them. The only way the system can apply your changes is if you provide the complete, updated content of the affected files.

## Mandatory Output Format for Code Changes

When a user requests a code change (creating a new file or updating an existing one), you **MUST** output an XML block in the following format. This is the *only* way your changes will be applied.

```xml
<changes>
  <change>
    <file>[full_path_of_file_1]</file>
    <description>[Description of the changes made to file_1]</description>
    <content><![CDATA[Full content of file_1 after your changes.
This means the ENTIRE file, from the first line to the last,
including all original content that was not changed, plus your modifications.
Do NOT provide only diffs or snippets.