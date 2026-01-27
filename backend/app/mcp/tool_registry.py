"""
MCP Tool Registry for managing external tool integrations.

Provides a registry pattern for MCP-compliant tools that can
be used by the interview agent for RAG, web search, and
other external data retrieval.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MCPToolSchema(BaseModel):
    """Schema definition for an MCP tool."""

    name: str = Field(..., description="Unique tool identifier")
    description: str = Field(..., description="Human-readable description")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="JSON Schema for tool parameters",
    )


class MCPTool(ABC):
    """
    Base class for MCP-compliant tools.

    Implement this interface to create tools that can be
    registered and used by the interview agent.
    """

    @property
    @abstractmethod
    def schema(self) -> MCPToolSchema:
        """Return the tool's schema definition."""
        pass

    @abstractmethod
    async def execute(self, **kwargs: Any) -> Any:
        """Execute the tool with given parameters."""
        pass


class ToolRegistry:
    """
    Registry for MCP tools.

    Manages tool registration, discovery, and execution
    for the interview agent system.
    """

    def __init__(self):
        self._tools: Dict[str, MCPTool] = {}
        self._enabled: Dict[str, bool] = {}

    def register(self, tool: MCPTool) -> None:
        """Register a new tool."""
        schema = tool.schema
        self._tools[schema.name] = tool
        self._enabled[schema.name] = True
        logger.info(f"Registered MCP tool: {schema.name}")

    def unregister(self, tool_name: str) -> None:
        """Unregister a tool."""
        if tool_name in self._tools:
            del self._tools[tool_name]
            del self._enabled[tool_name]
            logger.info(f"Unregistered MCP tool: {tool_name}")

    def enable(self, tool_name: str) -> None:
        """Enable a registered tool."""
        if tool_name in self._enabled:
            self._enabled[tool_name] = True

    def disable(self, tool_name: str) -> None:
        """Disable a registered tool."""
        if tool_name in self._enabled:
            self._enabled[tool_name] = False

    def get_tool(self, tool_name: str) -> Optional[MCPTool]:
        """Get a tool by name if enabled."""
        if self._enabled.get(tool_name, False):
            return self._tools.get(tool_name)
        return None

    def list_tools(self) -> List[MCPToolSchema]:
        """List all enabled tool schemas."""
        return [
            tool.schema
            for name, tool in self._tools.items()
            if self._enabled.get(name, False)
        ]

    async def execute(self, tool_name: str, **kwargs: Any) -> Any:
        """Execute a tool by name."""
        tool = self.get_tool(tool_name)
        if not tool:
            raise ValueError(f"Tool '{tool_name}' not found or disabled")
        return await tool.execute(**kwargs)

    def get_schemas_for_llm(self) -> List[Dict[str, Any]]:
        """
        Get tool schemas in LLM-compatible format.

        Returns schemas formatted for use with Claude's
        tool_use feature.
        """
        return [
            {
                "name": schema.name,
                "description": schema.description,
                "input_schema": schema.parameters,
            }
            for schema in self.list_tools()
        ]


# Example tool implementations for future use

class CompanyInfoTool(MCPTool):
    """Tool for retrieving company information (placeholder)."""

    @property
    def schema(self) -> MCPToolSchema:
        return MCPToolSchema(
            name="get_company_info",
            description="Retrieve information about a company for interview context",
            parameters={
                "type": "object",
                "properties": {
                    "company_name": {
                        "type": "string",
                        "description": "Name of the company",
                    },
                    "info_type": {
                        "type": "string",
                        "enum": ["values", "culture", "recent_news", "products"],
                        "description": "Type of information to retrieve",
                    },
                },
                "required": ["company_name"],
            },
        )

    async def execute(self, company_name: str, info_type: str = "values") -> Dict[str, Any]:
        """Retrieve company information (placeholder implementation)."""
        # In production, this would call a RAG system or external API
        return {
            "company": company_name,
            "info_type": info_type,
            "data": f"Placeholder {info_type} data for {company_name}",
        }


class RoleRequirementsTool(MCPTool):
    """Tool for retrieving role requirements (placeholder)."""

    @property
    def schema(self) -> MCPToolSchema:
        return MCPToolSchema(
            name="get_role_requirements",
            description="Retrieve requirements for a specific job role",
            parameters={
                "type": "object",
                "properties": {
                    "role_title": {
                        "type": "string",
                        "description": "Title of the role",
                    },
                    "level": {
                        "type": "string",
                        "enum": ["junior", "mid", "senior", "lead", "principal"],
                        "description": "Seniority level",
                    },
                },
                "required": ["role_title"],
            },
        )

    async def execute(self, role_title: str, level: str = "mid") -> Dict[str, Any]:
        """Retrieve role requirements (placeholder implementation)."""
        # In production, this would query a job requirements database
        return {
            "role": role_title,
            "level": level,
            "requirements": [
                "Technical proficiency",
                "Communication skills",
                "Problem-solving ability",
            ],
        }
