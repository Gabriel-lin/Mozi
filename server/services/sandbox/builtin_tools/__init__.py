"""Built-in tool registry.

Importing this package auto-registers every tool via the @register decorator.
External code only needs:

    from services.sandbox.builtin_tools import resolve_builtin_tools, get_registry
"""

from ._base import BuiltinTool, get_registry, register, resolve_builtin_tools

# Import each tool module so @register decorators execute at import time.
from . import web_search as _web_search  # noqa: F401
from . import code_executor as _code_executor  # noqa: F401
from . import file_manager as _file_manager  # noqa: F401
from . import api_caller as _api_caller  # noqa: F401
from . import text_summarizer as _text_summarizer  # noqa: F401
from . import image_analyzer as _image_analyzer  # noqa: F401

__all__ = [
    "BuiltinTool",
    "register",
    "get_registry",
    "resolve_builtin_tools",
]
