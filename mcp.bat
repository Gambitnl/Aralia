@echo off
REM Quick MCP utility launcher for Windows
REM Usage: mcp.bat <command> [args]

SET PATH=C:\Users\gambi\.bun\bin;%PATH%
npm run mcp -- %*
