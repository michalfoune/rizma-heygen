"""
Model Context Protocol (MCP) integration module.

This module provides the foundation for MCP-compliant tool
integrations, allowing the interview system to access
external tools and data sources.
"""

from .tool_registry import ToolRegistry, MCPTool

__all__ = ["ToolRegistry", "MCPTool"]
